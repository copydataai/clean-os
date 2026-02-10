import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../dashboard.ts": () => import("../dashboard"),
  "../bookingRequests.ts": () => import("../bookingRequests"),
  "../quotes.ts": () => import("../quotes"),
};

async function seedTwoOrgFixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const userClerkId = `user_${suffix}`;
    const userId = await ctx.db.insert("users", {
      clerkId: userClerkId,
      email: `${userClerkId}@example.com`,
      firstName: "Scope",
      lastName: "Tester",
    });

    const orgAClerkId = `org_a_${suffix}`;
    const orgBClerkId = `org_b_${suffix}`;

    const orgAId = await ctx.db.insert("organizations", {
      clerkId: orgAClerkId,
      name: "Org A",
      slug: "org-a",
    });

    const orgBId = await ctx.db.insert("organizations", {
      clerkId: orgBClerkId,
      name: "Org B",
      slug: "org-b",
    });

    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_a_${suffix}`,
      userId,
      organizationId: orgAId,
      role: "owner",
    });

    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_b_${suffix}`,
      userId,
      organizationId: orgBId,
      role: "admin",
    });

    const now = Date.now();

    const bookingAId = await ctx.db.insert("bookings", {
      organizationId: orgAId,
      email: "a@example.com",
      customerName: "Alpha Customer",
      status: "pending_card",
      serviceDate: "2026-02-10",
      amount: 10000,
      createdAt: now,
      updatedAt: now,
    });

    const bookingBId = await ctx.db.insert("bookings", {
      organizationId: orgBId,
      email: "b@example.com",
      customerName: "Beta Customer",
      status: "charged",
      serviceDate: "2026-02-11",
      amount: 20000,
      createdAt: now + 1,
      updatedAt: now + 1,
    });

    const requestAId = await ctx.db.insert("bookingRequests", {
      organizationId: orgAId,
      status: "requested",
      email: "a@example.com",
      contactDetails: "Alpha Request",
      createdAt: now,
      updatedAt: now,
    });

    const requestBId = await ctx.db.insert("bookingRequests", {
      organizationId: orgBId,
      status: "requested",
      email: "b@example.com",
      contactDetails: "Beta Request",
      createdAt: now + 1,
      updatedAt: now + 1,
    });

    const quoteRequestAId = await ctx.db.insert("quoteRequests", {
      organizationId: orgAId,
      firstName: "Alpha",
      lastName: "Quote",
      email: "alpha.quote@example.com",
      requestStatus: "quoted",
      createdAt: now,
      updatedAt: now,
    });

    const quoteRequestBId = await ctx.db.insert("quoteRequests", {
      organizationId: orgBId,
      firstName: "Beta",
      lastName: "Quote",
      email: "beta.quote@example.com",
      requestStatus: "quoted",
      createdAt: now + 1,
      updatedAt: now + 1,
    });

    await ctx.db.insert("quotes", {
      organizationId: orgAId,
      quoteRequestId: quoteRequestAId,
      quoteNumber: 10001,
      status: "sent",
      profileKey: "kathy_clean_default",
      sentAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
      requiresReview: false,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("quotes", {
      organizationId: orgBId,
      quoteRequestId: quoteRequestBId,
      quoteNumber: 10002,
      status: "sent",
      profileKey: "kathy_clean_default",
      sentAt: now + 1,
      expiresAt: now + 48 * 60 * 60 * 1000,
      requiresReview: false,
      createdAt: now + 1,
      updatedAt: now + 1,
    });

    return {
      userClerkId,
      orgAClerkId,
      orgBClerkId,
      orgAId,
      orgBId,
      bookingAId,
      bookingBId,
      requestAId,
      requestBId,
      quoteRequestAId,
      quoteRequestBId,
    };
  });
}

describe.sequential("dashboard org scoping", () => {
  it("isolates dashboard stats/lists/details to active org", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedTwoOrgFixture(t);

    const asOrgA = t.withIdentity({
      subject: fixture.userClerkId,
      orgId: fixture.orgAClerkId,
    });

    const statsA = await asOrgA.query(api.dashboard.getStats, {});
    expect(statsA.pendingBookings).toBe(1);
    expect(statsA.pendingRequests).toBe(1);

    const recentBookingsA = await asOrgA.query(api.dashboard.getRecentBookings, { limit: 10 });
    expect(recentBookingsA).toHaveLength(1);
    expect(recentBookingsA[0]?._id).toBe(fixture.bookingAId);

    const requestsA = await asOrgA.query(api.bookingRequests.listRecent, { limit: 10 });
    expect(requestsA).toHaveLength(1);
    expect(requestsA[0]?._id).toBe(fixture.requestAId);

    const boardA = await asOrgA.query(api.quotes.listQuoteBoard, { limit: 10 });
    expect(boardA).toHaveLength(1);
    expect((boardA[0]?._id as Id<"quoteRequests">)).toBe(fixture.quoteRequestAId);

    const asOrgB = t.withIdentity({
      subject: fixture.userClerkId,
      orgId: fixture.orgBClerkId,
    });

    const statsB = await asOrgB.query(api.dashboard.getStats, {});
    expect(statsB.pendingBookings).toBe(0);
    expect(statsB.pendingRequests).toBe(1);

    const recentBookingsB = await asOrgB.query(api.dashboard.getRecentBookings, { limit: 10 });
    expect(recentBookingsB).toHaveLength(1);
    expect(recentBookingsB[0]?._id).toBe(fixture.bookingBId);

    const requestsB = await asOrgB.query(api.bookingRequests.listRecent, { limit: 10 });
    expect(requestsB).toHaveLength(1);
    expect(requestsB[0]?._id).toBe(fixture.requestBId);

    const boardB = await asOrgB.query(api.quotes.listQuoteBoard, { limit: 10 });
    expect(boardB).toHaveLength(1);
    expect((boardB[0]?._id as Id<"quoteRequests">)).toBe(fixture.quoteRequestBId);
  });
});
