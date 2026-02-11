import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal, api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../bookingRequestOrgMigration.ts": () => import("../bookingRequestOrgMigration"),
  "../bookingRequests.ts": () => import("../bookingRequests"),
};

describe.sequential("booking request org migration", () => {
  it("backfills resolvable rows and reports unresolved/conflicts", async () => {
    const t = convexTest(schema, modules);

    const ids = await t.run(async (ctx) => {
      const now = Date.now();
      const clerkUserId = `user_${Math.random().toString(36).slice(2, 8)}`;
      const userId = await ctx.db.insert("users", {
        clerkId: clerkUserId,
        email: `${clerkUserId}@example.com`,
      });

      const orgA = await ctx.db.insert("organizations", {
        clerkId: `org_${Math.random().toString(36).slice(2, 8)}`,
        name: "Org A",
        slug: "org-a",
      });
      const orgB = await ctx.db.insert("organizations", {
        clerkId: `org_${Math.random().toString(36).slice(2, 8)}`,
        name: "Org B",
        slug: "org-b",
      });

      await ctx.db.insert("organizationMemberships", {
        clerkId: `membership_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        organizationId: orgA,
        role: "owner",
      });

      const quoteWithOrgId = await ctx.db.insert("quoteRequests", {
        organizationId: orgA,
        requestStatus: "requested",
        email: "with-org@example.com",
        createdAt: now,
        updatedAt: now,
      });

      const quoteConflictId = await ctx.db.insert("quoteRequests", {
        organizationId: orgB,
        requestStatus: "requested",
        email: "conflict@example.com",
        createdAt: now,
        updatedAt: now,
      });

      const resolvableRequestId = await ctx.db.insert("bookingRequests", {
        quoteRequestId: quoteWithOrgId,
        status: "requested",
        email: "with-org@example.com",
        createdAt: now,
        updatedAt: now,
      });

      const unresolvedRequestId = await ctx.db.insert("bookingRequests", {
        status: "requested",
        email: "unresolved@example.com",
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("bookingRequests", {
        organizationId: orgA,
        quoteRequestId: quoteConflictId,
        status: "requested",
        email: "conflict@example.com",
        createdAt: now,
        updatedAt: now,
      });

      return { resolvableRequestId, unresolvedRequestId, clerkUserId };
    });

    const dryRun = await t.mutation(
      internal.bookingRequestOrgMigration.backfillBookingRequestOrganizations,
      { dryRun: true }
    );
    expect(dryRun.patched).toBe(1);
    expect(dryRun.unresolvedNoQuoteRequest).toBe(1);

    const execute = await t.mutation(
      internal.bookingRequestOrgMigration.backfillBookingRequestOrganizations,
      { dryRun: false }
    );
    expect(execute.patched).toBe(1);

    const after = await t.run(async (ctx) => {
      const resolvable = await ctx.db.get(ids.resolvableRequestId as Id<"bookingRequests">);
      const unresolved = await ctx.db.get(ids.unresolvedRequestId as Id<"bookingRequests">);
      return { resolvable, unresolved };
    });

    expect(after.resolvable?.organizationId).toBeTruthy();
    expect(after.unresolved?.organizationId).toBeUndefined();

    const authed = t.withIdentity({
      subject: ids.clerkUserId,
    });

    const report = await authed.query(
      api.bookingRequestOrgMigration.getBookingRequestOrganizationBackfillReport,
      { limit: 20 }
    );

    expect(report.counts.missingOrganizationId).toBe(1);
    expect(report.counts.unresolved).toBe(1);
    expect(report.counts.orgConflictCount).toBe(1);
    expect(report.samples.unresolved[0]?.requestId).toBe(ids.unresolvedRequestId);
  });
});
