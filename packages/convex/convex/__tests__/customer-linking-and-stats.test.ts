import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../customers.ts": () => import("../customers"),
  "../quoteRequests.ts": () => import("../quoteRequests"),
  "../bookingRequests.ts": () => import("../bookingRequests"),
  "../bookingStateMachine.ts": () => import("../bookingStateMachine"),
  "../bookingDb.ts": () => import("../bookingDb"),
  "../bookings.ts": () => import("../bookings"),
};

async function insertActorUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: `clerk_${Math.random().toString(36).slice(2, 10)}`,
      email: `ops_${Math.random().toString(36).slice(2, 10)}@example.com`,
      firstName: "Ops",
      lastName: "Admin",
    });
  });
}

describe.sequential("customer lifecycle linking + stats", () => {
  it("auto-creates customer from quote request and links customerId", async () => {
    const t = convexTest(schema, modules);

    const quoteRequestId = await t.mutation(internal.quoteRequests.createQuoteRequest, {
      firstName: "Jane",
      lastName: "Doe",
      email: "Jane.Doe+1@EXAMPLE.com",
      phone: "5551112222",
      serviceType: "Standard",
    });

    const result = await t.run(async (ctx) => {
      const quoteRequest = (await ctx.db.get(quoteRequestId as Id<"quoteRequests">)) as any;
      const customer = quoteRequest?.customerId
        ? ((await ctx.db.get(quoteRequest.customerId)) as any)
        : null;
      return { quoteRequest, customer };
    });

    expect(result.quoteRequest?.customerId).toBeDefined();
    expect(result.customer?.emailNormalized).toBe("jane.doe+1@example.com");
    expect(result.customer?.firstName).toBe("Jane");
    expect(result.customer?.lastName).toBe("Doe");
  });

  it("reuses oldest canonical customer for normalized email duplicates", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const ids = await t.run(async (ctx) => {
      const oldId = await ctx.db.insert("customers", {
        firstName: "Old",
        lastName: "Record",
        email: "dup@example.com",
        status: "lead",
        createdAt: now - 1000,
        updatedAt: now - 1000,
      });
      const newId = await ctx.db.insert("customers", {
        firstName: "New",
        lastName: "Record",
        email: "DUP@EXAMPLE.COM",
        emailNormalized: "dup@example.com",
        status: "lead",
        createdAt: now,
        updatedAt: now,
      });
      return { oldId, newId };
    });

    const requestId = await t.mutation(internal.bookingRequests.createRequest, {
      email: "Dup@example.com",
      contactDetails: "Duplicate User",
    });

    const request = await t.run(async (ctx) => (ctx.db.get(requestId as Id<"bookingRequests">) as any));
    expect(request?.customerId).toBe(ids.oldId);
    expect(request?.customerId).not.toBe(ids.newId);
  });

  it("links quote/request/booking and promotes lead to active on booking creation", async () => {
    const t = convexTest(schema, modules);

    const quoteRequestId = await t.mutation(internal.quoteRequests.createQuoteRequest, {
      email: "flow@example.com",
      firstName: "Flow",
      lastName: "Lead",
      serviceType: "Deep",
    });

    const bookingRequestId = await t.mutation(internal.bookingRequests.createRequest, {
      quoteRequestId,
      email: "flow@example.com",
      contactDetails: "Flow Lead",
      phoneNumber: "5553334444",
    });

    const bookingId = await t.mutation(api.bookings.createBookingFromRequest, {
      requestId: bookingRequestId,
    });

    const result = await t.run(async (ctx) => {
      const quoteRequest = (await ctx.db.get(quoteRequestId as Id<"quoteRequests">)) as any;
      const bookingRequest = (await ctx.db.get(bookingRequestId as Id<"bookingRequests">)) as any;
      const booking = (await ctx.db.get(bookingId as Id<"bookings">)) as any;
      const customer = booking?.customerId
        ? ((await ctx.db.get(booking.customerId)) as any)
        : null;
      return { quoteRequest, bookingRequest, booking, customer };
    });

    expect(result.booking?.customerId).toBeDefined();
    expect(result.booking?.customerId).toBe(result.bookingRequest?.customerId);
    expect(result.booking?.customerId).toBe(result.quoteRequest?.customerId);
    expect(result.customer?.status).toBe("active");
    expect(result.customer?.totalBookings).toBe(1);
  });

  it("sets customerId for direct createBookingFromTally flow", async () => {
    const t = convexTest(schema, modules);

    const bookingId = await t.mutation(api.bookings.createBookingFromTally, {
      email: "tally@example.com",
      customerName: "Tally User",
      amount: 12000,
    });

    const result = await t.run(async (ctx) => {
      const booking = (await ctx.db.get(bookingId as Id<"bookings">)) as any;
      const customer = booking?.customerId
        ? ((await ctx.db.get(booking.customerId)) as any)
        : null;
      return { booking, customer };
    });

    expect(result.booking?.customerId).toBeDefined();
    expect(result.customer?.status).toBe("active");
    expect(result.customer?.totalBookings).toBe(1);
  });

  it("derives fallback name from email local-part when name is missing", async () => {
    const t = convexTest(schema, modules);

    const requestId = await t.mutation(internal.bookingRequests.createRequest, {
      email: "mary.jane-smith+vip@example.com",
    });

    const result = await t.run(async (ctx) => {
      const request = (await ctx.db.get(requestId as Id<"bookingRequests">)) as any;
      const customer = request?.customerId
        ? ((await ctx.db.get(request.customerId)) as any)
        : null;
      return { request, customer };
    });

    expect(result.customer?.firstName).toBe("Mary");
    expect(result.customer?.lastName).toContain("Jane");
  });

  it("recomputes stats with all-booking count and completed+charged spend", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const customerId = await t.mutation(internal.customers.ensureLifecycleCustomer, {
      email: "stats@example.com",
      firstName: "Stats",
      lastName: "User",
      source: "manual",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("bookings", {
        email: "stats@example.com",
        customerName: "Stats User",
        customerId,
        status: "pending_card",
        amount: 1000,
        serviceDate: "2026-02-01",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("bookings", {
        email: "stats@example.com",
        customerName: "Stats User",
        customerId,
        status: "completed",
        amount: 2000,
        serviceDate: "2026-02-02",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("bookings", {
        email: "stats@example.com",
        customerName: "Stats User",
        customerId,
        status: "charged",
        amount: 3000,
        serviceDate: "2026-02-03",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("bookings", {
        email: "stats@example.com",
        customerName: "Stats User",
        customerId,
        status: "cancelled",
        amount: 4000,
        serviceDate: "2026-02-04",
        createdAt: now,
        updatedAt: now,
      });
    });

    await t.mutation(internal.customers.recomputeStatsInternal, {
      customerId,
    });

    const customer = await t.run(async (ctx) => (ctx.db.get(customerId as Id<"customers">) as any));
    expect(customer?.totalBookings).toBe(4);
    expect(customer?.totalSpent).toBe(5000);
    expect(customer?.lastBookingDate).toBe(Date.parse("2026-02-04"));
  });

  it("refreshes stats when override transition leaves completed/charged states", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const customerId = await t.mutation(internal.customers.ensureLifecycleCustomer, {
      email: "override@example.com",
      firstName: "Override",
      lastName: "Case",
      source: "manual",
    });

    const bookingId = await t.run(async (ctx) => {
      return await ctx.db.insert("bookings", {
        email: "override@example.com",
        customerName: "Override Case",
        customerId,
        status: "completed",
        amount: 2500,
        serviceDate: "2026-02-05",
        createdAt: now,
        updatedAt: now,
      });
    });

    await t.mutation(internal.customers.recomputeStatsInternal, {
      customerId,
    });

    const actorUserId = await insertActorUser(t);

    await t.mutation(internal.bookingStateMachine.transitionBookingStatus, {
      bookingId,
      toStatus: "cancelled",
      source: "bookings.adminOverrideBookingStatus",
      reason: "manual correction",
      allowOverride: true,
      actorUserId,
    });

    const customer = await t.run(async (ctx) => (ctx.db.get(customerId as Id<"customers">) as any));
    expect(customer?.totalBookings).toBe(1);
    expect(customer?.totalSpent).toBe(0);
  });

  it("backfill dry-run reports work without mutating rows", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const ids = await t.run(async (ctx) => {
      const customerId = await ctx.db.insert("customers", {
        firstName: "Backfill",
        lastName: "User",
        email: "backfill@example.com",
        status: "lead",
        createdAt: now,
        updatedAt: now,
      });

      const quoteRequestId = await ctx.db.insert("quoteRequests", {
        email: "backfill@example.com",
        requestStatus: "requested",
        createdAt: now,
        updatedAt: now,
      });

      const bookingRequestId = await ctx.db.insert("bookingRequests", {
        status: "requested",
        quoteRequestId,
        email: "backfill@example.com",
        createdAt: now,
        updatedAt: now,
      });

      const bookingId = await ctx.db.insert("bookings", {
        email: "backfill@example.com",
        customerName: "Backfill User",
        bookingRequestId,
        status: "completed",
        amount: 5000,
        serviceDate: "2026-02-06",
        createdAt: now,
        updatedAt: now,
      });

      return { customerId, quoteRequestId, bookingRequestId, bookingId };
    });

    const summary = await t.mutation(internal.customers.backfillCustomerLinking, {
      dryRun: true,
      recomputeAll: true,
    });

    const after = await t.run(async (ctx) => {
      const customer = (await ctx.db.get(ids.customerId as Id<"customers">)) as any;
      const quoteRequest = (await ctx.db.get(ids.quoteRequestId as Id<"quoteRequests">)) as any;
      const bookingRequest = (await ctx.db.get(ids.bookingRequestId as Id<"bookingRequests">)) as any;
      const booking = (await ctx.db.get(ids.bookingId as Id<"bookings">)) as any;
      return { customer, quoteRequest, bookingRequest, booking };
    });

    expect(summary.customersNormalizedPatched).toBeGreaterThan(0);
    expect(summary.quoteRequestsLinked).toBeGreaterThan(0);
    expect(after.customer?.emailNormalized).toBeUndefined();
    expect(after.quoteRequest?.customerId).toBeUndefined();
    expect(after.bookingRequest?.customerId).toBeUndefined();
    expect(after.booking?.customerId).toBeUndefined();
  });

  it("backfill execute links rows, fills normalized email, and recomputes stats", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const ids = await t.run(async (ctx) => {
      const customerId = await ctx.db.insert("customers", {
        firstName: "Backfill",
        lastName: "Exec",
        email: "backfill.exec@example.com",
        status: "lead",
        createdAt: now,
        updatedAt: now,
      });

      const quoteRequestId = await ctx.db.insert("quoteRequests", {
        email: "backfill.exec@example.com",
        requestStatus: "requested",
        createdAt: now,
        updatedAt: now,
      });

      const bookingRequestId = await ctx.db.insert("bookingRequests", {
        status: "requested",
        quoteRequestId,
        email: "backfill.exec@example.com",
        createdAt: now,
        updatedAt: now,
      });

      const bookingId = await ctx.db.insert("bookings", {
        email: "backfill.exec@example.com",
        customerName: "Backfill Exec",
        bookingRequestId,
        status: "charged",
        amount: 8400,
        serviceDate: "2026-02-07",
        createdAt: now,
        updatedAt: now,
      });

      return { customerId, quoteRequestId, bookingRequestId, bookingId };
    });

    const summary = await t.mutation(internal.customers.backfillCustomerLinking, {
      dryRun: false,
      recomputeAll: true,
    });

    const after = await t.run(async (ctx) => {
      const customer = (await ctx.db.get(ids.customerId as Id<"customers">)) as any;
      const quoteRequest = (await ctx.db.get(ids.quoteRequestId as Id<"quoteRequests">)) as any;
      const bookingRequest = (await ctx.db.get(ids.bookingRequestId as Id<"bookingRequests">)) as any;
      const booking = (await ctx.db.get(ids.bookingId as Id<"bookings">)) as any;
      return { customer, quoteRequest, bookingRequest, booking };
    });

    expect(summary.unresolvedRowsWithoutCanonical).toBe(0);
    expect(after.customer?.emailNormalized).toBe("backfill.exec@example.com");
    expect(after.quoteRequest?.customerId).toBe(ids.customerId);
    expect(after.bookingRequest?.customerId).toBe(ids.customerId);
    expect(after.booking?.customerId).toBe(ids.customerId);
    expect(after.customer?.totalBookings).toBeGreaterThanOrEqual(1);
    expect(after.customer?.totalSpent).toBeGreaterThanOrEqual(8400);
  });
});
