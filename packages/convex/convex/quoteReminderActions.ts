"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { extractBrandFromProfile } from "./lib/brandUtils";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type ReminderStage = "r1_24h" | "r2_72h" | "r3_pre_expiry" | "manual";
type ReminderEventStatus = "sent" | "failed" | "skipped" | "suppressed" | "missing_context";

function isStageDue(
  stage: Exclude<ReminderStage, "manual">,
  nowMs: number,
  sentAt?: number,
  expiresAt?: number
): boolean {
  if (stage === "r1_24h") {
    return typeof sentAt === "number" && nowMs >= sentAt + DAY_MS;
  }
  if (stage === "r2_72h") {
    return typeof sentAt === "number" && nowMs >= sentAt + 3 * DAY_MS;
  }
  return typeof expiresAt === "number" && nowMs >= expiresAt - DAY_MS && nowMs < expiresAt;
}

function stageIdempotencyKey(
  quoteId: string,
  latestSentRevisionId: string,
  stage: Exclude<ReminderStage, "manual">
): string {
  return `quote-reminder:${quoteId}:${latestSentRevisionId}:${stage}`;
}

function manualHourBucket(nowMs: number): string {
  const date = new Date(nowMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${year}${month}${day}${hour}`;
}

function buildConfirmUrl(baseUrl: string, bookingRequestId: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("request_id", bookingRequestId);
  return url.toString();
}

function mapSendResultToEventStatus(sendResult: any): ReminderEventStatus {
  if (sendResult?.skipped) {
    return sendResult.reason === "suppressed" ? "suppressed" : "skipped";
  }
  return "sent";
}

async function createReminderEvent(
  ctx: any,
  args: {
    quoteId: Id<"quotes">;
    quoteRequestId: Id<"quoteRequests">;
    bookingRequestId?: Id<"bookingRequests">;
    revisionId?: Id<"quoteRevisions">;
    stage: ReminderStage;
    triggerSource: "cron" | "manual";
    idempotencyKey: string;
    status: ReminderEventStatus;
    emailSendId?: Id<"emailSends">;
    errorMessage?: string;
    sentAt?: number;
  }
) {
  return await ctx.runMutation(internal.quotes.createQuoteReminderEvent, args);
}

async function markMissingContextAndLog(
  ctx: any,
  args: {
    quoteId: Id<"quotes">;
    quoteRequestId: Id<"quoteRequests">;
    bookingRequestId?: Id<"bookingRequests">;
    revisionId?: Id<"quoteRevisions">;
    stage: ReminderStage;
    triggerSource: "cron" | "manual";
    idempotencyKey: string;
    missingContext: string[];
  }
) {
  await ctx.runMutation(internal.quotes.markQuoteRequiresReview, {
    quoteId: args.quoteId,
    reason: "reminder_missing_delivery_context",
  });
  return await createReminderEvent(ctx, {
    quoteId: args.quoteId,
    quoteRequestId: args.quoteRequestId,
    bookingRequestId: args.bookingRequestId,
    revisionId: args.revisionId,
    stage: args.stage,
    triggerSource: args.triggerSource,
    idempotencyKey: args.idempotencyKey,
    status: "missing_context",
    errorMessage: `Missing ${args.missingContext.join(",")}`,
  });
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
      stage: Exclude<ReminderStage, "manual">;
      idempotencyKey: string;
      action: "sent" | "dry_run_due" | "failed" | "missing_context" | "suppressed" | "skipped";
      error?: string;
      eventId?: Id<"quoteReminderEvents">;
    }>;
  }> => {
    const nowMs = args.nowMs ?? Date.now();
    const dryRun = args.dryRun ?? false;

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
      stage: Exclude<ReminderStage, "manual">;
      idempotencyKey: string;
      action: "sent" | "dry_run_due" | "failed" | "missing_context" | "suppressed" | "skipped";
      error?: string;
      eventId?: Id<"quoteReminderEvents">;
    }> = [];

    for (const quote of sentQuotes) {
      const stageOrder: Array<Exclude<ReminderStage, "manual">> = [
        "r1_24h",
        "r2_72h",
        "r3_pre_expiry",
      ];
      const dueStages = stageOrder.filter((stage) =>
        isStageDue(stage, nowMs, quote.sentAt, quote.expiresAt)
      );
      if (dueStages.length === 0) {
        continue;
      }

      let selected:
        | {
            stage: Exclude<ReminderStage, "manual">;
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
        if (
          priorSend &&
          [
            "queued",
            "sent",
            "delivered",
            "delivery_delayed",
            "skipped",
          ].includes(priorSend.status)
        ) {
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

      const formLinks = quote.organizationId
        ? await ctx.runQuery(internal.integrations.getTallyFormLinksByOrganizationIdInternal, {
            organizationId: quote.organizationId,
          })
        : null;
      const confirmBaseUrl = formLinks?.confirmationFormUrl ?? "";
      const missingContext: string[] = [];
      if (!confirmBaseUrl) {
        missingContext.push("confirmation_form_url");
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
        const eventId = await markMissingContextAndLog(ctx, {
          quoteId: quote._id,
          quoteRequestId: quote.quoteRequestId,
          bookingRequestId: quote.bookingRequestId ?? undefined,
          revisionId: quote.latestSentRevisionId ?? undefined,
          stage: selected.stage,
          triggerSource: "cron",
          idempotencyKey: selected.idempotencyKey,
          missingContext,
        });
        reviewFlaggedCount += 1;
        results.push({
          quoteId: quote._id,
          stage: selected.stage,
          idempotencyKey: selected.idempotencyKey,
          action: "missing_context",
          error: `Missing ${missingContext.join(",")}`,
          eventId,
        });
        continue;
      }

      const confirmUrlObj = new URL(buildConfirmUrl(confirmBaseUrl, quote.bookingRequestId));
      const canonicalRoute = await ctx.runQuery(internal.bookingRequests.resolveCanonicalBookingRouteInternal, {
        requestId: quote.bookingRequestId,
      });
      if (canonicalRoute?.handle) {
        confirmUrlObj.searchParams.set("org_slug", canonicalRoute.handle);
      }
      const confirmUrl = confirmUrlObj.toString();

      try {
        const profile = quote.organizationId
          ? await ctx.runQuery(internal.quoteProfiles.getProfileByOrganizationIdInternal, { organizationId: quote.organizationId })
          : null;
        const sendResult = await ctx.runAction(internal.emailRenderers.sendQuoteReminderEmail, {
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
          brand: extractBrandFromProfile(profile),
        });

        const status = mapSendResultToEventStatus(sendResult);
        const eventId = await createReminderEvent(ctx, {
          quoteId: quote._id,
          quoteRequestId: quote.quoteRequestId,
          bookingRequestId: quote.bookingRequestId ?? undefined,
          revisionId: quote.latestSentRevisionId ?? undefined,
          stage: selected.stage,
          triggerSource: "cron",
          idempotencyKey: selected.idempotencyKey,
          status,
          emailSendId: sendResult?.sendId as Id<"emailSends"> | undefined,
          sentAt: status === "sent" ? nowMs : undefined,
        });

        if (status === "sent") {
          sentCount += 1;
        }
        results.push({
          quoteId: quote._id,
          stage: selected.stage,
          idempotencyKey: selected.idempotencyKey,
          action: status,
          eventId,
        });
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : "Unknown reminder send error";
        const eventId = await createReminderEvent(ctx, {
          quoteId: quote._id,
          quoteRequestId: quote.quoteRequestId,
          bookingRequestId: quote.bookingRequestId ?? undefined,
          revisionId: quote.latestSentRevisionId ?? undefined,
          stage: selected.stage,
          triggerSource: "cron",
          idempotencyKey: selected.idempotencyKey,
          status: "failed",
          errorMessage: message,
        });
        results.push({
          quoteId: quote._id,
          stage: selected.stage,
          idempotencyKey: selected.idempotencyKey,
          action: "failed",
          error: message,
          eventId,
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

export const sendManualReminderInternal = internalAction({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    nowMs: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    eventId: Id<"quoteReminderEvents">;
    status: ReminderEventStatus;
    idempotencyKey: string;
  }> => {
    const nowMs = args.nowMs ?? Date.now();
    const data: any = await ctx.runQuery(internal.quotes.getQuoteByRequestIdInternal, {
      quoteRequestId: args.quoteRequestId,
    });
    if (!data) {
      throw new Error("Quote not found");
    }

    const quote = data.quote;
    const quoteRequest = data.quoteRequest;
    if (!quote || !quoteRequest) {
      throw new Error("Quote context not found");
    }
    if (quote.status !== "sent") {
      throw new Error("Manual reminders are only allowed for sent quotes");
    }

    const revision =
      (quote.latestSentRevisionId
        ? data.revisions.find((entry: any) => entry._id === quote.latestSentRevisionId)
        : null) ?? data.currentRevision;

    const bookingRequestId = quote.bookingRequestId ?? quoteRequest.bookingRequestId;
    const idempotencyKey = `quote-reminder:${quote._id}:${quote.latestSentRevisionId ?? "missing"}:manual:${manualHourBucket(nowMs)}`;
    const formLinks = quote.organizationId
      ? await ctx.runQuery(internal.integrations.getTallyFormLinksByOrganizationIdInternal, {
          organizationId: quote.organizationId,
        })
      : null;
    const confirmBaseUrl = formLinks?.confirmationFormUrl ?? "";

    const missingContext: string[] = [];
    if (!confirmBaseUrl) {
      missingContext.push("confirmation_form_url");
    }
    if (!bookingRequestId) {
      missingContext.push("booking_request_id");
    }
    if (!quoteRequest.email) {
      missingContext.push("quote_request_email");
    }
    if (!quote.latestSentRevisionId) {
      missingContext.push("latest_sent_revision_id");
    }

    if (missingContext.length > 0) {
      await markMissingContextAndLog(ctx, {
        quoteId: quote._id,
        quoteRequestId: quoteRequest._id,
        bookingRequestId: bookingRequestId ?? undefined,
        revisionId: quote.latestSentRevisionId ?? undefined,
        stage: "manual",
        triggerSource: "manual",
        idempotencyKey,
        missingContext,
      });
      throw new Error(`Manual reminder blocked: missing ${missingContext.join(", ")}`);
    }

    const confirmUrlObj = new URL(buildConfirmUrl(confirmBaseUrl, bookingRequestId));
    const canonicalRoute = await ctx.runQuery(internal.bookingRequests.resolveCanonicalBookingRouteInternal, {
      requestId: bookingRequestId,
    });
    if (canonicalRoute?.handle) {
      confirmUrlObj.searchParams.set("org_slug", canonicalRoute.handle);
    }
    const confirmUrl = confirmUrlObj.toString();

    try {
      const profile = quote.organizationId
        ? await ctx.runQuery(internal.quoteProfiles.getProfileByOrganizationIdInternal, { organizationId: quote.organizationId })
        : null;
      const sendResult = await ctx.runAction(internal.emailRenderers.sendQuoteReminderEmail, {
        to: quoteRequest.email,
        idempotencyKey,
        firstName: revision?.recipientSnapshot?.firstName ?? quoteRequest.firstName ?? undefined,
        quoteNumber: quote.quoteNumber,
        totalCents: revision?.totalCents ?? 0,
        currency: revision?.currency ?? "usd",
        validUntilTimestamp: quote.expiresAt ?? nowMs + 30 * DAY_MS,
        confirmUrl,
        downloadUrl: revision?.pdfStorageId
          ? (await ctx.storage.getUrl(revision.pdfStorageId)) ?? undefined
          : undefined,
        serviceLabel: revision?.serviceLabel ?? undefined,
        reminderStage: "manual",
        brand: extractBrandFromProfile(profile),
      });

      const status = mapSendResultToEventStatus(sendResult);
      const eventId = await createReminderEvent(ctx, {
        quoteId: quote._id,
        quoteRequestId: quoteRequest._id,
        bookingRequestId,
        revisionId: quote.latestSentRevisionId ?? undefined,
        stage: "manual",
        triggerSource: "manual",
        idempotencyKey,
        status,
        emailSendId: sendResult?.sendId as Id<"emailSends"> | undefined,
        sentAt: status === "sent" ? nowMs : undefined,
      });

      return { eventId, status, idempotencyKey };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send manual reminder";
      const eventId = await createReminderEvent(ctx, {
        quoteId: quote._id,
        quoteRequestId: quoteRequest._id,
        bookingRequestId,
        revisionId: quote.latestSentRevisionId ?? undefined,
        stage: "manual",
        triggerSource: "manual",
        idempotencyKey,
        status: "failed",
        errorMessage: message,
      });
      throw new Error(`Manual reminder failed (${eventId}): ${message}`);
    }
  },
});
