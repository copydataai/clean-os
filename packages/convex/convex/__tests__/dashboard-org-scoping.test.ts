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

const defaultInclusions = {
  title: "What's Included",
  intro: "Included:",
  includedItems: ["Floors", "Bathrooms"],
  whyItWorksItems: ["Consistent quality"],
  outro: "Thank you.",
};

const defaultTerms = {
  quoteValidity: "30 days",
  serviceLimitations: "Standard limitations apply.",
  access: "Access required.",
  cancellations: "24h notice.",
  nonSolicitation: "Non-solicitation applies.",
  acceptance: "Acceptance via confirmation form.",
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

    const emailSendAId = await ctx.db.insert("emailSends", {
      idempotencyKey: `scope-email-a-${suffix}`,
      to: "a@example.com",
      subject: "Org A email",
      template: "booking-confirmed",
      provider: "convex_resend",
      status: "delivered",
      providerEmailId: `convex_email_a_${suffix}`,
      createdAt: now,
      updatedAt: now,
    });

    const emailSendBId = await ctx.db.insert("emailSends", {
      idempotencyKey: `scope-email-b-${suffix}`,
      to: "b@example.com",
      subject: "Org B email",
      template: "booking-confirmed",
      provider: "convex_resend",
      status: "failed",
      providerEmailId: `convex_email_b_${suffix}`,
      errorCode: "email.failed",
      errorMessage: "Provider rejected message",
      createdAt: now + 1,
      updatedAt: now + 1,
    });

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
      cardRequestEmailSendId: emailSendAId,
      createdAt: now,
      updatedAt: now,
    });

    const requestBId = await ctx.db.insert("bookingRequests", {
      organizationId: orgBId,
      status: "requested",
      email: "b@example.com",
      contactDetails: "Beta Request",
      cardRequestEmailSendId: emailSendBId,
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

    const quoteAId = await ctx.db.insert("quotes", {
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

    const quoteBId = await ctx.db.insert("quotes", {
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

    const quoteRevisionAId = await ctx.db.insert("quoteRevisions", {
      organizationId: orgAId,
      quoteId: quoteAId,
      revisionNumber: 1,
      source: "manual",
      serviceLabel: "Standard Cleaning",
      description: "Standard cleaning service",
      quantity: 1,
      unitPriceCents: 10000,
      subtotalCents: 10000,
      taxName: "Colorado",
      taxRateBps: 0,
      taxAmountCents: 0,
      totalCents: 10000,
      currency: "usd",
      recipientSnapshot: {
        firstName: "Alpha",
        lastName: "Quote",
        name: "Alpha Quote",
        email: "alpha.quote@example.com",
      },
      inclusionsSnapshot: defaultInclusions,
      termsSnapshot: defaultTerms,
      sendStatus: "sent",
      emailSendId: emailSendAId,
      sentAt: now,
      createdAt: now,
    });

    const quoteRevisionBId = await ctx.db.insert("quoteRevisions", {
      organizationId: orgBId,
      quoteId: quoteBId,
      revisionNumber: 1,
      source: "manual",
      serviceLabel: "Standard Cleaning",
      description: "Standard cleaning service",
      quantity: 1,
      unitPriceCents: 20000,
      subtotalCents: 20000,
      taxName: "Colorado",
      taxRateBps: 0,
      taxAmountCents: 0,
      totalCents: 20000,
      currency: "usd",
      recipientSnapshot: {
        firstName: "Beta",
        lastName: "Quote",
        name: "Beta Quote",
        email: "beta.quote@example.com",
      },
      inclusionsSnapshot: defaultInclusions,
      termsSnapshot: defaultTerms,
      sendStatus: "sent",
      emailSendId: emailSendBId,
      sentAt: now + 1,
      createdAt: now + 1,
    });

    await ctx.db.patch(quoteAId, {
      currentRevisionId: quoteRevisionAId,
      latestSentRevisionId: quoteRevisionAId,
    });

    await ctx.db.patch(quoteBId, {
      currentRevisionId: quoteRevisionBId,
      latestSentRevisionId: quoteRevisionBId,
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
      emailSendAId,
      emailSendBId,
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
    expect(requestsA[0]?.canonicalBookingHandle).toBe("org-a");

    const requestDetailA = await asOrgA.query(api.bookingRequests.getById, {
      id: fixture.requestAId,
    });
    expect(requestDetailA?.canonicalBookingHandle).toBe("org-a");
    expect(requestDetailA?.cardRequestEmailDelivery?.sendId).toBe(fixture.emailSendAId);
    expect(requestDetailA?.cardRequestEmailDelivery?.status).toBe("delivered");

    const boardA = await asOrgA.query(api.quotes.listQuoteBoard, { limit: 10 });
    expect(boardA).toHaveLength(1);
    expect((boardA[0]?._id as Id<"quoteRequests">)).toBe(fixture.quoteRequestAId);
    expect(boardA[0]?.latestEmailDelivery?.sendId).toBe(fixture.emailSendAId);
    expect(boardA[0]?.latestEmailDelivery?.status).toBe("delivered");

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
    expect(requestsB[0]?.canonicalBookingHandle).toBe("org-b");

    const requestDetailB = await asOrgB.query(api.bookingRequests.getById, {
      id: fixture.requestBId,
    });
    expect(requestDetailB?.canonicalBookingHandle).toBe("org-b");
    expect(requestDetailB?.cardRequestEmailDelivery?.sendId).toBe(fixture.emailSendBId);
    expect(requestDetailB?.cardRequestEmailDelivery?.status).toBe("failed");

    const boardB = await asOrgB.query(api.quotes.listQuoteBoard, { limit: 10 });
    expect(boardB).toHaveLength(1);
    expect((boardB[0]?._id as Id<"quoteRequests">)).toBe(fixture.quoteRequestBId);
    expect(boardB[0]?.latestEmailDelivery?.sendId).toBe(fixture.emailSendBId);
    expect(boardB[0]?.latestEmailDelivery?.status).toBe("failed");
  });
});
