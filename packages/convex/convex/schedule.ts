import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { assertRecordInActiveOrg, requireActiveOrganization } from "./lib/orgContext";

const priorityValues = ["low", "normal", "high", "urgent"] as const;

const dispatchPriorityValidator = v.union(
  v.literal("low"),
  v.literal("normal"),
  v.literal("high"),
  v.literal("urgent")
);

const filterPriorityValidator = v.union(
  v.literal("all"),
  v.literal("low"),
  v.literal("normal"),
  v.literal("high"),
  v.literal("urgent")
);

const assignmentStateValidator = v.union(
  v.literal("all"),
  v.literal("assigned"),
  v.literal("unassigned")
);

const locationSnapshotValidator = v.object({
  street: v.optional(v.string()),
  addressLine2: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  geocodeStatus: v.optional(v.string()),
  geocodedAt: v.optional(v.number()),
  provider: v.optional(v.string()),
});

const priorityRank: Record<string, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

type AddressLike = {
  street?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

type DispatchGeocodeJobStatus =
  | "queued"
  | "processing"
  | "retry"
  | "completed"
  | "failed";

const MAX_DISPATCH_GEOCODE_ATTEMPTS = 6;
const RETRY_BACKOFF_MINUTES = [5, 15, 60, 180, 720, 1440];

type GeocodeSeedSummary = {
  scanned: number;
  queued: number;
};

type GeocodeProcessSummary = {
  due: number;
  processed: number;
  geocoded: number;
  retryScheduled: number;
  failedPermanent: number;
  missingAddress: number;
  tokenMissing: number;
};

type GeocodeSweepSummary = {
  seedScanned: number;
  seedQueued: number;
} & GeocodeProcessSummary;

function hasCoordinates(location?: { latitude?: number; longitude?: number }): boolean {
  return (
    typeof location?.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    typeof location?.longitude === "number" &&
    Number.isFinite(location.longitude)
  );
}

function resolvePriority(priority?: string): (typeof priorityValues)[number] {
  return priority && priorityValues.includes(priority as (typeof priorityValues)[number])
    ? (priority as (typeof priorityValues)[number])
    : "normal";
}

function addressToLine(address: AddressLike): string {
  return [
    address.street,
    address.addressLine2,
    address.city,
    address.state,
    address.postalCode,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

function hasAddress(address: AddressLike): boolean {
  return Boolean(
    address.street ||
      address.addressLine2 ||
      address.city ||
      address.state ||
      address.postalCode
  );
}

function stableAddressHash(addressLine: string): string {
  // Deterministic non-cryptographic hash for dedupe/change detection.
  let hash = 2166136261;
  for (let i = 0; i < addressLine.length; i += 1) {
    hash ^= addressLine.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16);
}

function nextRetryDelayMs(attempts: number): number {
  const index = Math.max(0, Math.min(attempts - 1, RETRY_BACKOFF_MINUTES.length - 1));
  return RETRY_BACKOFF_MINUTES[index] * 60 * 1000;
}

async function geocodeWithMapbox(
  token: string,
  addressLine: string
): Promise<{ latitude: number; longitude: number } | null> {
  const encodedQuery = encodeURIComponent(addressLine);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${token}&limit=1&country=US`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    features?: Array<{ center?: [number, number] }>;
  };
  const center = payload.features?.[0]?.center;
  if (!center || center.length < 2) return null;
  return {
    longitude: center[0],
    latitude: center[1],
  };
}

type DispatchRouteCandidate = {
  bookingId: Id<"bookings">;
  latitude: number;
  longitude: number;
  dispatchPriority: (typeof priorityValues)[number];
  serviceWindowStart?: string | null;
  dispatchOrder?: number | null;
  createdAt: number;
};

type DispatchRouteScopeBooking = {
  _id: Id<"bookings">;
  dispatchPriority: (typeof priorityValues)[number];
  serviceWindowStart?: string;
  dispatchOrder?: number;
  createdAt: number;
  location: {
    latitude?: number;
    longitude?: number;
  };
};

type RouteGeometryResult = {
  provider: "mapbox" | "fallback";
  routeCoordinates: Array<[number, number]>;
  totalDistanceMeters: number | null;
  totalDurationSeconds: number | null;
};

function parseWindowToMinutes(value?: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function routingPriorityBucket(priority: (typeof priorityValues)[number]): number {
  switch (priority) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    case "normal":
      return 2;
    case "low":
      return 3;
    default:
      return 2;
  }
}

function compareRoutingConstraints(
  left: DispatchRouteCandidate,
  right: DispatchRouteCandidate
): number {
  const priorityDiff =
    routingPriorityBucket(left.dispatchPriority) -
    routingPriorityBucket(right.dispatchPriority);
  if (priorityDiff !== 0) return priorityDiff;

  const leftWindow = parseWindowToMinutes(left.serviceWindowStart);
  const rightWindow = parseWindowToMinutes(right.serviceWindowStart);

  if (leftWindow === null && rightWindow !== null) return 1;
  if (leftWindow !== null && rightWindow === null) return -1;
  if (leftWindow !== null && rightWindow !== null && leftWindow !== rightWindow) {
    return leftWindow - rightWindow;
  }

  const leftOrder = left.dispatchOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.dispatchOrder ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  return left.createdAt - right.createdAt;
}

function haversineDistanceKm(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(startLat);
  const lat2 = toRadians(endLat);
  const dLat = toRadians(endLat - startLat);
  const dLng = toRadians(endLng - startLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function orderCandidatesWithinGroup(
  candidates: DispatchRouteCandidate[],
  anchor: DispatchRouteCandidate | null
): DispatchRouteCandidate[] {
  if (candidates.length <= 1) return [...candidates];

  const remaining = [...candidates].sort(compareRoutingConstraints);
  let current = remaining[0];

  if (anchor) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const distance = haversineDistanceKm(
        anchor.latitude,
        anchor.longitude,
        candidate.latitude,
        candidate.longitude
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      } else if (
        distance === nearestDistance &&
        compareRoutingConstraints(candidate, remaining[nearestIndex]) < 0
      ) {
        nearestIndex = i;
      }
    }
    current = remaining[nearestIndex];
    remaining.splice(nearestIndex, 1);
  } else {
    remaining.shift();
  }

  const ordered: DispatchRouteCandidate[] = [current];

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = remaining[i];
      const distance = haversineDistanceKm(
        current.latitude,
        current.longitude,
        candidate.latitude,
        candidate.longitude
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      } else if (
        distance === bestDistance &&
        compareRoutingConstraints(candidate, remaining[bestIndex]) < 0
      ) {
        bestIndex = i;
      }
    }
    current = remaining[bestIndex];
    remaining.splice(bestIndex, 1);
    ordered.push(current);
  }

  return ordered;
}

function chunkRouteCoordinates(
  coordinates: Array<[number, number]>,
  maxChunkSize: number
): Array<Array<[number, number]>> {
  if (coordinates.length <= maxChunkSize) return [coordinates];

  const chunks: Array<Array<[number, number]>> = [];
  let start = 0;
  while (start < coordinates.length) {
    const end = Math.min(start + maxChunkSize, coordinates.length);
    const chunk = coordinates.slice(start, end);
    if (start !== 0) {
      chunk.unshift(coordinates[start - 1]);
    }
    chunks.push(chunk);
    start = end;
  }

  return chunks;
}

async function fetchDirectionsChunk(
  token: string,
  coordinates: Array<[number, number]>
): Promise<{
  coordinates: Array<[number, number]>;
  distance: number;
  duration: number;
} | null> {
  if (coordinates.length < 2) return null;

  const coordinatePath = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatePath}?access_token=${token}&overview=full&geometries=geojson&steps=false&alternatives=false`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    routes?: Array<{
      distance?: number;
      duration?: number;
      geometry?: { coordinates?: number[][] };
    }>;
  };
  const route = payload.routes?.[0];
  if (!route?.geometry?.coordinates || route.geometry.coordinates.length === 0) {
    return null;
  }

  const routeCoordinates = route.geometry.coordinates
    .filter((coordinate) => coordinate.length >= 2)
    .map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]);

  if (routeCoordinates.length === 0) return null;

  return {
    coordinates: routeCoordinates,
    distance: route.distance ?? 0,
    duration: route.duration ?? 0,
  };
}

async function buildRouteGeometry(
  token: string | undefined,
  orderedCandidates: DispatchRouteCandidate[]
): Promise<RouteGeometryResult> {
  const fallbackCoordinates = orderedCandidates.map(
    (candidate) => [candidate.longitude, candidate.latitude] as [number, number]
  );

  if (orderedCandidates.length <= 1) {
    return {
      provider: "fallback",
      routeCoordinates: fallbackCoordinates,
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
    };
  }

  if (!token) {
    return {
      provider: "fallback",
      routeCoordinates: fallbackCoordinates,
      totalDistanceMeters: null,
      totalDurationSeconds: null,
    };
  }

  const chunks = chunkRouteCoordinates(fallbackCoordinates, 25);
  let mergedCoordinates: Array<[number, number]> = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let usedFallback = false;

  for (const chunk of chunks) {
    const segment = await fetchDirectionsChunk(token, chunk);
    if (!segment) {
      usedFallback = true;
      if (mergedCoordinates.length === 0) {
        mergedCoordinates = [...chunk];
      } else {
        mergedCoordinates.push(...chunk.slice(1));
      }
      continue;
    }

    totalDistanceMeters += segment.distance;
    totalDurationSeconds += segment.duration;
    if (mergedCoordinates.length === 0) {
      mergedCoordinates = [...segment.coordinates];
    } else {
      mergedCoordinates.push(...segment.coordinates.slice(1));
    }
  }

  if (mergedCoordinates.length === 0) {
    mergedCoordinates = fallbackCoordinates;
    usedFallback = true;
  }

  return {
    provider: usedFallback ? "fallback" : "mapbox",
    routeCoordinates: mergedCoordinates,
    totalDistanceMeters: usedFallback ? null : totalDistanceMeters,
    totalDurationSeconds: usedFallback ? null : totalDurationSeconds,
  };
}

/**
 * Get bookings within a date range for legacy calendar view.
 */
export const getBookingsByDateRange = query({
  args: {
    startDate: v.string(), // ISO date string "YYYY-MM-DD"
    endDate: v.string(),
    status: v.optional(v.string()),
    cleanerId: v.optional(v.id("cleaners")),
  },
  handler: async (ctx, { startDate, endDate, status, cleanerId }) => {
    const { organization } = await requireActiveOrganization(ctx);
    // If filtering by cleaner, get their assignments first.
    if (cleanerId) {
      const cleaner = await ctx.db.get(cleanerId);
      if (!cleaner) {
        return [];
      }
      assertRecordInActiveOrg(cleaner.organizationId, organization._id);

      const assignments = await ctx.db
        .query("bookingAssignments")
        .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
        .collect();

      const bookingIds = assignments.map((a) => a.bookingId);
      const bookings = await Promise.all(bookingIds.map((id) => ctx.db.get(id)));

      return bookings
        .filter((b): b is NonNullable<typeof b> => {
          if (!b || !b.serviceDate) return false;
          if (b.organizationId !== organization._id) return false;
          if (status && b.status !== status) return false;
          return b.serviceDate >= startDate && b.serviceDate <= endDate;
        })
        .map((b) => ({
          ...b,
          assignmentId: assignments.find((a) => a.bookingId === b._id)?._id,
        }));
    }

    const rangeBookings = status
      ? await ctx.db
          .query("bookings")
          .withIndex("by_org_status_service_date", (q) =>
            q
              .eq("organizationId", organization._id)
              .eq("status", status)
              .gte("serviceDate", startDate)
              .lte("serviceDate", endDate)
          )
          .collect()
      : await ctx.db
          .query("bookings")
          .withIndex("by_org_service_date", (q) =>
            q
              .eq("organizationId", organization._id)
              .gte("serviceDate", startDate)
              .lte("serviceDate", endDate)
          )
          .collect();

    return rangeBookings.filter((booking) => Boolean(booking.serviceDate));
  },
});

/**
 * Dispatch-day query for map + queue workflow.
 */
export const getDispatchDay = query({
  args: {
    date: v.string(), // ISO date "YYYY-MM-DD"
    status: v.optional(v.string()),
    cleanerId: v.optional(v.id("cleaners")),
    assignmentState: v.optional(assignmentStateValidator),
    priority: v.optional(filterPriorityValidator),
  },
  handler: async (ctx, { date, status, cleanerId, assignmentState, priority }) => {
    const { organization } = await requireActiveOrganization(ctx);
    if (cleanerId) {
      const cleaner = await ctx.db.get(cleanerId);
      if (!cleaner) {
        return {
          date,
          totals: {
            total: 0,
            assigned: 0,
            unassigned: 0,
            missingLocation: 0,
          },
          bookings: [],
          cleaners: [],
        };
      }
      assertRecordInActiveOrg(cleaner.organizationId, organization._id);
    }

    const dayBookings = status
      ? await ctx.db
          .query("bookings")
          .withIndex("by_org_status_service_date", (q) =>
            q.eq("organizationId", organization._id).eq("status", status).eq("serviceDate", date)
          )
          .collect()
      : await ctx.db
          .query("bookings")
          .withIndex("by_org_service_date", (q) =>
            q.eq("organizationId", organization._id).eq("serviceDate", date)
          )
          .collect();

    const assignmentsByBooking = new Map<
      Id<"bookings">,
      Array<{
        _id: Id<"bookingAssignments">;
        cleanerId?: Id<"cleaners">;
        crewId?: Id<"crews">;
        role: string;
        status: string;
      }>
    >();

    const assignmentsNested = await Promise.all(
      dayBookings.map((booking) =>
        ctx.db
          .query("bookingAssignments")
          .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
          .collect()
      )
    );
    const checklistNested = await Promise.all(
      dayBookings.map((booking) =>
        ctx.db
          .query("bookingChecklistItems")
          .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
          .collect()
      )
    );

    assignmentsNested.forEach((assignments, index) => {
      assignmentsByBooking.set(
        dayBookings[index]._id,
        assignments.map((assignment) => ({
          _id: assignment._id,
          cleanerId: assignment.cleanerId,
          crewId: assignment.crewId,
          role: assignment.role,
          status: assignment.status,
        }))
      );
    });
    const checklistByBooking = new Map<
      Id<"bookings">,
      { total: number; completed: number; complete: boolean }
    >();
    checklistNested.forEach((items, index) => {
      const total = items.length;
      const completed = items.filter((item) => item.isCompleted).length;
      checklistByBooking.set(dayBookings[index]._id, {
        total,
        completed,
        complete: total === 0 || completed === total,
      });
    });

    const cleanerIds = Array.from(
      new Set(
        assignmentsNested
          .flat()
          .map((assignment) => assignment.cleanerId)
          .filter((id): id is Id<"cleaners"> => Boolean(id))
      )
    );
    const cleaners = await Promise.all(cleanerIds.map((id) => ctx.db.get(id)));
    const cleanersById = new Map<Id<"cleaners">, Doc<"cleaners">>(
      cleaners.filter((cleaner): cleaner is Doc<"cleaners"> => Boolean(cleaner)).map((cleaner) => [cleaner._id, cleaner])
    );

    const customerIds = Array.from(
      new Set(
        dayBookings
          .map((booking) => booking.customerId)
          .filter((id): id is Id<"customers"> => Boolean(id))
      )
    );
    const customers = await Promise.all(customerIds.map((id) => ctx.db.get(id)));
    const customersById = new Map<Id<"customers">, Doc<"customers">>(
      customers.filter((customer): customer is Doc<"customers"> => Boolean(customer)).map((customer) => [customer._id, customer])
    );

    const bookingRequestIds = Array.from(
      new Set(
        dayBookings
          .map((booking) => booking.bookingRequestId)
          .filter((id): id is Id<"bookingRequests"> => Boolean(id))
      )
    );
    const bookingRequests = await Promise.all(bookingRequestIds.map((id) => ctx.db.get(id)));
    const bookingRequestsById = new Map<Id<"bookingRequests">, Doc<"bookingRequests">>(
      bookingRequests.filter((request): request is Doc<"bookingRequests"> => Boolean(request)).map((request) => [request._id, request])
    );

    const quoteRequestIds = Array.from(
      new Set(
        bookingRequests
          .map((request) => request?.quoteRequestId)
          .filter((id): id is Id<"quoteRequests"> => Boolean(id))
      )
    );
    const quoteRequests = await Promise.all(quoteRequestIds.map((id) => ctx.db.get(id)));
    const quoteRequestsById = new Map<Id<"quoteRequests">, Doc<"quoteRequests">>(
      quoteRequests.filter((quote): quote is Doc<"quoteRequests"> => Boolean(quote)).map((quote) => [quote._id, quote])
    );

    const cleanerAssignmentCounts = new Map<Id<"cleaners">, number>();
    assignmentsNested.flat().forEach((assignment) => {
      if (!assignment.cleanerId) return;
      const count = cleanerAssignmentCounts.get(assignment.cleanerId) ?? 0;
      cleanerAssignmentCounts.set(assignment.cleanerId, count + 1);
    });

    const activeCleaners = await ctx.db
      .query("cleaners")
      .withIndex("by_status_and_org", (q) =>
        q.eq("status", "active").eq("organizationId", organization._id)
      )
      .collect();

    const enrichedBookings = dayBookings
      .map((booking) => {
        const assignments = assignmentsByBooking.get(booking._id) ?? [];
        const checklist = checklistByBooking.get(booking._id) ?? {
          total: 0,
          completed: 0,
          complete: true,
        };
        const assignedCount = assignments.filter(
          (assignment) => assignment.cleanerId || assignment.crewId
        ).length;
        const dispatchPriority = resolvePriority(booking.dispatchPriority);

        const customerAddress = booking.customerId
          ? customersById.get(booking.customerId)?.address
          : undefined;
        const bookingRequest = booking.bookingRequestId
          ? bookingRequestsById.get(booking.bookingRequestId)
          : undefined;
        const quote = bookingRequest?.quoteRequestId
          ? quoteRequestsById.get(bookingRequest.quoteRequestId)
          : undefined;

        const fallbackAddress: AddressLike = customerAddress
          ? {
              street: customerAddress.street,
              addressLine2: customerAddress.addressLine2,
              city: customerAddress.city,
              state: customerAddress.state,
              postalCode: customerAddress.postalCode,
            }
          : quote
          ? {
              street: quote.address,
              addressLine2: quote.addressLine2,
              city: quote.city,
              state: quote.state,
              postalCode: quote.postalCode,
            }
          : {};

        const snapshot = booking.locationSnapshot ?? {};
        const location: {
          street?: string;
          addressLine2?: string;
          city?: string;
          state?: string;
          postalCode?: string;
          latitude?: number;
          longitude?: number;
          geocodeStatus: string;
          geocodedAt?: number;
          provider?: string;
          source: "snapshot" | "customer_or_quote" | "none";
          addressLine: string;
        } = {
          street: snapshot.street ?? fallbackAddress.street,
          addressLine2: snapshot.addressLine2 ?? fallbackAddress.addressLine2,
          city: snapshot.city ?? fallbackAddress.city,
          state: snapshot.state ?? fallbackAddress.state,
          postalCode: snapshot.postalCode ?? fallbackAddress.postalCode,
          latitude: snapshot.latitude,
          longitude: snapshot.longitude,
          geocodeStatus:
            snapshot.geocodeStatus ??
            (hasAddress({
              street: snapshot.street ?? fallbackAddress.street,
              addressLine2: snapshot.addressLine2 ?? fallbackAddress.addressLine2,
              city: snapshot.city ?? fallbackAddress.city,
              state: snapshot.state ?? fallbackAddress.state,
              postalCode: snapshot.postalCode ?? fallbackAddress.postalCode,
            })
              ? "pending"
              : "missing_address"),
          geocodedAt: snapshot.geocodedAt,
          provider: snapshot.provider,
          source: booking.locationSnapshot
            ? "snapshot"
            : hasAddress(fallbackAddress)
            ? "customer_or_quote"
            : "none",
          addressLine: addressToLine({
            street: snapshot.street ?? fallbackAddress.street,
            addressLine2: snapshot.addressLine2 ?? fallbackAddress.addressLine2,
            city: snapshot.city ?? fallbackAddress.city,
            state: snapshot.state ?? fallbackAddress.state,
            postalCode: snapshot.postalCode ?? fallbackAddress.postalCode,
          }),
        };

        const bookingCleaners = assignments
          .map((assignment) => {
            if (!assignment.cleanerId) return null;
            const cleaner = cleanersById.get(assignment.cleanerId);
            return {
              cleanerId: assignment.cleanerId,
              role: assignment.role,
              status: assignment.status,
              name: cleaner
                ? `${cleaner.firstName} ${cleaner.lastName}`
                : "Unknown cleaner",
            };
          })
          .filter((cleaner): cleaner is NonNullable<typeof cleaner> => Boolean(cleaner));

        return {
          _id: booking._id,
          status: booking.status,
          email: booking.email,
          customerName: booking.customerName,
          serviceType: booking.serviceType,
          amount: booking.amount,
          serviceDate: booking.serviceDate,
          serviceWindowStart: booking.serviceWindowStart,
          serviceWindowEnd: booking.serviceWindowEnd,
          estimatedDurationMinutes: booking.estimatedDurationMinutes,
          dispatchPriority,
          dispatchOrder: booking.dispatchOrder,
          createdAt: booking.createdAt,
          location,
          assignments: {
            total: assignments.length,
            assigned: assignedCount,
            cleaners: bookingCleaners,
          },
          checklist,
          badges: [
            assignedCount === 0 ? "unassigned" : "assigned",
            !hasCoordinates(location) ? "needs_location" : "mapped",
            !checklist.complete ? "checklist_blocked" : null,
            dispatchPriority !== "normal" ? `${dispatchPriority}_priority` : null,
          ].filter((badge): badge is string => Boolean(badge)),
        };
      })
      .filter((booking) => {
        if (cleanerId) {
          const hasCleaner = booking.assignments.cleaners.some(
            (cleaner) => cleaner.cleanerId === cleanerId
          );
          if (!hasCleaner) return false;
        }

        if ((assignmentState ?? "all") === "assigned" && booking.assignments.assigned === 0) {
          return false;
        }
        if (
          (assignmentState ?? "all") === "unassigned" &&
          booking.assignments.assigned > 0
        ) {
          return false;
        }

        if ((priority ?? "all") !== "all" && booking.dispatchPriority !== priority) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const priorityDiff =
          (priorityRank[right.dispatchPriority] ?? 0) -
          (priorityRank[left.dispatchPriority] ?? 0);
        if (priorityDiff !== 0) return priorityDiff;

        const leftWindow = left.serviceWindowStart ?? "99:99";
        const rightWindow = right.serviceWindowStart ?? "99:99";
        if (leftWindow !== rightWindow) return leftWindow.localeCompare(rightWindow);

        const leftOrder = left.dispatchOrder ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.dispatchOrder ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;

        return left.createdAt - right.createdAt;
      });

    return {
      date,
      totals: {
        total: enrichedBookings.length,
        assigned: enrichedBookings.filter((booking) => booking.assignments.assigned > 0).length,
        unassigned: enrichedBookings.filter((booking) => booking.assignments.assigned === 0)
          .length,
        missingLocation: enrichedBookings.filter((booking) => !hasCoordinates(booking.location))
          .length,
      },
      bookings: enrichedBookings,
      cleaners: activeCleaners
        .map((cleaner) => ({
          _id: cleaner._id,
          name: `${cleaner.firstName} ${cleaner.lastName}`,
          assignmentCount: cleanerAssignmentCounts.get(cleaner._id) ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

const dispatchRouteScopeBookingValidator = v.object({
  _id: v.id("bookings"),
  dispatchPriority: dispatchPriorityValidator,
  serviceWindowStart: v.optional(v.string()),
  dispatchOrder: v.optional(v.number()),
  createdAt: v.number(),
  location: v.object({
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  }),
});

export const getDispatchRouteScope = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    date: v.string(),
    status: v.optional(v.string()),
    cleanerId: v.optional(v.id("cleaners")),
    assignmentState: v.optional(assignmentStateValidator),
    priority: v.optional(filterPriorityValidator),
  },
  returns: v.array(dispatchRouteScopeBookingValidator),
  handler: async (
    ctx,
    { organizationId, date, status, cleanerId, assignmentState, priority }
  ) => {
    if (cleanerId) {
      const cleaner = await ctx.db.get(cleanerId);
      if (!cleaner || cleaner.organizationId !== organizationId) {
        return [];
      }
    }

    const dayBookings = status
      ? await ctx.db
          .query("bookings")
          .withIndex("by_org_status_service_date", (q) =>
            q.eq("organizationId", organizationId).eq("status", status).eq("serviceDate", date)
          )
          .collect()
      : await ctx.db
          .query("bookings")
          .withIndex("by_org_service_date", (q) =>
            q.eq("organizationId", organizationId).eq("serviceDate", date)
          )
          .collect();

    const assignmentsNested = await Promise.all(
      dayBookings.map((booking) =>
        ctx.db
          .query("bookingAssignments")
          .withIndex("by_booking", (q) => q.eq("bookingId", booking._id))
          .collect()
      )
    );

    return dayBookings
      .map((booking, index) => {
        const assignments = assignmentsNested[index] ?? [];
        const assignedCount = assignments.filter(
          (assignment) => assignment.cleanerId || assignment.crewId
        ).length;
        const dispatchPriority = resolvePriority(booking.dispatchPriority);
        const location = {
          latitude: booking.locationSnapshot?.latitude,
          longitude: booking.locationSnapshot?.longitude,
        };

        return {
          _id: booking._id,
          dispatchPriority,
          serviceWindowStart: booking.serviceWindowStart ?? undefined,
          dispatchOrder: booking.dispatchOrder ?? undefined,
          createdAt: booking.createdAt,
          location,
          assignedCount,
          cleanerIds: assignments
            .map((assignment) => assignment.cleanerId)
            .filter((cleaner): cleaner is Id<"cleaners"> => Boolean(cleaner)),
        };
      })
      .filter((booking) => {
        if (cleanerId && !booking.cleanerIds.includes(cleanerId)) {
          return false;
        }

        if ((assignmentState ?? "all") === "assigned" && booking.assignedCount === 0) {
          return false;
        }

        if (
          (assignmentState ?? "all") === "unassigned" &&
          booking.assignedCount > 0
        ) {
          return false;
        }

        if ((priority ?? "all") !== "all" && booking.dispatchPriority !== priority) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const priorityDiff =
          (priorityRank[right.dispatchPriority] ?? 0) -
          (priorityRank[left.dispatchPriority] ?? 0);
        if (priorityDiff !== 0) return priorityDiff;

        const leftWindow = left.serviceWindowStart ?? "99:99";
        const rightWindow = right.serviceWindowStart ?? "99:99";
        if (leftWindow !== rightWindow) return leftWindow.localeCompare(rightWindow);

        const leftOrder = left.dispatchOrder ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.dispatchOrder ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;

        return left.createdAt - right.createdAt;
      })
      .map((booking) => ({
        _id: booking._id,
        dispatchPriority: booking.dispatchPriority,
        serviceWindowStart: booking.serviceWindowStart,
        dispatchOrder: booking.dispatchOrder,
        createdAt: booking.createdAt,
        location: booking.location,
      }));
  },
});

/**
 * Suggest a route for the currently visible dispatch scope.
 * Prioritizes urgent/high bookings and tighter service windows,
 * then optimizes travel distance within those constraints.
 */
export const suggestDispatchRoute = action({
  args: {
    date: v.string(),
    status: v.optional(v.string()),
    cleanerId: v.optional(v.id("cleaners")),
    assignmentState: v.optional(assignmentStateValidator),
    priority: v.optional(filterPriorityValidator),
    maxStops: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { date, status, cleanerId, assignmentState, priority, maxStops }
  ): Promise<{
    date: string;
    totalVisibleStops: number;
    mappedStops: number;
    tokenConfigured: boolean;
    provider: "mapbox" | "fallback";
    orderedBookingIds: Id<"bookings">[];
    skippedBookingIds: Id<"bookings">[];
    unmappedBookingIds: Id<"bookings">[];
    routeCoordinates: Array<[number, number]>;
    totalDistanceMeters: number | null;
    totalDurationSeconds: number | null;
  }> => {
    const { organization } = await requireActiveOrganization(ctx);
    const routeScope = (await ctx.runQuery(
      internal.schedule.getDispatchRouteScope as any,
      {
        organizationId: organization._id,
        date,
        status,
        cleanerId,
        assignmentState,
        priority,
      }
    )) as DispatchRouteScopeBooking[];

    const mappedCandidates: DispatchRouteCandidate[] = routeScope
      .filter((booking) => hasCoordinates(booking.location))
      .map((booking) => ({
        bookingId: booking._id,
        latitude: booking.location.latitude as number,
        longitude: booking.location.longitude as number,
        dispatchPriority: resolvePriority(booking.dispatchPriority),
        serviceWindowStart: booking.serviceWindowStart,
        dispatchOrder: booking.dispatchOrder,
        createdAt: booking.createdAt,
      }));

    const effectiveMaxStops = Math.min(Math.max(Math.floor(maxStops ?? 80), 1), 150);
    const limitedCandidates = mappedCandidates.slice(0, effectiveMaxStops);
    const skippedBookingIds = mappedCandidates
      .slice(effectiveMaxStops)
      .map((candidate) => candidate.bookingId);

    const groupedCandidates = new Map<
      string,
      {
        priorityBucket: number;
        windowBucket: number | null;
        candidates: DispatchRouteCandidate[];
      }
    >();

    for (const candidate of limitedCandidates) {
      const priorityBucket = routingPriorityBucket(candidate.dispatchPriority);
      const windowMinutes = parseWindowToMinutes(candidate.serviceWindowStart);
      const windowBucket = windowMinutes === null ? null : Math.floor(windowMinutes / 120);
      const key = `${priorityBucket}:${windowBucket ?? "none"}`;

      if (!groupedCandidates.has(key)) {
        groupedCandidates.set(key, {
          priorityBucket,
          windowBucket,
          candidates: [],
        });
      }
      groupedCandidates.get(key)?.candidates.push(candidate);
    }

    const orderedGroups = Array.from(groupedCandidates.values()).sort((left, right) => {
      if (left.priorityBucket !== right.priorityBucket) {
        return left.priorityBucket - right.priorityBucket;
      }

      if (left.windowBucket === null && right.windowBucket !== null) return 1;
      if (left.windowBucket !== null && right.windowBucket === null) return -1;
      if (left.windowBucket === null && right.windowBucket === null) return 0;
      return (left.windowBucket ?? 0) - (right.windowBucket ?? 0);
    });

    const orderedCandidates: DispatchRouteCandidate[] = [];
    let anchor: DispatchRouteCandidate | null = null;
    for (const group of orderedGroups) {
      const orderedGroup = orderCandidatesWithinGroup(group.candidates, anchor);
      orderedCandidates.push(...orderedGroup);
      anchor = orderedGroup[orderedGroup.length - 1] ?? anchor;
    }

    const directionsToken =
      process.env.MAPBOX_DIRECTIONS_TOKEN ??
      process.env.MAPBOX_GEOCODING_TOKEN ??
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const routeGeometry = await buildRouteGeometry(directionsToken, orderedCandidates);

    return {
      date,
      totalVisibleStops: routeScope.length,
      mappedStops: mappedCandidates.length,
      tokenConfigured: Boolean(directionsToken),
      provider: routeGeometry.provider,
      orderedBookingIds: orderedCandidates.map((candidate) => candidate.bookingId),
      skippedBookingIds,
      unmappedBookingIds: routeScope
        .filter((booking) => !hasCoordinates(booking.location))
        .map((booking) => booking._id),
      routeCoordinates: routeGeometry.routeCoordinates,
      totalDistanceMeters: routeGeometry.totalDistanceMeters,
      totalDurationSeconds: routeGeometry.totalDurationSeconds,
    };
  },
});

const dispatchGeocodeJobStatusValidator = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("retry"),
  v.literal("completed"),
  v.literal("failed")
);

const dispatchGeocodeJobReasonValidator = v.union(
  v.literal("booking_created"),
  v.literal("customer_address_updated"),
  v.literal("manual_refresh"),
  v.literal("backfill_sweep")
);

export const getDispatchGeocodeContext = internalQuery({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) return null;

    const customer = booking.customerId ? await ctx.db.get(booking.customerId) : null;
    const bookingRequest = booking.bookingRequestId
      ? await ctx.db.get(booking.bookingRequestId)
      : null;
    const quote = bookingRequest?.quoteRequestId
      ? await ctx.db.get(bookingRequest.quoteRequestId)
      : null;

    const snapshot = booking.locationSnapshot ?? {};
    const customerAddress = customer?.address
      ? {
          street: customer.address.street,
          addressLine2: customer.address.addressLine2,
          city: customer.address.city,
          state: customer.address.state,
          postalCode: customer.address.postalCode,
        }
      : undefined;
    const quoteAddress = quote
      ? {
          street: quote.address,
          addressLine2: quote.addressLine2,
          city: quote.city,
          state: quote.state,
          postalCode: quote.postalCode,
        }
      : undefined;
    const fallbackAddress: AddressLike = customerAddress ?? quoteAddress ?? {};

    const address: AddressLike = {
      street: snapshot.street ?? fallbackAddress.street,
      addressLine2: snapshot.addressLine2 ?? fallbackAddress.addressLine2,
      city: snapshot.city ?? fallbackAddress.city,
      state: snapshot.state ?? fallbackAddress.state,
      postalCode: snapshot.postalCode ?? fallbackAddress.postalCode,
    };

    return {
      bookingId: booking._id,
      organizationId: booking.organizationId,
      address,
      addressLine: addressToLine(address),
      currentSnapshot: {
        latitude: snapshot.latitude,
        longitude: snapshot.longitude,
      },
    };
  },
});

export const enqueueDispatchGeocodeJob = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    reason: v.optional(dispatchGeocodeJobReasonValidator),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { bookingId, reason, force }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) {
      return null;
    }

    const now = Date.now();
    const existingJobs = await ctx.db
      .query("dispatchGeocodeJobs")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .collect();
    const existingJob =
      existingJobs.length > 0
        ? [...existingJobs].sort((left, right) => right.updatedAt - left.updatedAt)[0]
        : null;

    if (
      existingJob &&
      !force &&
      (existingJob.status === "queued" ||
        existingJob.status === "retry" ||
        existingJob.status === "processing")
    ) {
      return existingJob._id;
    }

    if (existingJob) {
      await ctx.db.patch(existingJob._id, {
        organizationId: booking.organizationId,
        status: "queued",
        reason: reason ?? existingJob.reason,
        attempts: 0,
        nextAttemptAt: now,
        lockedAt: undefined,
        completedAt: undefined,
        addressLine: undefined,
        addressHash: undefined,
        lastError: undefined,
        updatedAt: now,
      });
      return existingJob._id;
    }

    return await ctx.db.insert("dispatchGeocodeJobs", {
      organizationId: booking.organizationId,
      bookingId,
      status: "queued",
      reason,
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const enqueueDispatchGeocodeJobsBatch = internalMutation({
  args: {
    bookingIds: v.array(v.id("bookings")),
    reason: v.optional(dispatchGeocodeJobReasonValidator),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { bookingIds, reason, force }) => {
    let queued = 0;
    for (const bookingId of bookingIds) {
      const result = await ctx.runMutation(internal.schedule.enqueueDispatchGeocodeJob, {
        bookingId,
        reason,
        force,
      });
      if (result) {
        queued += 1;
      }
    }
    return { queued };
  },
});

export const listDispatchGeocodeJobsDue = internalQuery({
  args: {
    limit: v.number(),
    nowMs: v.number(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { limit, nowMs, organizationId }) => {
    const effectiveLimit = Math.min(Math.max(limit, 1), 500);
    const statuses: DispatchGeocodeJobStatus[] = ["queued", "retry"];
    const batches = await Promise.all(
      statuses.map((status) =>
        organizationId
          ? ctx.db
              .query("dispatchGeocodeJobs")
              .withIndex("by_org_status_next_attempt", (q) =>
                q
                  .eq("organizationId", organizationId)
                  .eq("status", status)
                  .lte("nextAttemptAt", nowMs)
              )
              .take(effectiveLimit)
          : ctx.db
              .query("dispatchGeocodeJobs")
              .withIndex("by_status_next_attempt", (q) =>
                q.eq("status", status).lte("nextAttemptAt", nowMs)
              )
              .take(effectiveLimit)
      )
    );

    return batches
      .flat()
      .sort((left, right) => {
        if (left.nextAttemptAt !== right.nextAttemptAt) {
          return left.nextAttemptAt - right.nextAttemptAt;
        }
        return left.createdAt - right.createdAt;
      })
      .slice(0, effectiveLimit);
  },
});

export const markDispatchGeocodeJobProcessing = internalMutation({
  args: {
    jobId: v.id("dispatchGeocodeJobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return false;
    if (!(job.status === "queued" || job.status === "retry")) {
      return false;
    }

    await ctx.db.patch(jobId, {
      status: "processing",
      lockedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const finishDispatchGeocodeJob = internalMutation({
  args: {
    jobId: v.id("dispatchGeocodeJobs"),
    status: dispatchGeocodeJobStatusValidator,
    attempts: v.number(),
    nextAttemptAt: v.optional(v.number()),
    addressLine: v.optional(v.string()),
    addressHash: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { jobId, status, attempts, nextAttemptAt, addressLine, addressHash, lastError }
  ) => {
    const job = await ctx.db.get(jobId);
    if (!job) return null;

    await ctx.db.patch(jobId, {
      status,
      attempts,
      nextAttemptAt: nextAttemptAt ?? job.nextAttemptAt,
      lockedAt: undefined,
      completedAt: status === "completed" || status === "failed" ? Date.now() : undefined,
      addressLine,
      addressHash,
      lastError,
      updatedAt: Date.now(),
    });
    return jobId;
  },
});

export const seedDispatchGeocodeJobsInternal = internalAction({
  args: {
    limit: v.optional(v.number()),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { limit, organizationId }): Promise<GeocodeSeedSummary> => {
    const effectiveLimit = Math.min(Math.max(limit ?? 250, 1), 2000);
    const candidates = (await ctx.runQuery(
      internal.schedule.getBackfillCandidates as any,
      {
        limit: effectiveLimit,
        organizationId,
      }
    )) as Array<{ bookingId: Id<"bookings"> }>;

    let queued = 0;
    for (const candidate of candidates) {
      const jobId = await ctx.runMutation(internal.schedule.enqueueDispatchGeocodeJob, {
        bookingId: candidate.bookingId,
        reason: "backfill_sweep",
      });
      if (jobId) {
        queued += 1;
      }
    }

    return {
      scanned: candidates.length,
      queued,
    };
  },
});

export const processDispatchGeocodeJobsInternal = internalAction({
  args: {
    limit: v.optional(v.number()),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (
    ctx,
    { limit, organizationId }
  ): Promise<GeocodeProcessSummary> => {
    const now = Date.now();
    const effectiveLimit = Math.min(Math.max(limit ?? 250, 1), 1000);
    const token =
      process.env.MAPBOX_GEOCODING_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const dueJobs = (await ctx.runQuery(
      internal.schedule.listDispatchGeocodeJobsDue as any,
      {
        limit: effectiveLimit,
        nowMs: now,
        organizationId,
      }
    )) as Doc<"dispatchGeocodeJobs">[];

    const summary = {
      due: dueJobs.length,
      processed: 0,
      geocoded: 0,
      retryScheduled: 0,
      failedPermanent: 0,
      missingAddress: 0,
      tokenMissing: 0,
    };

    for (const job of dueJobs) {
      const locked = await ctx.runMutation(internal.schedule.markDispatchGeocodeJobProcessing, {
        jobId: job._id,
      });
      if (!locked) continue;
      summary.processed += 1;

      const attempts = (job.attempts ?? 0) + 1;
      const context = await ctx.runQuery(internal.schedule.getDispatchGeocodeContext, {
        bookingId: job.bookingId,
      });
      if (!context) {
        summary.failedPermanent += 1;
        await ctx.runMutation(internal.schedule.finishDispatchGeocodeJob, {
          jobId: job._id,
          status: "failed",
          attempts,
          lastError: "booking_not_found",
        });
        continue;
      }

      const addressLine = context.addressLine;
      const addressHash = addressLine ? stableAddressHash(addressLine) : undefined;

      if (!addressLine) {
        summary.missingAddress += 1;
        summary.failedPermanent += 1;
        await ctx.runMutation(internal.schedule.patchLocationSnapshot, {
          bookingId: job.bookingId,
          locationSnapshot: {
            ...context.address,
            latitude: context.currentSnapshot?.latitude,
            longitude: context.currentSnapshot?.longitude,
            geocodeStatus: "missing_address",
            geocodedAt: Date.now(),
            provider: "mapbox",
          },
        });
        await ctx.runMutation(internal.schedule.finishDispatchGeocodeJob, {
          jobId: job._id,
          status: "failed",
          attempts,
          addressLine: undefined,
          addressHash: undefined,
          lastError: "missing_address",
        });
        continue;
      }

      if (!token) {
        summary.tokenMissing += 1;
        const shouldFail = attempts >= MAX_DISPATCH_GEOCODE_ATTEMPTS;
        if (!shouldFail) {
          summary.retryScheduled += 1;
        } else {
          summary.failedPermanent += 1;
        }
        await ctx.runMutation(internal.schedule.patchLocationSnapshot, {
          bookingId: job.bookingId,
          locationSnapshot: {
            ...context.address,
            latitude: context.currentSnapshot?.latitude,
            longitude: context.currentSnapshot?.longitude,
            geocodeStatus: "failed",
            geocodedAt: Date.now(),
            provider: "mapbox",
          },
        });
        await ctx.runMutation(internal.schedule.finishDispatchGeocodeJob, {
          jobId: job._id,
          status: shouldFail ? "failed" : "retry",
          attempts,
          nextAttemptAt: shouldFail ? undefined : Date.now() + nextRetryDelayMs(attempts),
          addressLine,
          addressHash,
          lastError: "mapbox_token_missing",
        });
        continue;
      }

      try {
        const geocode = await geocodeWithMapbox(token, addressLine);
        if (!geocode) {
          const shouldFail = attempts >= MAX_DISPATCH_GEOCODE_ATTEMPTS;
          if (!shouldFail) {
            summary.retryScheduled += 1;
          } else {
            summary.failedPermanent += 1;
          }
          await ctx.runMutation(internal.schedule.patchLocationSnapshot, {
            bookingId: job.bookingId,
            locationSnapshot: {
              ...context.address,
              latitude: context.currentSnapshot?.latitude,
              longitude: context.currentSnapshot?.longitude,
              geocodeStatus: "failed",
              geocodedAt: Date.now(),
              provider: "mapbox",
            },
          });
          await ctx.runMutation(internal.schedule.finishDispatchGeocodeJob, {
            jobId: job._id,
            status: shouldFail ? "failed" : "retry",
            attempts,
            nextAttemptAt: shouldFail ? undefined : Date.now() + nextRetryDelayMs(attempts),
            addressLine,
            addressHash,
            lastError: "geocode_no_result",
          });
          continue;
        }

        summary.geocoded += 1;
        await ctx.runMutation(internal.schedule.patchLocationSnapshot, {
          bookingId: job.bookingId,
          locationSnapshot: {
            ...context.address,
            latitude: geocode.latitude,
            longitude: geocode.longitude,
            geocodeStatus: "geocoded",
            geocodedAt: Date.now(),
            provider: "mapbox",
          },
        });
        await ctx.runMutation(internal.schedule.finishDispatchGeocodeJob, {
          jobId: job._id,
          status: "completed",
          attempts,
          addressLine,
          addressHash,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "geocode_request_failed";
        const shouldFail = attempts >= MAX_DISPATCH_GEOCODE_ATTEMPTS;
        if (!shouldFail) {
          summary.retryScheduled += 1;
        } else {
          summary.failedPermanent += 1;
        }
        await ctx.runMutation(internal.schedule.finishDispatchGeocodeJob, {
          jobId: job._id,
          status: shouldFail ? "failed" : "retry",
          attempts,
          nextAttemptAt: shouldFail ? undefined : Date.now() + nextRetryDelayMs(attempts),
          addressLine,
          addressHash,
          lastError: message,
        });
      }
    }

    return summary;
  },
});

export const dispatchGeocodeSweepInternal = internalAction({
  args: {
    seedLimit: v.optional(v.number()),
    processLimit: v.optional(v.number()),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (
    ctx,
    { seedLimit, processLimit, organizationId }
  ): Promise<GeocodeSweepSummary> => {
    const seeded = (await ctx.runAction(
      internal.schedule.seedDispatchGeocodeJobsInternal as any,
      {
        limit: seedLimit,
        organizationId,
      }
    )) as GeocodeSeedSummary;
    const processed = (await ctx.runAction(
      internal.schedule.processDispatchGeocodeJobsInternal as any,
      {
        limit: processLimit,
        organizationId,
      }
    )) as GeocodeProcessSummary;

    return {
      seedScanned: seeded.scanned,
      seedQueued: seeded.queued,
      ...processed,
    };
  },
});

export const runDispatchGeocodeSweep = action({
  args: {
    seedLimit: v.optional(v.number()),
    processLimit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { seedLimit, processLimit }
  ): Promise<GeocodeSweepSummary> => {
    const { organization } = await requireActiveOrganization(ctx);
    return (await ctx.runAction(
      internal.schedule.dispatchGeocodeSweepInternal as any,
      {
        organizationId: organization._id,
        seedLimit,
        processLimit,
      }
    )) as GeocodeSweepSummary;
  },
});

export const updateDispatchMeta = mutation({
  args: {
    bookingId: v.id("bookings"),
    serviceDate: v.optional(v.string()),
    serviceWindowStart: v.optional(v.string()),
    serviceWindowEnd: v.optional(v.string()),
    estimatedDurationMinutes: v.optional(v.number()),
    dispatchPriority: v.optional(dispatchPriorityValidator),
    dispatchOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    assertRecordInActiveOrg(booking.organizationId, organization._id);

    const updates: Record<string, string | number> = {};
    if (args.serviceDate !== undefined) {
      updates.serviceDate = args.serviceDate;
    }
    if (args.serviceWindowStart !== undefined) {
      updates.serviceWindowStart = args.serviceWindowStart;
    }
    if (args.serviceWindowEnd !== undefined) {
      updates.serviceWindowEnd = args.serviceWindowEnd;
    }
    if (args.estimatedDurationMinutes !== undefined) {
      updates.estimatedDurationMinutes = args.estimatedDurationMinutes;
    }
    if (args.dispatchPriority !== undefined) {
      updates.dispatchPriority = args.dispatchPriority;
    }
    if (args.dispatchOrder !== undefined) {
      updates.dispatchOrder = args.dispatchOrder;
    }

    if (Object.keys(updates).length === 0) {
      throw new Error("No dispatch fields provided");
    }

    await ctx.db.patch(args.bookingId, {
      ...updates,
      updatedAt: Date.now(),
    });

    const scheduleFieldsChanged =
      args.serviceDate !== undefined ||
      args.serviceWindowStart !== undefined ||
      args.serviceWindowEnd !== undefined;
    if (scheduleFieldsChanged) {
      await ctx.runMutation(internal.bookingStateMachine.recomputeScheduledState, {
        bookingId: args.bookingId,
        source: "schedule.updateDispatchMeta",
      });
    }

    return args.bookingId;
  },
});

export const reorderDispatch = mutation({
  args: {
    date: v.string(),
    orderedBookingIds: v.array(v.id("bookings")),
  },
  handler: async (ctx, { date, orderedBookingIds }) => {
    const { organization } = await requireActiveOrganization(ctx);
    if (orderedBookingIds.length === 0) {
      return { updated: 0 };
    }

    const unique = new Set(orderedBookingIds);
    if (unique.size !== orderedBookingIds.length) {
      throw new Error("orderedBookingIds contains duplicates");
    }

    const bookings = await Promise.all(orderedBookingIds.map((id) => ctx.db.get(id)));
    for (const booking of bookings) {
      if (!booking) {
        throw new Error("One or more bookings were not found");
      }
      assertRecordInActiveOrg(booking.organizationId, organization._id);
      if (booking.serviceDate !== date) {
        throw new Error("All reordered bookings must belong to the provided date");
      }
    }

    await Promise.all(
      orderedBookingIds.map((bookingId, index) =>
        ctx.db.patch(bookingId, {
          dispatchOrder: index,
          updatedAt: Date.now(),
        })
      )
    );

    return { updated: orderedBookingIds.length };
  },
});

export const getBackfillCandidates = internalQuery({
  args: {
    limit: v.number(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { limit, organizationId }) => {
    const sampleSize = Math.max(limit * 5, 200);
    const staleThreshold = 90 * 24 * 60 * 60 * 1000;
    const allBookings = organizationId
      ? await ctx.db
          .query("bookings")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
          .order("desc")
          .take(sampleSize)
      : await ctx.db.query("bookings").order("desc").take(sampleSize);

    const customerCache = new Map<Id<"customers">, Doc<"customers"> | null>();
    const requestCache = new Map<Id<"bookingRequests">, Doc<"bookingRequests"> | null>();
    const quoteCache = new Map<Id<"quoteRequests">, Doc<"quoteRequests"> | null>();

    const candidates: Array<{
      bookingId: Id<"bookings">;
      address: AddressLike;
      currentSnapshot?: {
        latitude?: number;
        longitude?: number;
      };
    }> = [];

    for (const booking of allBookings) {
      if (candidates.length >= limit) break;

      const snapshot = booking.locationSnapshot;
      const isMapped = hasCoordinates(snapshot);
      const isStale = Boolean(
        snapshot?.geocodedAt && Date.now() - snapshot.geocodedAt > staleThreshold
      );
      if (isMapped && !isStale) {
        continue;
      }

      let address: AddressLike = {
        street: snapshot?.street,
        addressLine2: snapshot?.addressLine2,
        city: snapshot?.city,
        state: snapshot?.state,
        postalCode: snapshot?.postalCode,
      };

      if (!hasAddress(address) && booking.customerId) {
        if (!customerCache.has(booking.customerId)) {
          const customer = await ctx.db.get(booking.customerId);
          customerCache.set(booking.customerId, customer);
        }
        const customer = customerCache.get(booking.customerId);
        if (customer?.address) {
          address = {
            street: customer.address.street,
            addressLine2: customer.address.addressLine2,
            city: customer.address.city,
            state: customer.address.state,
            postalCode: customer.address.postalCode,
          };
        }
      }

      if (!hasAddress(address) && booking.bookingRequestId) {
        if (!requestCache.has(booking.bookingRequestId)) {
          const request = await ctx.db.get(booking.bookingRequestId);
          requestCache.set(booking.bookingRequestId, request);
        }
        const request = requestCache.get(booking.bookingRequestId);
        if (request?.quoteRequestId) {
          if (!quoteCache.has(request.quoteRequestId)) {
            const quote = await ctx.db.get(request.quoteRequestId);
            quoteCache.set(request.quoteRequestId, quote);
          }
          const quote = quoteCache.get(request.quoteRequestId);
          if (quote) {
            address = {
              street: quote.address,
              addressLine2: quote.addressLine2,
              city: quote.city,
              state: quote.state,
              postalCode: quote.postalCode,
            };
          }
        }
      }

      candidates.push({
        bookingId: booking._id,
        address,
        currentSnapshot: {
          latitude: snapshot?.latitude,
          longitude: snapshot?.longitude,
        },
      });
    }

    return candidates;
  },
});

export const patchLocationSnapshot = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    locationSnapshot: locationSnapshotValidator,
  },
  handler: async (ctx, { bookingId, locationSnapshot }) => {
    await ctx.db.patch(bookingId, {
      locationSnapshot,
      updatedAt: Date.now(),
    });
    return bookingId;
  },
});

type BackfillSummary = {
  dryRun: boolean;
  tokenConfigured: boolean;
  processed: number;
  geocoded: number;
  failed: number;
  missingAddress: number;
  skipped: number;
};

async function runBackfill(
  ctx: {
    runQuery: (...args: any[]) => Promise<any>;
    runMutation: (...args: any[]) => Promise<any>;
  },
  organizationId?: Id<"organizations">,
  limit?: number,
  dryRun?: boolean
): Promise<BackfillSummary> {
  const effectiveLimit = Math.min(Math.max(limit ?? 100, 1), 500);
  const shouldDryRun = dryRun ?? false;
  const token = process.env.MAPBOX_GEOCODING_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const candidates = await ctx.runQuery(internal.schedule.getBackfillCandidates, {
    limit: effectiveLimit,
    organizationId,
  });

  const summary: BackfillSummary = {
    dryRun: shouldDryRun,
    tokenConfigured: Boolean(token),
    processed: 0,
    geocoded: 0,
    failed: 0,
    missingAddress: 0,
    skipped: 0,
  };

  for (const candidate of candidates) {
    summary.processed += 1;
    const addressLine = addressToLine(candidate.address);
    const now = Date.now();

    if (!addressLine) {
      summary.missingAddress += 1;
      if (!shouldDryRun) {
        await ctx.runMutation(internal.schedule.patchLocationSnapshot, {
          bookingId: candidate.bookingId,
          locationSnapshot: {
            ...candidate.address,
            latitude: candidate.currentSnapshot?.latitude,
            longitude: candidate.currentSnapshot?.longitude,
            geocodeStatus: "missing_address",
            geocodedAt: now,
            provider: "mapbox",
          },
        });
      }
      continue;
    }

    if (!token) {
      summary.failed += 1;
      if (!shouldDryRun) {
        await ctx.runMutation(internal.schedule.patchLocationSnapshot, {
          bookingId: candidate.bookingId,
          locationSnapshot: {
            ...candidate.address,
            latitude: candidate.currentSnapshot?.latitude,
            longitude: candidate.currentSnapshot?.longitude,
            geocodeStatus: "failed",
            geocodedAt: now,
            provider: "mapbox",
          },
        });
      }
      continue;
    }

    try {
      const geocode = await geocodeWithMapbox(token, addressLine);
      if (!geocode) {
        summary.failed += 1;
        if (!shouldDryRun) {
          await ctx.runMutation(internal.schedule.patchLocationSnapshot, {
            bookingId: candidate.bookingId,
            locationSnapshot: {
              ...candidate.address,
              geocodeStatus: "failed",
              geocodedAt: now,
              provider: "mapbox",
            },
          });
        }
        continue;
      }

      summary.geocoded += 1;
      if (!shouldDryRun) {
        await ctx.runMutation(internal.schedule.patchLocationSnapshot, {
          bookingId: candidate.bookingId,
          locationSnapshot: {
            ...candidate.address,
            latitude: geocode.latitude,
            longitude: geocode.longitude,
            geocodeStatus: "geocoded",
            geocodedAt: now,
            provider: "mapbox",
          },
        });
      }
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

export const backfillDispatchLocationsInternal = internalAction({
  args: {
    organizationId: v.optional(v.id("organizations")),
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { organizationId, limit, dryRun }): Promise<BackfillSummary> => {
    return await runBackfill(ctx, organizationId, limit, dryRun);
  },
});

export const backfillDispatchLocations = action({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { limit, dryRun }): Promise<BackfillSummary> => {
    const { organization } = await requireActiveOrganization(ctx);
    return await runBackfill(ctx, organization._id, limit, dryRun);
  },
});

/**
 * Get available cleaners for a specific date.
 * Checks weekly availability and excludes cleaners with approved time off.
 */
export const getAvailableCleanersForDate = query({
  args: {
    date: v.string(), // ISO date string "YYYY-MM-DD"
  },
  handler: async (ctx, { date }) => {
    const { organization } = await requireActiveOrganization(ctx);
    const dateObj = new Date(date + "T00:00:00");
    const dayOfWeek = dateObj.getDay();

    const cleaners = await ctx.db
      .query("cleaners")
      .withIndex("by_status_and_org", (q) =>
        q.eq("status", "active").eq("organizationId", organization._id)
      )
      .collect();

    const approvedTimeOffByCleaner = await Promise.all(
      cleaners.map((cleaner) =>
        ctx.db
          .query("cleanerTimeOff")
          .withIndex("by_cleaner_status", (q) =>
            q.eq("cleanerId", cleaner._id).eq("status", "approved")
          )
          .collect()
      )
    );

    const cleanersOnTimeOff = new Set(
      approvedTimeOffByCleaner
        .flat()
        .filter((timeOff) => timeOff.startDate <= date && timeOff.endDate >= date)
        .map((timeOff) => timeOff.cleanerId)
    );

    const availabilities = await Promise.all(
      cleaners.map(async (cleaner) => {
        const availability = await ctx.db
          .query("cleanerAvailability")
          .withIndex("by_cleaner_day", (q) =>
            q.eq("cleanerId", cleaner._id).eq("dayOfWeek", dayOfWeek)
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();
        return { cleaner, availability };
      })
    );

    const bookingsForDate = await ctx.db
      .query("bookings")
      .withIndex("by_org_service_date", (q) =>
        q.eq("organizationId", organization._id).eq("serviceDate", date)
      )
      .collect();
    const bookingIds = bookingsForDate.map((booking) => booking._id);

    const allAssignments = await Promise.all(
      bookingIds.map((bookingId) =>
        ctx.db
          .query("bookingAssignments")
          .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
          .collect()
      )
    );

    const assignmentCounts = new Map<string, number>();
    allAssignments.flat().forEach((assignment) => {
      if (!assignment.cleanerId) return;
      const current = assignmentCounts.get(assignment.cleanerId) ?? 0;
      assignmentCounts.set(assignment.cleanerId, current + 1);
    });

    return availabilities
      .filter(({ cleaner, availability }) => {
        if (!availability) return false;
        if (cleanersOnTimeOff.has(cleaner._id)) return false;
        return true;
      })
      .map(({ cleaner, availability }) => ({
        cleaner,
        availability: {
          startTime: availability!.startTime,
          endTime: availability!.endTime,
          timezone: availability!.timezone,
        },
        assignmentCount: assignmentCounts.get(cleaner._id) ?? 0,
      }));
  },
});

/**
 * Get a cleaner's schedule for a date range.
 */
export const getCleanerScheduleRange = query({
  args: {
    cleanerId: v.id("cleaners"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { cleanerId, startDate, endDate }) => {
    const { organization } = await requireActiveOrganization(ctx);
    const cleaner = await ctx.db.get(cleanerId);
    if (!cleaner) {
      return [];
    }
    assertRecordInActiveOrg(cleaner.organizationId, organization._id);

    const assignments = await ctx.db
      .query("bookingAssignments")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();

    const bookingIds = assignments.map((assignment) => assignment.bookingId);
    const bookings = await Promise.all(bookingIds.map((id) => ctx.db.get(id)));

    return bookings
      .filter((booking): booking is NonNullable<typeof booking> => {
        if (!booking || !booking.serviceDate) return false;
        if (booking.organizationId !== organization._id) return false;
        return booking.serviceDate >= startDate && booking.serviceDate <= endDate;
      })
      .map((booking) => {
        const assignment = assignments.find((item) => item.bookingId === booking._id);
        return { booking, assignment };
      });
  },
});
