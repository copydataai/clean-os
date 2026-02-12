import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { createTestOrganization } from "./helpers/orgTestUtils";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../bookingStateMachine.ts": () => import("../bookingStateMachine"),
  "../bookingLifecycle.ts": () => import("../bookingLifecycle"),
  "../bookingDb.ts": () => import("../bookingDb"),
  "../bookings.ts": () => import("../bookings"),
  "../cleaners.ts": () => import("../cleaners"),
  "../queries.ts": () => import("../queries"),
  "../schedule.ts": () => import("../schedule"),
  "../customers.ts": () => import("../customers"),
};

async function createAuthedOrgClient(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  clerkOrgId: string
) {
  const clerkUserId = `authed_${Math.random().toString(36).slice(2, 10)}`;
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: clerkUserId,
      email: `${clerkUserId}@example.com`,
      firstName: "Test",
      lastName: "Authed",
    });
    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      organizationId,
      role: "owner",
    });
  });
  return t.withIdentity({
    subject: clerkUserId,
    orgId: clerkOrgId,
  });
}

describe.sequential("schedule dispatch query", () => {
  it("returns checklist rollups per booking in dispatch payload", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, clerkOrgId } = await createTestOrganization(t);
    const authed = await createAuthedOrgClient(t, organizationId, clerkOrgId);
    const now = Date.now();
    const date = "2026-02-13";

    const { bookingWithChecklistId, assignmentId, bookingWithoutChecklistId } = await t.run(
      async (ctx) => {
        const bookingWithChecklistId = await ctx.db.insert("bookings", {
          organizationId,
          email: "a@example.com",
          customerName: "Checklist Booking",
          status: "in_progress",
          serviceDate: date,
          createdAt: now,
          updatedAt: now,
        });
        const bookingWithoutChecklistId = await ctx.db.insert("bookings", {
          organizationId,
          email: "b@example.com",
          customerName: "No Checklist Booking",
          status: "scheduled",
          serviceDate: date,
          createdAt: now + 1,
          updatedAt: now + 1,
        });

        const assignmentId = await ctx.db.insert("bookingAssignments", {
          bookingId: bookingWithChecklistId,
          cleanerId: undefined,
          crewId: undefined,
          role: "primary",
          status: "in_progress",
          assignedAt: now,
          clockedInAt: now,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("bookingChecklistItems", {
          bookingAssignmentId: assignmentId,
          bookingId: bookingWithChecklistId,
          label: "Task 1",
          sortOrder: 1,
          isCompleted: true,
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("bookingChecklistItems", {
          bookingAssignmentId: assignmentId,
          bookingId: bookingWithChecklistId,
          label: "Task 2",
          sortOrder: 2,
          isCompleted: false,
          createdAt: now,
          updatedAt: now,
        });

        return { bookingWithChecklistId, assignmentId, bookingWithoutChecklistId };
      }
    );

    const dispatch = await authed.query(api.schedule.getDispatchDay, { date });
    const bookingWithChecklist = dispatch.bookings.find(
      (booking: any) => booking._id === bookingWithChecklistId
    );
    const bookingWithoutChecklist = dispatch.bookings.find(
      (booking: any) => booking._id === bookingWithoutChecklistId
    );

    expect(bookingWithChecklist).toBeTruthy();
    expect(bookingWithChecklist?.checklist).toEqual({
      total: 2,
      completed: 1,
      complete: false,
    });
    expect(bookingWithoutChecklist).toBeTruthy();
    expect(bookingWithoutChecklist?.checklist).toEqual({
      total: 0,
      completed: 0,
      complete: true,
    });

    const assignmentWithChecklist = bookingWithChecklist?.assignments.cleaners ?? [];
    expect(assignmentWithChecklist.length).toBe(0);
    expect(assignmentId).toBeTruthy();
  });

  it("suggests a constrained dispatch route and reports skipped/unmapped stops", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, clerkOrgId } = await createTestOrganization(t);
    const authed = await createAuthedOrgClient(t, organizationId, clerkOrgId);
    const now = Date.now();
    const date = "2026-02-14";

    const previousDirectionsToken = process.env.MAPBOX_DIRECTIONS_TOKEN;
    const previousGeocodingToken = process.env.MAPBOX_GEOCODING_TOKEN;
    const previousPublicToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    delete process.env.MAPBOX_DIRECTIONS_TOKEN;
    delete process.env.MAPBOX_GEOCODING_TOKEN;
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    try {
      const {
        urgentBookingId,
        highBookingId,
        normalWindowBookingId,
        lowBookingId,
        unmappedBookingId,
      } = await t.run(async (ctx) => {
        const urgentBookingId = await ctx.db.insert("bookings", {
          organizationId,
          email: "urgent@example.com",
          customerName: "Urgent stop",
          status: "scheduled",
          serviceDate: date,
          dispatchPriority: "urgent",
          locationSnapshot: {
            latitude: 37.7749,
            longitude: -122.4194,
            geocodeStatus: "geocoded",
          },
          createdAt: now,
          updatedAt: now,
        });

        const highBookingId = await ctx.db.insert("bookings", {
          organizationId,
          email: "high@example.com",
          customerName: "High stop",
          status: "scheduled",
          serviceDate: date,
          dispatchPriority: "high",
          locationSnapshot: {
            latitude: 37.8044,
            longitude: -122.2711,
            geocodeStatus: "geocoded",
          },
          createdAt: now + 1,
          updatedAt: now + 1,
        });

        const normalWindowBookingId = await ctx.db.insert("bookings", {
          organizationId,
          email: "window@example.com",
          customerName: "Window stop",
          status: "scheduled",
          serviceDate: date,
          dispatchPriority: "normal",
          serviceWindowStart: "09:00",
          locationSnapshot: {
            latitude: 37.3382,
            longitude: -121.8863,
            geocodeStatus: "geocoded",
          },
          createdAt: now + 2,
          updatedAt: now + 2,
        });

        const lowBookingId = await ctx.db.insert("bookings", {
          organizationId,
          email: "low@example.com",
          customerName: "Low stop",
          status: "scheduled",
          serviceDate: date,
          dispatchPriority: "low",
          locationSnapshot: {
            latitude: 38.5816,
            longitude: -121.4944,
            geocodeStatus: "geocoded",
          },
          createdAt: now + 3,
          updatedAt: now + 3,
        });

        const unmappedBookingId = await ctx.db.insert("bookings", {
          organizationId,
          email: "unmapped@example.com",
          customerName: "Unmapped stop",
          status: "scheduled",
          serviceDate: date,
          dispatchPriority: "normal",
          createdAt: now + 4,
          updatedAt: now + 4,
        });

        return {
          urgentBookingId,
          highBookingId,
          normalWindowBookingId,
          lowBookingId,
          unmappedBookingId,
        };
      });

      const suggestion = await authed.action(api.schedule.suggestDispatchRoute, {
        date,
        maxStops: 3,
      });

      expect(suggestion.totalVisibleStops).toBe(5);
      expect(suggestion.mappedStops).toBe(4);
      expect(suggestion.provider).toBe("fallback");
      expect(suggestion.tokenConfigured).toBe(false);

      expect(suggestion.orderedBookingIds).toEqual([
        urgentBookingId,
        highBookingId,
        normalWindowBookingId,
      ]);
      expect(suggestion.skippedBookingIds).toEqual([lowBookingId]);
      expect(suggestion.unmappedBookingIds).toEqual([unmappedBookingId]);
      expect(suggestion.routeCoordinates.length).toBe(3);
    } finally {
      process.env.MAPBOX_DIRECTIONS_TOKEN = previousDirectionsToken;
      process.env.MAPBOX_GEOCODING_TOKEN = previousGeocodingToken;
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN = previousPublicToken;
    }
  });

  it("queues and processes dispatch geocode jobs through organization sweep", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, clerkOrgId } = await createTestOrganization(t);
    const authed = await createAuthedOrgClient(t, organizationId, clerkOrgId);
    const now = Date.now();

    const bookingId = await authed.mutation(api.bookings.createBookingFromTally, {
      organizationId,
      email: "maps@example.com",
      customerName: "Map Customer",
      notes: "123 Test St, Austin, TX 78701",
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(bookingId, {
        locationSnapshot: {
          street: "123 Test St",
          city: "Austin",
          state: "TX",
          postalCode: "78701",
          geocodeStatus: "pending",
        },
        createdAt: now,
        updatedAt: now,
      });
    });

    const previousGeocodingToken = process.env.MAPBOX_GEOCODING_TOKEN;
    const previousPublicToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    delete process.env.MAPBOX_GEOCODING_TOKEN;
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    try {
      const summary = await authed.action(api.schedule.runDispatchGeocodeSweep, {
        seedLimit: 25,
        processLimit: 25,
      });

      expect(summary.seedQueued).toBeGreaterThanOrEqual(1);
      expect(summary.processed).toBeGreaterThanOrEqual(1);
      expect(summary.tokenMissing).toBeGreaterThanOrEqual(1);

      await t.run(async (ctx) => {
        const jobs = await ctx.db
          .query("dispatchGeocodeJobs")
          .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
          .collect();
        expect(jobs.length).toBeGreaterThanOrEqual(1);
        const latest = [...jobs].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        expect(["retry", "failed"]).toContain(latest.status);
      });
    } finally {
      process.env.MAPBOX_GEOCODING_TOKEN = previousGeocodingToken;
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN = previousPublicToken;
    }
  });
});
