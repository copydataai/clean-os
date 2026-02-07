import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../quoteReminderActions.ts": () => import("../quoteReminderActions"),
  "../quotes.ts": () => import("../quotes"),
  "../emailSends.ts": () => import("../emailSends"),
};

let quoteNumberCounter = 20000;

type FixtureOptions = {
  nowMs: number;
  status?: "sent" | "accepted" | "expired" | "send_failed";
  sentAt?: number;
  expiresAt?: number;
  withEmail?: boolean;
  withBooking?: boolean;
  withLatestSentRevision?: boolean;
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

async function createQuoteFixture(
  t: ReturnType<typeof convexTest>,
  options: FixtureOptions
): Promise<{
  quoteId: Id<"quotes">;
  quoteRequestId: Id<"quoteRequests">;
  bookingRequestId?: Id<"bookingRequests">;
  revisionId?: Id<"quoteRevisions">;
}> {
  return await t.run(async (ctx) => {
    const quoteRequestId = await ctx.db.insert("quoteRequests", {
      firstName: "Test",
      lastName: "Customer",
      email: options.withEmail === false ? undefined : "test@example.com",
      requestStatus: "quoted",
      createdAt: options.nowMs,
      updatedAt: options.nowMs,
    });

    const bookingRequestId =
      options.withBooking === false
        ? undefined
        : await ctx.db.insert("bookingRequests", {
            status: "requested",
            quoteRequestId,
            email: "test@example.com",
            createdAt: options.nowMs,
            updatedAt: options.nowMs,
          });

    const quoteId = await ctx.db.insert("quotes", {
      quoteRequestId,
      bookingRequestId,
      quoteNumber: quoteNumberCounter++,
      status: options.status ?? "sent",
      profileKey: "kathy_clean_default",
      sentAt: options.sentAt,
      expiresAt: options.expiresAt,
      requiresReview: false,
      createdAt: options.nowMs,
      updatedAt: options.nowMs,
    });

    const revisionId =
      options.withLatestSentRevision === false
        ? undefined
        : await ctx.db.insert("quoteRevisions", {
            quoteId,
            revisionNumber: 1,
            source: "grid_auto",
            serviceLabel: "Standard Cleaning",
            description: "Standard cleaning service",
            quantity: 1,
            unitPriceCents: 12000,
            subtotalCents: 12000,
            taxName: "Colorado",
            taxRateBps: 0,
            taxAmountCents: 0,
            totalCents: 12000,
            currency: "usd",
            recipientSnapshot: {
              firstName: "Test",
              lastName: "Customer",
              name: "Test Customer",
              email: options.withEmail === false ? undefined : "test@example.com",
            },
            inclusionsSnapshot: defaultInclusions,
            termsSnapshot: defaultTerms,
            sendStatus: "sent",
            sentAt: options.sentAt,
            createdAt: options.nowMs,
          });

    if (revisionId) {
      await ctx.db.patch(quoteId, {
        latestSentRevisionId: revisionId,
        currentRevisionId: revisionId,
      });
    }

    return { quoteId, quoteRequestId, bookingRequestId, revisionId };
  });
}

async function insertEmailSend(
  t: ReturnType<typeof convexTest>,
  idempotencyKey: string,
  status: "queued" | "sent" | "failed" | "skipped"
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("emailSends", {
      idempotencyKey,
      to: "test@example.com",
      subject: "Reminder",
      template: "quote-reminder",
      provider: "legacy_resend",
      status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}

function reminderKey(quoteId: string, revisionId: string, stage: string) {
  return `quote-reminder:${quoteId}:${revisionId}:${stage}`;
}

describe.sequential("quote reminders", () => {
  it("detects r1 due after 24h", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 25 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });

    const result = await t.action(internal.quoteReminderActions.sendDueQuoteReminders, {
      nowMs,
      dryRun: true,
    });

    expect(result.dueCount).toBe(1);
    expect(result.results[0]?.stage).toBe("r1_24h");
    expect(result.results[0]?.action).toBe("dry_run_due");
  });

  it("detects r2 due after 72h when r1 already sent", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    const fixture = await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 80 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });
    await insertEmailSend(
      t,
      reminderKey(fixture.quoteId, fixture.revisionId!, "r1_24h"),
      "sent"
    );

    const result = await t.action(internal.quoteReminderActions.sendDueQuoteReminders, {
      nowMs,
      dryRun: true,
    });

    expect(result.dueCount).toBe(1);
    expect(result.results[0]?.stage).toBe("r2_72h");
  });

  it("detects r3 due within 24h of expiry", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 10 * 60 * 60 * 1000,
      expiresAt: nowMs + 10 * 60 * 60 * 1000,
    });

    const result = await t.action(internal.quoteReminderActions.sendDueQuoteReminders, {
      nowMs,
      dryRun: true,
    });

    expect(result.dueCount).toBe(1);
    expect(result.results[0]?.stage).toBe("r3_pre_expiry");
  });

  it("sends at most one stage per quote per sweep with r1 priority", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 100 * 60 * 60 * 1000,
      expiresAt: nowMs + 10 * 60 * 60 * 1000,
    });

    const result = await t.action(internal.quoteReminderActions.sendDueQuoteReminders, {
      nowMs,
      dryRun: true,
    });

    expect(result.dueCount).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.stage).toBe("r1_24h");
  });

  it("dryRun reports due reminders without side effects", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    const fixture = await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 30 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });

    const result = await t.action(internal.quoteReminderActions.sendDueQuoteReminders, {
      nowMs,
      dryRun: true,
    });
    expect(result.dueCount).toBe(1);

    const after = await t.run(async (ctx) => {
      const quote = await ctx.db.get(fixture.quoteId);
      const sends = await ctx.db.query("emailSends").collect();
      return { quote, sends };
    });

    expect(after.quote?.requiresReview).toBe(false);
    expect(after.sends).toHaveLength(0);
  });

  it("flags quotes for review when reminder delivery context is missing", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    const fixture = await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 30 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
      withEmail: false,
    });

    const result = await t.action(internal.quoteReminderActions.sendDueQuoteReminders, {
      nowMs,
      dryRun: false,
    });
    expect(result.reviewFlaggedCount).toBe(1);
    expect(result.results[0]?.action).toBe("missing_context");

    const after = await t.run(async (ctx) => {
      const quote = await ctx.db.get(fixture.quoteId);
      return quote;
    });

    expect(after?.requiresReview).toBe(true);
    expect(after?.reviewReason).toBe("reminder_missing_delivery_context");
  });

  it("only scans sent quotes for reminders", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 30 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });
    await createQuoteFixture(t, {
      nowMs,
      status: "accepted",
      sentAt: nowMs - 30 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });
    await createQuoteFixture(t, {
      nowMs,
      status: "expired",
      sentAt: nowMs - 30 * 60 * 60 * 1000,
      expiresAt: nowMs - 2 * 60 * 60 * 1000,
    });
    await createQuoteFixture(t, {
      nowMs,
      status: "send_failed",
      sentAt: nowMs - 30 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });

    const result = await t.action(internal.quoteReminderActions.sendDueQuoteReminders, {
      nowMs,
      dryRun: true,
    });
    expect(result.scanned).toBe(1);
  });

  it("retries failed stage and does not resend sent/skipped stages", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;

    const retryable = await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 80 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });
    await insertEmailSend(
      t,
      reminderKey(retryable.quoteId, retryable.revisionId!, "r1_24h"),
      "failed"
    );

    const alreadySent = await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 80 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });
    await insertEmailSend(
      t,
      reminderKey(alreadySent.quoteId, alreadySent.revisionId!, "r1_24h"),
      "sent"
    );
    await insertEmailSend(
      t,
      reminderKey(alreadySent.quoteId, alreadySent.revisionId!, "r2_72h"),
      "sent"
    );

    const alreadySkipped = await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 80 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });
    await insertEmailSend(
      t,
      reminderKey(alreadySkipped.quoteId, alreadySkipped.revisionId!, "r1_24h"),
      "skipped"
    );
    await insertEmailSend(
      t,
      reminderKey(alreadySkipped.quoteId, alreadySkipped.revisionId!, "r2_72h"),
      "sent"
    );

    const result = await t.action(internal.quoteReminderActions.sendDueQuoteReminders, {
      nowMs,
      dryRun: true,
    });

    expect(result.dueCount).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.quoteId).toBe(retryable.quoteId);
    expect(result.results[0]?.stage).toBe("r1_24h");
  });
});
