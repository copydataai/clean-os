import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { createTestOrganization } from "./helpers/orgTestUtils";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../quotes.ts": () => import("../quotes"),
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

let quoteNumberCounter = 30000;

async function createRequestAndQuote(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  args: {
    requestCreatedAt: number;
    sentAt?: number;
    acceptedAt?: number;
  }
) {
  return await t.run(async (ctx) => {
    const quoteRequestId = await ctx.db.insert("quoteRequests", {
      organizationId,
      firstName: "Metric",
      lastName: "User",
      email: `metric-${Math.random()}@example.com`,
      requestStatus: "requested",
      createdAt: args.requestCreatedAt,
      updatedAt: args.requestCreatedAt,
    });

    const quoteId = await ctx.db.insert("quotes", {
      organizationId,
      quoteRequestId,
      quoteNumber: quoteNumberCounter++,
      status: args.acceptedAt ? "accepted" : args.sentAt ? "sent" : "draft",
      profileKey: "kathy_clean_default",
      sentAt: args.sentAt,
      acceptedAt: args.acceptedAt,
      requiresReview: false,
      createdAt: args.requestCreatedAt,
      updatedAt: args.requestCreatedAt,
    });

    return { quoteRequestId, quoteId };
  });
}

async function createTimelineFixture(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  nowMs: number
): Promise<{ quoteRequestId: Id<"quoteRequests">; quoteId: Id<"quotes"> }> {
  return await t.run(async (ctx) => {
    const quoteRequestId = await ctx.db.insert("quoteRequests", {
      organizationId,
      firstName: "Timeline",
      lastName: "User",
      email: "timeline@example.com",
      requestStatus: "quoted",
      createdAt: nowMs,
      updatedAt: nowMs,
    });
    const quoteId = await ctx.db.insert("quotes", {
      organizationId,
      quoteRequestId,
      quoteNumber: quoteNumberCounter++,
      status: "sent",
      profileKey: "kathy_clean_default",
      requiresReview: false,
      createdAt: nowMs,
      updatedAt: nowMs,
    });
    await ctx.db.insert("quoteReminderEvents", {
      organizationId,
      quoteId,
      quoteRequestId,
      stage: "r1_24h",
      triggerSource: "cron",
      idempotencyKey: `one-${nowMs}`,
      status: "sent",
      sentAt: nowMs + 1000,
      createdAt: nowMs + 1000,
    });
    await ctx.db.insert("quoteReminderEvents", {
      organizationId,
      quoteId,
      quoteRequestId,
      stage: "manual",
      triggerSource: "manual",
      idempotencyKey: `two-${nowMs}`,
      status: "failed",
      errorMessage: "network",
      createdAt: nowMs + 2000,
    });
    return { quoteRequestId, quoteId };
  });
}

describe.sequential("quote UI metrics", () => {
  it("computes 30-day cohort counts and rates", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, clerkOrgId } = await createTestOrganization(t);
    const authed = await createAuthedOrgClient(t, organizationId, clerkOrgId);
    const nowMs = 1_740_000_000_000;

    await createRequestAndQuote(t, organizationId, {
      requestCreatedAt: nowMs - 2 * 24 * 60 * 60 * 1000,
      sentAt: nowMs - 24 * 60 * 60 * 1000,
      acceptedAt: nowMs - 12 * 60 * 60 * 1000,
    });
    await createRequestAndQuote(t, organizationId, {
      requestCreatedAt: nowMs - 5 * 24 * 60 * 60 * 1000,
      sentAt: nowMs - 4 * 24 * 60 * 60 * 1000,
    });
    await createRequestAndQuote(t, organizationId, {
      requestCreatedAt: nowMs - 10 * 24 * 60 * 60 * 1000,
    });
    await createRequestAndQuote(t, organizationId, {
      requestCreatedAt: nowMs - 40 * 24 * 60 * 60 * 1000,
      sentAt: nowMs - 39 * 24 * 60 * 60 * 1000,
      acceptedAt: nowMs - 38 * 24 * 60 * 60 * 1000,
    });

    const originalNow = Date.now;
    Date.now = () => nowMs;
    try {
      const metrics = await authed.query(api.quotes.getQuoteFunnelMetrics, { days: 30 });
      expect(metrics.requestedCount).toBe(3);
      expect(metrics.quotedCount).toBe(2);
      expect(metrics.confirmedCount).toBe(1);
      expect(metrics.quotedRate).toBeCloseTo(2 / 3, 5);
      expect(metrics.confirmedRate).toBeCloseTo(1 / 3, 5);
    } finally {
      Date.now = originalNow;
    }
  });

  it("computes median cycle durations and returns reminder timeline latest-first", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, clerkOrgId } = await createTestOrganization(t);
    const authed = await createAuthedOrgClient(t, organizationId, clerkOrgId);
    const nowMs = 1_740_000_000_000;

    await createRequestAndQuote(t, organizationId, {
      requestCreatedAt: nowMs - 10 * 24 * 60 * 60 * 1000,
      sentAt: nowMs - 9 * 24 * 60 * 60 * 1000,
      acceptedAt: nowMs - 8 * 24 * 60 * 60 * 1000,
    });
    await createRequestAndQuote(t, organizationId, {
      requestCreatedAt: nowMs - 7 * 24 * 60 * 60 * 1000,
      sentAt: nowMs - 5 * 24 * 60 * 60 * 1000,
      acceptedAt: nowMs - 4 * 24 * 60 * 60 * 1000,
    });
    await createRequestAndQuote(t, organizationId, {
      requestCreatedAt: nowMs - 6 * 24 * 60 * 60 * 1000,
      sentAt: nowMs - 5 * 24 * 60 * 60 * 1000,
    });
    const timelineFixture = await createTimelineFixture(t, organizationId, nowMs);

    const originalNow = Date.now;
    Date.now = () => nowMs;
    try {
      const metrics = await authed.query(api.quotes.getQuoteFunnelMetrics, { days: 30 });
      expect(metrics.medianTimeToQuoteMs).toBe(24 * 60 * 60 * 1000);
      expect(metrics.medianTimeToConfirmMs).toBe(24 * 60 * 60 * 1000);
    } finally {
      Date.now = originalNow;
    }

    const timeline = await authed.query(api.quotes.getQuoteReminderTimeline, {
      quoteRequestId: timelineFixture.quoteRequestId,
    });
    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.stage).toBe("manual");
    expect(timeline[1]?.stage).toBe("r1_24h");
  });
});
