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

    const allBookings = status
      ? await ctx.db
          .query("bookings")
          .withIndex("by_org_status", (q) =>
            q.eq("organizationId", organization._id).eq("status", status)
          )
          .collect()
      : await ctx.db
          .query("bookings")
          .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
          .collect();

    return allBookings.filter((b) => {
      if (!b.serviceDate) return false;
      return b.serviceDate >= startDate && b.serviceDate <= endDate;
    });
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

    const orgBookings = await ctx.db
      .query("bookings")
      .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
      .collect();
    const dayBookings = orgBookings.filter((booking) => {
      if (booking.serviceDate !== date) {
        return false;
      }
      if (status && booking.status !== status) {
        return false;
      }
      return true;
    });

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

    const approvedTimeOff = await ctx.db
      .query("cleanerTimeOff")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    const timeOffOnDate = approvedTimeOff.filter((timeOff) => {
      return timeOff.startDate <= date && timeOff.endDate >= date;
    });
    const cleanersOnTimeOff = new Set(timeOffOnDate.map((timeOff) => timeOff.cleanerId));

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

    const bookingsForDate = (
      await ctx.db
        .query("bookings")
        .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
        .collect()
    ).filter((booking) => booking.serviceDate === date);
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
