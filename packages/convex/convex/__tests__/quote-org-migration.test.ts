import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../quoteOrgMigration.ts": () => import("../quoteOrgMigration"),
  "../quoteRequests.ts": () => import("../quoteRequests"),
  "../quotes.ts": () => import("../quotes"),
};

async function seedQuoteMigrationFixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const userClerkId = `user_${suffix}`;
    const userId = await ctx.db.insert("users", {
      clerkId: userClerkId,
      email: `${userClerkId}@example.com`,
      firstName: "Quote",
      lastName: "Migration",
    });

    const orgClerkId = `org_${suffix}`;
    const organizationId = await ctx.db.insert("organizations", {
      clerkId: orgClerkId,
      name: "Migration Org",
      slug: `migration-${suffix}`,
    });

    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_${suffix}`,
      userId,
      organizationId,
      role: "owner",
    });

    const now = Date.now();
    const bookingRequestId = await ctx.db.insert("bookingRequests", {
      organizationId,
      status: "requested",
      email: "resolved@example.com",
      contactDetails: "Resolved Contact",
      createdAt: now,
      updatedAt: now,
    });

    const resolvedQuoteRequestId = await ctx.db.insert("quoteRequests", {
      bookingRequestId,
      firstName: "Resolved",
      lastName: "Quote",
      email: "resolved@example.com",
      requestStatus: "quoted",
      createdAt: now,
      updatedAt: now,
    });

    const resolvedQuoteId = await ctx.db.insert("quotes", {
      quoteRequestId: resolvedQuoteRequestId,
      bookingRequestId,
      quoteNumber: 20001,
      status: "sent",
      profileKey: "kathy_clean_default",
      sentAt: now,
      expiresAt: now + 86_400_000,
      requiresReview: false,
      createdAt: now,
      updatedAt: now,
    });

    const resolvedRevisionId = await ctx.db.insert("quoteRevisions", {
      quoteId: resolvedQuoteId,
      revisionNumber: 1,
      source: "manual",
      serviceLabel: "Standard Cleaning",
      description: "Test revision",
      quantity: 1,
      unitPriceCents: 10000,
      subtotalCents: 10000,
      taxName: "Tax",
      taxRateBps: 0,
      taxAmountCents: 0,
      totalCents: 10000,
      currency: "usd",
      recipientSnapshot: {
        firstName: "Resolved",
        lastName: "Quote",
        name: "Resolved Quote",
        email: "resolved@example.com",
      },
      inclusionsSnapshot: {
        title: "Included",
        intro: "Intro",
        includedItems: ["Item"],
        whyItWorksItems: ["Reason"],
        outro: "Outro",
      },
      termsSnapshot: {
        quoteValidity: "30 days",
        serviceLimitations: "None",
        access: "Access",
        cancellations: "24h",
        nonSolicitation: "No",
        acceptance: "By payment",
      },
      sendStatus: "draft",
      createdAt: now,
    });

    const resolvedReminderId = await ctx.db.insert("quoteReminderEvents", {
      quoteId: resolvedQuoteId,
      quoteRequestId: resolvedQuoteRequestId,
      revisionId: resolvedRevisionId,
      stage: "r1_24h",
      triggerSource: "cron",
      idempotencyKey: `resolved-${suffix}`,
      status: "sent",
      sentAt: now,
      createdAt: now,
    });

    const orphanQuoteRequestId = await ctx.db.insert("quoteRequests", {
      firstName: "Orphan",
      lastName: "Request",
      email: "orphan@example.com",
      requestStatus: "requested",
      createdAt: now + 1,
      updatedAt: now + 1,
    });

    const orphanQuoteId = await ctx.db.insert("quotes", {
      quoteRequestId: orphanQuoteRequestId,
      quoteNumber: 20002,
      status: "draft",
      profileKey: "kathy_clean_default",
      requiresReview: false,
      createdAt: now + 1,
      updatedAt: now + 1,
    });

    const orphanRevisionId = await ctx.db.insert("quoteRevisions", {
      quoteId: orphanQuoteId,
      revisionNumber: 1,
      source: "manual",
      serviceLabel: "Deep Cleaning",
      description: "Orphan revision",
      quantity: 1,
      unitPriceCents: 20000,
      subtotalCents: 20000,
      taxName: "Tax",
      taxRateBps: 0,
      taxAmountCents: 0,
      totalCents: 20000,
      currency: "usd",
      recipientSnapshot: {
        firstName: "Orphan",
        lastName: "Request",
        name: "Orphan Request",
        email: "orphan@example.com",
      },
      inclusionsSnapshot: {
        title: "Included",
        intro: "Intro",
        includedItems: ["Item"],
        whyItWorksItems: ["Reason"],
        outro: "Outro",
      },
      termsSnapshot: {
        quoteValidity: "30 days",
        serviceLimitations: "None",
        access: "Access",
        cancellations: "24h",
        nonSolicitation: "No",
        acceptance: "By payment",
      },
      sendStatus: "draft",
      createdAt: now + 1,
    });

    const orphanReminderId = await ctx.db.insert("quoteReminderEvents", {
      quoteId: orphanQuoteId,
      quoteRequestId: orphanQuoteRequestId,
      revisionId: orphanRevisionId,
      stage: "manual",
      triggerSource: "manual",
      idempotencyKey: `orphan-${suffix}`,
      status: "missing_context",
      createdAt: now + 1,
    });

    return {
      userClerkId,
      orgClerkId,
      organizationId,
      resolvedQuoteRequestId,
      resolvedQuoteId,
      resolvedRevisionId,
      resolvedReminderId,
      orphanQuoteRequestId,
      orphanQuoteId,
      orphanRevisionId,
      orphanReminderId,
    };
  });
}

describe.sequential("quote org migration", () => {
  it("backfills resolvable quote records and hides unresolved orphans", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedQuoteMigrationFixture(t);

    const dryRun = await t.mutation(internal.quoteOrgMigration.backfillQuoteOrganizations, {
      dryRun: true,
    });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.quoteRequestsPatched).toBeGreaterThan(0);
    expect(dryRun.quotesPatched).toBeGreaterThan(0);

    const execute = await t.mutation(internal.quoteOrgMigration.backfillQuoteOrganizations, {
      dryRun: false,
    });

    expect(execute.quoteRequestsPatched).toBeGreaterThan(0);
    expect(execute.quotesPatched).toBeGreaterThan(0);
    expect(execute.revisionsPatched).toBeGreaterThan(0);
    expect(execute.remindersPatched).toBeGreaterThan(0);

    const after = await t.run(async (ctx) => {
      const resolvedQuoteRequest = await ctx.db.get(
        fixture.resolvedQuoteRequestId as Id<"quoteRequests">
      );
      const resolvedQuote = await ctx.db.get(fixture.resolvedQuoteId as Id<"quotes">);
      const resolvedRevision = await ctx.db.get(
        fixture.resolvedRevisionId as Id<"quoteRevisions">
      );
      const resolvedReminder = await ctx.db.get(
        fixture.resolvedReminderId as Id<"quoteReminderEvents">
      );

      const orphanQuoteRequest = await ctx.db.get(
        fixture.orphanQuoteRequestId as Id<"quoteRequests">
      );
      const orphanQuote = await ctx.db.get(fixture.orphanQuoteId as Id<"quotes">);
      const orphanRevision = await ctx.db.get(
        fixture.orphanRevisionId as Id<"quoteRevisions">
      );
      const orphanReminder = await ctx.db.get(
        fixture.orphanReminderId as Id<"quoteReminderEvents">
      );

      return {
        resolvedQuoteRequest,
        resolvedQuote,
        resolvedRevision,
        resolvedReminder,
        orphanQuoteRequest,
        orphanQuote,
        orphanRevision,
        orphanReminder,
      };
    });

    expect(after.resolvedQuoteRequest?.organizationId).toBe(fixture.organizationId);
    expect(after.resolvedQuote?.organizationId).toBe(fixture.organizationId);
    expect(after.resolvedRevision?.organizationId).toBe(fixture.organizationId);
    expect(after.resolvedReminder?.organizationId).toBe(fixture.organizationId);

    expect(after.orphanQuoteRequest?.organizationId).toBeUndefined();
    expect(after.orphanQuote?.organizationId).toBeUndefined();
    expect(after.orphanRevision?.organizationId).toBeUndefined();
    expect(after.orphanReminder?.organizationId).toBeUndefined();

    const asOrgMember = t.withIdentity({
      subject: fixture.userClerkId,
      orgId: fixture.orgClerkId,
    });

    const visibleQuoteRequests = await asOrgMember.query(api.quoteRequests.listRecent, {
      limit: 20,
    });
    expect(visibleQuoteRequests.map((row: any) => row._id)).toContain(fixture.resolvedQuoteRequestId);
    expect(visibleQuoteRequests.map((row: any) => row._id)).not.toContain(
      fixture.orphanQuoteRequestId
    );

    const board = await asOrgMember.query(api.quotes.listQuoteBoard, { limit: 20 });
    expect(board.map((row: any) => row._id)).toContain(fixture.resolvedQuoteRequestId);
    expect(board.map((row: any) => row._id)).not.toContain(fixture.orphanQuoteRequestId);

    const report = await asOrgMember.query(api.quoteOrgMigration.getQuoteOrganizationBackfillReport, {
      limit: 20,
    });

    expect(report.unresolvedCounts.quoteRequests).toBeGreaterThan(0);
    expect(report.unresolvedCounts.quotes).toBeGreaterThan(0);
    expect(report.unresolvedCounts.quoteRevisions).toBeGreaterThan(0);
    expect(report.unresolvedCounts.quoteReminderEvents).toBeGreaterThan(0);

    expect(report.samples.quoteRequests).toContain(fixture.orphanQuoteRequestId);
    expect(report.samples.quotes).toContain(fixture.orphanQuoteId);
    expect(report.samples.quoteRevisions).toContain(fixture.orphanRevisionId);
    expect(report.samples.quoteReminderEvents).toContain(fixture.orphanReminderId);
  });
});
