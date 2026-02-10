import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
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
  "../customers.ts": () => import("../customers"),
};

async function insertBooking(
  t: ReturnType<typeof convexTest>,
  overrides: Partial<{
    status: string;
    serviceDate: string;
    serviceWindowStart: string;
    serviceWindowEnd: string;
    organizationId: Id<"organizations">;
  }> = {}
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    return await ctx.db.insert("bookings", {
      organizationId: overrides.organizationId,
      email: "customer@example.com",
      customerName: "Customer",
      status: overrides.status ?? "pending_card",
      serviceDate: overrides.serviceDate,
      serviceWindowStart: overrides.serviceWindowStart,
      serviceWindowEnd: overrides.serviceWindowEnd,
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function insertUser(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: `clerk_${now}_${Math.random().toString(36).slice(2, 8)}`,
      email: `ops_${now}@example.com`,
      firstName: "Ops",
      lastName: "Admin",
    });

    return userId;
  });
}

describe.sequential("booking state machine", () => {
  it("allows valid transitions and rejects invalid transitions in strict mode", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createTestOrganization(t);
    const bookingId = await insertBooking(t, { organizationId });

    const previousStrictMode = process.env.BOOKING_STATE_MACHINE_STRICT;
    process.env.BOOKING_STATE_MACHINE_STRICT = "true";

    try {
      await t.mutation(internal.bookingStateMachine.transitionBookingStatus, {
        bookingId,
        toStatus: "card_saved",
        source: "test",
      });

      await expect(
        t.mutation(internal.bookingStateMachine.transitionBookingStatus, {
          bookingId,
          toStatus: "charged",
          source: "test",
        })
      ).rejects.toThrow("Invalid booking transition");

      const after = await t.run(async (ctx) => {
        const booking = await ctx.db.get(bookingId);
        const events = await ctx.db
          .query("bookingLifecycleEvents")
          .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
          .collect();
        return { booking, events };
      });

      expect(after.booking?.status).toBe("card_saved");
      expect(after.events.length).toBe(1);
      expect(after.events[0]?.eventType).toBe("transition");
    } finally {
      process.env.BOOKING_STATE_MACHINE_STRICT = previousStrictMode;
    }
  });

  it("supports audited override transitions with a required reason", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createTestOrganization(t);
    const bookingId = await insertBooking(t, { status: "charged", organizationId });
    const actorUserId = await insertUser(t);

    await expect(
      t.mutation(internal.bookingStateMachine.transitionBookingStatus, {
        bookingId,
        toStatus: "cancelled",
        source: "bookings.adminOverrideBookingStatus",
        allowOverride: true,
        actorUserId,
      })
    ).rejects.toThrow("Override transitions require a reason");

    await expect(
      t.mutation(internal.bookingStateMachine.transitionBookingStatus, {
        bookingId,
        toStatus: "cancelled",
        source: "bookings.cancelBooking",
        allowOverride: true,
        reason: "manual correction",
        actorUserId,
      })
    ).rejects.toThrow("Override transition source is not allowed");

    await t.mutation(internal.bookingStateMachine.transitionBookingStatus, {
      bookingId,
      toStatus: "cancelled",
      source: "bookings.adminOverrideBookingStatus",
      allowOverride: true,
      reason: "manual correction",
      actorUserId,
    });

    const after = await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId);
      const events = await ctx.db
        .query("bookingLifecycleEvents")
        .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
        .collect();
      return { booking, events };
    });

    expect(after.booking?.status).toBe("cancelled");
    expect(after.events[0]?.eventType).toBe("override_transition");
  });

  it("allows cancellation only from pending_card, card_saved, or scheduled", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createTestOrganization(t);
    const cancellableBookingId = await insertBooking(t, {
      status: "scheduled",
      organizationId,
    });
    const blockedBookingId = await insertBooking(t, { status: "in_progress", organizationId });

    await t.mutation(api.bookings.cancelBooking, {
      bookingId: cancellableBookingId,
      reason: "Customer requested cancellation",
    });

    await expect(
      t.mutation(api.bookings.cancelBooking, {
        bookingId: blockedBookingId,
        reason: "Too late cancellation attempt",
      })
    ).rejects.toThrow("Cancellation is only allowed");

    const after = await t.run(async (ctx) => {
      const allowed = await ctx.db.get(cancellableBookingId);
      const blocked = await ctx.db.get(blockedBookingId);
      return { allowed, blocked };
    });

    expect(after.allowed?.status).toBe("cancelled");
    expect(after.blocked?.status).toBe("in_progress");
  });

  it("applies schedule gate promotion and demotion", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createTestOrganization(t);
    const bookingId = await insertBooking(t, {
      status: "card_saved",
      serviceDate: "2026-02-09",
      serviceWindowStart: "09:00",
      serviceWindowEnd: "12:00",
      organizationId,
    });

    const assignmentId = await t.run(async (ctx) => {
      return await ctx.db.insert("bookingAssignments", {
        bookingId,
        cleanerId: undefined,
        crewId: undefined,
        role: "primary",
        status: "pending",
        assignedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.mutation(internal.bookingStateMachine.recomputeScheduledState, {
      bookingId,
      source: "test",
    });

    let after = await t.run(async (ctx) => {
      return await ctx.db.get(bookingId);
    });
    expect(after?.status).toBe("scheduled");

    await t.run(async (ctx) => {
      await ctx.db.patch(assignmentId, {
        status: "cancelled",
        updatedAt: Date.now(),
      });
    });

    await t.mutation(internal.bookingStateMachine.recomputeScheduledState, {
      bookingId,
      source: "test",
    });

    after = await t.run(async (ctx) => {
      return await ctx.db.get(bookingId);
    });
    expect(after?.status).toBe("card_saved");
  });

  it("rolls booking status from assignments with any-start/all-finish behavior", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createTestOrganization(t);
    const bookingId = await insertBooking(t, {
      status: "scheduled",
      serviceDate: "2026-02-11",
      serviceWindowStart: "09:00",
      serviceWindowEnd: "12:00",
      organizationId,
    });

    const [assignmentA, assignmentB] = await t.run(async (ctx) => {
      const now = Date.now();
      const assignmentAId = await ctx.db.insert("bookingAssignments", {
        bookingId,
        cleanerId: undefined,
        crewId: undefined,
        role: "primary",
        status: "confirmed",
        assignedAt: now,
        confirmedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      const assignmentBId = await ctx.db.insert("bookingAssignments", {
        bookingId,
        cleanerId: undefined,
        crewId: undefined,
        role: "secondary",
        status: "confirmed",
        assignedAt: now,
        confirmedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      return [assignmentAId, assignmentBId] as const;
    });

    await t.mutation(api.cleaners.clockIn, { assignmentId: assignmentA });
    let booking = await t.run(async (ctx) => ctx.db.get(bookingId));
    expect(booking?.status).toBe("in_progress");

    await t.mutation(api.cleaners.clockIn, { assignmentId: assignmentB });
    await t.mutation(api.cleaners.clockOut, { assignmentId: assignmentA });
    booking = await t.run(async (ctx) => ctx.db.get(bookingId));
    expect(booking?.status).toBe("in_progress");

    await t.mutation(api.cleaners.clockOut, { assignmentId: assignmentB });
    booking = await t.run(async (ctx) => ctx.db.get(bookingId));
    expect(booking?.status).toBe("completed");
  });

  it("records reschedule lifecycle events and keeps status lifecycle-driven", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createTestOrganization(t);
    const bookingId = await insertBooking(t, {
      status: "card_saved",
      serviceDate: "2026-02-09",
      serviceWindowStart: "09:00",
      serviceWindowEnd: "11:00",
      organizationId,
    });

    await t.mutation(api.bookings.rescheduleBooking, {
      bookingId,
      newServiceDate: "2026-02-10",
      newWindowStart: "10:00",
      newWindowEnd: "12:00",
      reason: "Customer requested",
    });

    const after = await t.run(async (ctx) => {
      const booking = await ctx.db.get(bookingId);
      const events = await ctx.db
        .query("bookingLifecycleEvents")
        .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
        .collect();
      return { booking, events };
    });

    expect(after.booking?.serviceDate).toBe("2026-02-10");
    expect(after.events.some((event) => event.eventType === "rescheduled")).toBe(true);
  });

  it("backfills legacy failed bookings to payment_failed when payment evidence exists", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createTestOrganization(t);
    const bookingId = await insertBooking(t, { status: "failed", organizationId });

    await t.run(async (ctx) => {
      await ctx.db.insert("paymentIntents", {
        bookingId,
        stripePaymentIntentId: "pi_test_failed",
        stripeCustomerId: "cus_test",
        amount: 5000,
        currency: "usd",
        status: "failed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.action(internal.bookingStateMachine.backfillAndValidate, {
      dryRun: false,
    });

    const after = await t.run(async (ctx) => {
      return await ctx.db.get(bookingId);
    });

    expect(result.convertedLegacyFailed).toBe(1);
    expect(after?.status).toBe("payment_failed");
  });

  it("derives unified funnel stage for operational and pre-booking contexts", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createTestOrganization(t);

    const bookingId = await insertBooking(t, { status: "completed", organizationId });
    const bookingStage = await t.query(api.bookingLifecycle.getUnifiedFunnelStage, {
      bookingId,
    });
    expect(bookingStage?.funnelStage).toBe("service_completed");

    const now = Date.now();
    const quoteRequestId = await t.run(async (ctx) => {
      return await ctx.db.insert("quoteRequests", {
        organizationId,
        firstName: "Q",
        lastName: "R",
        email: "q@example.com",
        requestStatus: "quoted",
        createdAt: now,
        updatedAt: now,
      });
    });

    const requestId = await t.run(async (ctx) => {
      return await ctx.db.insert("bookingRequests", {
        organizationId,
        status: "requested",
        quoteRequestId,
        email: "q@example.com",
        createdAt: now,
        updatedAt: now,
      });
    });

    const preBookingStage = await t.query(api.bookingLifecycle.getUnifiedFunnelStage, {
      requestId,
    });

    expect(preBookingStage?.funnelStage).toBe("quoted");
    expect(preBookingStage?.operationalStatus).toBeNull();
  });

  it("recomputes customer stats on completed/charged transitions", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createTestOrganization(t);
    const now = Date.now();

    const customerId = await t.run(async (ctx) => {
      return await ctx.db.insert("customers", {
        organizationId,
        firstName: "Stats",
        lastName: "Hook",
        email: "hook@example.com",
        emailNormalized: "hook@example.com",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    });

    const bookingId = await t.run(async (ctx) => {
      return await ctx.db.insert("bookings", {
        organizationId,
        email: "hook@example.com",
        customerName: "Stats Hook",
        customerId,
        status: "in_progress",
        amount: 3600,
        serviceDate: "2026-02-09",
        createdAt: now,
        updatedAt: now,
      });
    });

    await t.mutation(internal.bookingStateMachine.transitionBookingStatus, {
      bookingId,
      toStatus: "completed",
      source: "test",
    });

    let customer = await t.run(async (ctx) => ctx.db.get(customerId));
    expect(customer?.totalBookings).toBe(1);
    expect(customer?.totalSpent).toBe(3600);

    await t.mutation(internal.bookingStateMachine.transitionBookingStatus, {
      bookingId,
      toStatus: "charged",
      source: "test",
    });

    customer = await t.run(async (ctx) => ctx.db.get(customerId));
    expect(customer?.totalBookings).toBe(1);
    expect(customer?.totalSpent).toBe(3600);
  });

  it("lists unified lifecycle rows with filtering and cursor pagination", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createTestOrganization(t);
    const base = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("bookings", {
        organizationId,
        email: "a@example.com",
        customerName: "Alpha",
        status: "card_saved",
        serviceDate: "2026-02-09",
        serviceType: "standard",
        amount: 12000,
        createdAt: base + 1,
        updatedAt: base + 1,
      });

      await ctx.db.insert("bookings", {
        organizationId,
        email: "b@example.com",
        customerName: "Beta",
        status: "completed",
        serviceDate: "2026-02-10",
        serviceType: "deep",
        amount: 19000,
        createdAt: base + 2,
        updatedAt: base + 2,
      });

      await ctx.db.insert("bookingRequests", {
        organizationId,
        status: "requested",
        email: "lead@example.com",
        contactDetails: "Lead Customer",
        createdAt: base + 3,
        updatedAt: base + 3,
      });
    });

    const firstPage = await t.query(api.bookingLifecycle.listUnifiedLifecycleRows, {
      limit: 2,
    });
    expect(firstPage.rows.length).toBe(2);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(firstPage.rows[0]?.rowType).toBe("pre_booking");

    const secondPage = await t.query(api.bookingLifecycle.listUnifiedLifecycleRows, {
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });
    expect(secondPage.rows.length).toBeGreaterThanOrEqual(1);
    expect(secondPage.rows.some((row: any) => row.rowType === "booking")).toBe(true);

    const filtered = await t.query(api.bookingLifecycle.listUnifiedLifecycleRows, {
      rowType: "booking",
      funnelStage: "service_completed",
      search: "beta",
      limit: 20,
    });

    expect(filtered.rows.length).toBe(1);
    expect(filtered.rows[0]?.customerName).toBe("Beta");
    expect(filtered.rows[0]?.funnelStage).toBe("service_completed");
  });

  it("returns lifecycle timeline rows with actor metadata and pagination", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await createTestOrganization(t);
    const bookingId = await insertBooking(t, { status: "card_saved", organizationId });
    const actorUserId = await insertUser(t);
    const base = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("bookingLifecycleEvents", {
        bookingId,
        eventType: "transition",
        fromStatus: "pending_card",
        toStatus: "card_saved",
        source: "test",
        actorUserId,
        createdAt: base + 1,
      });

      await ctx.db.insert("bookingLifecycleEvents", {
        bookingId,
        eventType: "rescheduled",
        fromStatus: "card_saved",
        toStatus: "card_saved",
        reason: "Customer asked",
        source: "test",
        fromServiceDate: "2026-02-10",
        toServiceDate: "2026-02-11",
        actorUserId,
        createdAt: base + 2,
      });

      await ctx.db.insert("bookingLifecycleEvents", {
        bookingId,
        eventType: "transition",
        fromStatus: "card_saved",
        toStatus: "scheduled",
        source: "test",
        createdAt: base + 3,
      });
    });

    const firstPage = await t.query(api.bookingLifecycle.getBookingLifecycleTimeline, {
      bookingId,
      limit: 2,
    });

    expect(firstPage.rows.length).toBe(2);
    expect(firstPage.rows[0]?.eventType).toBe("transition");
    expect(firstPage.rows[1]?.actorName).toBeTruthy();
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = await t.query(api.bookingLifecycle.getBookingLifecycleTimeline, {
      bookingId,
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });

    expect(secondPage.rows.length).toBe(1);
    expect(secondPage.rows[0]?.eventType).toBe("transition");
  });
});
