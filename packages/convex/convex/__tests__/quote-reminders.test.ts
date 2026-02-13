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
  "../emailRenderers.ts": () => import("../emailRenderers"),
  "../emailSender.ts": () => import("../emailSender"),
  "../emailSuppressions.ts": () => import("../emailSuppressions"),
  "../emailActions.ts": () => import("../emailActions"),
  "../emailSends.ts": () => import("../emailSends"),
  "../integrations.ts": () => import("../integrations"),
  "../bookingRequests.ts": () => import("../bookingRequests"),
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
  organizationId: Id<"organizations">;
  quoteId: Id<"quotes">;
  quoteRequestId: Id<"quoteRequests">;
  bookingRequestId?: Id<"bookingRequests">;
  revisionId?: Id<"quoteRevisions">;
}> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: `user_${Math.random().toString(36).slice(2, 8)}`,
      email: "owner@example.com",
      firstName: "Owner",
      lastName: "Test",
    });
    const organizationId = await ctx.db.insert("organizations", {
      clerkId: `org_${Math.random().toString(36).slice(2, 8)}`,
      name: "Test Org",
      slug: "test-org",
    });
    await ctx.db.insert("organizationIntegrations", {
      organizationId,
      provider: "tally",
      status: "configured",
      requestFormId: "request_form_1",
      confirmationFormId: "confirm_form_1",
      formIds: {
        request: "request_form_1",
        confirmation: "confirm_form_1",
      },
      updatedByUserId: userId,
      createdAt: options.nowMs,
      updatedAt: options.nowMs,
    });

    const quoteRequestId = await ctx.db.insert("quoteRequests", {
      organizationId,
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
            organizationId,
            status: "requested",
            quoteRequestId,
            email: "test@example.com",
            createdAt: options.nowMs,
            updatedAt: options.nowMs,
          });

    const quoteId = await ctx.db.insert("quotes", {
      organizationId,
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
            organizationId,
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

    return { organizationId, quoteId, quoteRequestId, bookingRequestId, revisionId };
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
      provider: "convex_resend",
      status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}

function reminderKey(quoteId: string, revisionId: string, stage: string) {
  return `quote-reminder:${quoteId}:${revisionId}:${stage}`;
}

async function listReminderEvents(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("quoteReminderEvents").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  });
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

  it("writes missing_context reminder events on cron runs", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    const fixture = await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 30 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
      withEmail: false,
    });

    await t.action(internal.quoteReminderActions.sendDueQuoteReminders, {
      nowMs,
      dryRun: false,
    });

    const events = await listReminderEvents(t);
    expect(events).toHaveLength(1);
    expect(events[0]?.quoteId).toBe(fixture.quoteId);
    expect(events[0]?.status).toBe("missing_context");
    expect(events[0]?.triggerSource).toBe("cron");
    expect(events[0]?.stage).toBe("r1_24h");
  });

  it("records non-sent reminder events when email sending cannot complete", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 30 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });

    const originalResendKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      await t.action(internal.quoteReminderActions.sendDueQuoteReminders, {
        nowMs,
        dryRun: false,
      });
    } finally {
      if (originalResendKey) process.env.RESEND_API_KEY = originalResendKey;
    }

    const events = await listReminderEvents(t);
    expect(events).toHaveLength(1);
    expect(events[0]?.status === "failed" || events[0]?.status === "missing_context").toBe(true);
    expect(events[0]?.triggerSource).toBe("cron");
    expect(events[0]?.stage).toBe("r1_24h");
  });

  it("manual reminder writes manual stage event with independent idempotency key", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    const fixture = await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 10 * 60 * 60 * 1000,
      expiresAt: nowMs + 2 * 24 * 60 * 60 * 1000,
    });
    await t.mutation(internal.emailSuppressions.suppressEmail, {
      email: "test@example.com",
      reason: "complaint",
    });

    const result = await t.action(internal.quoteReminderActions.sendManualReminderInternal, {
      quoteRequestId: fixture.quoteRequestId,
      nowMs,
    });

    expect(result.idempotencyKey.includes(":manual:")).toBe(true);
    expect(result.status === "suppressed" || result.status === "skipped" || result.status === "sent").toBe(true);

    const events = await listReminderEvents(t);
    expect(events).toHaveLength(1);
    expect(events[0]?.stage).toBe("manual");
    expect(events[0]?.triggerSource).toBe("manual");
    expect(events[0]?.idempotencyKey.includes(":manual:")).toBe(true);
    const scheduledKey = reminderKey(fixture.quoteId, fixture.revisionId!, "r1_24h");
    expect(events[0]?.idempotencyKey).not.toBe(scheduledKey);
  });

  it("manual reminder blocks invalid quote statuses", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    const accepted = await createQuoteFixture(t, {
      nowMs,
      status: "accepted",
      sentAt: nowMs - 80 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });

    await expect(
      t.action(internal.quoteReminderActions.sendManualReminderInternal, {
        quoteRequestId: accepted.quoteRequestId,
        nowMs,
      })
    ).rejects.toThrow("Manual reminders are only allowed for sent quotes");
  });

  it("writes missing_context when tally confirmation form is not configured", async () => {
    const t = convexTest(schema, modules);
    const nowMs = 1_740_000_000_000;
    const fixture = await createQuoteFixture(t, {
      nowMs,
      status: "sent",
      sentAt: nowMs - 30 * 60 * 60 * 1000,
      expiresAt: nowMs + 5 * 24 * 60 * 60 * 1000,
    });

    await t.run(async (ctx) => {
      const integrations = await ctx.db
        .query("organizationIntegrations")
        .withIndex("by_org_provider", (q) => q.eq("organizationId", fixture.organizationId).eq("provider", "tally"))
        .collect();
      for (const row of integrations) {
        await ctx.db.patch(row._id, {
          confirmationFormId: undefined,
          formIds: {
            request: row.formIds?.request,
            confirmation: undefined,
          },
          status: "incomplete",
        });
      }
    });

    await t.action(internal.quoteReminderActions.sendDueQuoteReminders, {
      nowMs,
      dryRun: false,
    });

    const events = await listReminderEvents(t);
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("missing_context");
    expect(events[0]?.errorMessage).toContain("confirmation_form_url");
  });
});
