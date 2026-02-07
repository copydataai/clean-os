"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type ReminderStage = "r1_24h" | "r2_72h" | "r3_pre_expiry";

function isStageDue(stage: ReminderStage, nowMs: number, sentAt?: number, expiresAt?: number): boolean {
  if (stage === "r1_24h") {
    return typeof sentAt === "number" && nowMs >= sentAt + DAY_MS;
  }
  if (stage === "r2_72h") {
    return typeof sentAt === "number" && nowMs >= sentAt + 3 * DAY_MS;
  }
  return (
    typeof expiresAt === "number" &&
    nowMs >= expiresAt - DAY_MS &&
    nowMs < expiresAt
  );
}

function stageIdempotencyKey(
  quoteId: string,
  latestSentRevisionId: string,
  stage: ReminderStage
): string {
  return `quote-reminder:${quoteId}:${latestSentRevisionId}:${stage}`;
}

function buildConfirmUrl(baseUrl: string, bookingRequestId: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("request_id", bookingRequestId);
  return url.toString();
}

export const sendDueQuoteReminders = internalAction({
  args: {
    nowMs: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    nowMs: number;
    dryRun: boolean;
    scanned: number;
    dueCount: number;
    sentCount: number;
    failedCount: number;
    reviewFlaggedCount: number;
    results: Array<{
      quoteId: string;
      stage: ReminderStage;
      idempotencyKey: string;
      action: "sent" | "dry_run_due" | "failed" | "missing_context";
      error?: string;
    }>;
  }> => {
    const nowMs = args.nowMs ?? Date.now();
    const dryRun = args.dryRun ?? false;
    const confirmBaseUrl = process.env.NEXT_PUBLIC_TALLY_CONFIRM_URL?.trim() ?? "";

    const sentQuotes: Array<any> = await ctx.runQuery(
      internal.quotes.listSentQuotesForReminderSweep,
      {}
    );

    let dueCount = 0;
    let sentCount = 0;
    let failedCount = 0;
    let reviewFlaggedCount = 0;
    const results: Array<{
      quoteId: string;
      stage: ReminderStage;
      idempotencyKey: string;
      action: "sent" | "dry_run_due" | "failed" | "missing_context";
      error?: string;
    }> = [];

    for (const quote of sentQuotes) {
      const stageOrder: ReminderStage[] = ["r1_24h", "r2_72h", "r3_pre_expiry"];
      const dueStages = stageOrder.filter((stage) =>
        isStageDue(stage, nowMs, quote.sentAt, quote.expiresAt)
      );
      if (dueStages.length === 0) {
        continue;
      }

      let selected:
        | {
            stage: ReminderStage;
            idempotencyKey: string;
          }
        | null = null;

      for (const stage of dueStages) {
        if (!quote.latestSentRevisionId) {
          selected = {
            stage,
            idempotencyKey: `quote-reminder:${quote._id}:missing_revision:${stage}`,
          };
          break;
        }

        const idempotencyKey = stageIdempotencyKey(quote._id, quote.latestSentRevisionId, stage);
        const priorSend = await ctx.runQuery(internal.emailSends.getByIdempotencyKey, {
          idempotencyKey,
        });
        if (priorSend && ["queued", "sent", "skipped"].includes(priorSend.status)) {
          continue;
        }

        selected = { stage, idempotencyKey };
        break;
      }

      if (!selected) {
        continue;
      }

      dueCount += 1;
      if (dryRun) {
        results.push({
          quoteId: quote._id,
          stage: selected.stage,
          idempotencyKey: selected.idempotencyKey,
          action: "dry_run_due",
        });
        continue;
      }

      const missingContext: string[] = [];
      if (!confirmBaseUrl) {
        missingContext.push("confirm_base_url");
      }
      if (!quote.bookingRequestId) {
        missingContext.push("booking_request_id");
      }
      if (!quote.quoteRequestEmail) {
        missingContext.push("quote_request_email");
      }
      if (!quote.latestSentRevisionId) {
        missingContext.push("latest_sent_revision_id");
      }

      if (missingContext.length > 0) {
        if (!dryRun) {
          await ctx.runMutation(internal.quotes.markQuoteRequiresReview, {
            quoteId: quote._id,
            reason: "reminder_missing_delivery_context",
          });
        }
        reviewFlaggedCount += 1;
        results.push({
          quoteId: quote._id,
          stage: selected.stage,
          idempotencyKey: selected.idempotencyKey,
          action: "missing_context",
          error: `Missing ${missingContext.join(",")}`,
        });
        continue;
      }

      const confirmUrl = buildConfirmUrl(confirmBaseUrl, quote.bookingRequestId);

      try {
        await ctx.runAction(internal.emailRenderers.sendQuoteReminderEmail, {
          to: quote.quoteRequestEmail,
          idempotencyKey: selected.idempotencyKey,
          firstName: quote.recipientFirstName ?? quote.quoteRequestFirstName ?? undefined,
          quoteNumber: quote.quoteNumber,
          totalCents: quote.totalCents,
          currency: quote.currency ?? "usd",
          validUntilTimestamp: quote.expiresAt ?? nowMs + 30 * DAY_MS,
          confirmUrl,
          downloadUrl: quote.downloadUrl ?? undefined,
          serviceLabel: quote.serviceLabel ?? undefined,
          reminderStage: selected.stage,
        });

        sentCount += 1;
        results.push({
          quoteId: quote._id,
          stage: selected.stage,
          idempotencyKey: selected.idempotencyKey,
          action: "sent",
        });
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : "Unknown reminder send error";
        results.push({
          quoteId: quote._id,
          stage: selected.stage,
          idempotencyKey: selected.idempotencyKey,
          action: "failed",
          error: message,
        });
      }
    }

    return {
      nowMs,
      dryRun,
      scanned: sentQuotes.length,
      dueCount,
      sentCount,
      failedCount,
      reviewFlaggedCount,
      results,
    };
  },
});
