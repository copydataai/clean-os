import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  getInclusionsSnapshot,
  getServiceDescription,
  getServiceLabel,
  getTermsSnapshot,
} from "./quoteContent";

function normalize(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .trim();
}

function computeMoney(args: {
  quantity: number;
  unitPriceCents: number;
  taxRateBps: number;
}) {
  const subtotalCents = Math.round(args.quantity * args.unitPriceCents);
  const taxAmountCents = Math.round((subtotalCents * args.taxRateBps) / 10000);
  const totalCents = subtotalCents + taxAmountCents;
  return { subtotalCents, taxAmountCents, totalCents };
}

async function getSuggestedPriceInternal(
  ctx: any,
  serviceType?: string | null,
  frequency?: string | null,
  squareFootage?: number | null
): Promise<{ priceCents: number | null; source: "grid_auto" | "manual" }> {
  const serviceTypeNorm = normalize(serviceType);
  const frequencyNorm = normalize(frequency);
  const sqft = squareFootage ?? 0;

  const activeRules = await ctx.db
    .query("quotePricingRules")
    .withIndex("by_active", (q: any) => q.eq("isActive", true))
    .collect();

  const matches = activeRules
    .filter((rule: any) => {
      const serviceMatch =
        !serviceTypeNorm || normalize(rule.serviceType) === serviceTypeNorm;
      const frequencyMatch =
        !frequencyNorm || normalize(rule.frequency) === frequencyNorm;
      const sqftMatch = sqft >= rule.minSqft && sqft <= rule.maxSqft;
      return serviceMatch && frequencyMatch && sqftMatch;
    })
    .sort((a: any, b: any) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.minSqft - b.minSqft;
    });

  const best = matches[0] ?? null;
  return {
    priceCents: best?.priceCents ?? null,
    source: best ? "grid_auto" : "manual",
  };
}

function buildRecipientSnapshot(quoteRequest: any) {
  const firstName = quoteRequest.firstName ?? undefined;
  const lastName = quoteRequest.lastName ?? undefined;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    firstName,
    lastName,
    name: fullName.length > 0 ? fullName : undefined,
    email: quoteRequest.email ?? undefined,
    address: quoteRequest.address ?? undefined,
    addressLine2: quoteRequest.addressLine2 ?? undefined,
    city: quoteRequest.city ?? undefined,
    state: quoteRequest.state ?? undefined,
    postalCode: quoteRequest.postalCode ?? undefined,
  };
}

type BoardColumn = "requested" | "quoted" | "confirmed";

function mapQuoteStatusToBoardColumn(quoteStatus: string): BoardColumn {
  if (quoteStatus === "accepted") {
    return "confirmed";
  }
  if (quoteStatus === "sent" || quoteStatus === "expired") {
    return "quoted";
  }
  return "requested";
}

function mapBoardColumnToQuoteStatus(column: BoardColumn): "draft" | "sent" | "accepted" {
  if (column === "confirmed") {
    return "accepted";
  }
  if (column === "quoted") {
    return "sent";
  }
  return "draft";
}

async function getProfileByKeyOrDefault(ctx: any, key?: string | null) {
  if (key) {
    const byKey = await ctx.db
      .query("quoteProfiles")
      .withIndex("by_key", (q: any) => q.eq("key", key))
      .first();
    if (byKey) {
      return byKey;
    }
  }

  const defaultProfile = await ctx.db
    .query("quoteProfiles")
    .withIndex("by_key", (q: any) => q.eq("key", "kathy_clean_default"))
    .first();

  if (defaultProfile) {
    return defaultProfile;
  }

  return await ctx.db.query("quoteProfiles").first();
}

export const ensureDraftFromRequest = mutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  handler: async (ctx, args): Promise<Id<"quotes">> => {
    await ctx.runMutation(internal.quoteProfiles.ensureDefaultProfile, {});
    await ctx.runMutation(internal.quotePricing.ensureDefaultRules, {});
    await ctx.runMutation(internal.sequences.ensureQuoteNumberSequence, {
      startAt: 989,
    });

    const quoteRequest = await ctx.db.get(args.quoteRequestId);
    if (!quoteRequest) {
      throw new Error("Quote request not found");
    }

    const existing = await ctx.db
      .query("quotes")
      .withIndex("by_quote_request", (q) => q.eq("quoteRequestId", args.quoteRequestId))
      .first();
    if (existing) {
      return existing._id;
    }

    const profile = await getProfileByKeyOrDefault(ctx);
    if (!profile) {
      throw new Error("Quote profile not found");
    }

    const quoteNumber: number = await ctx.runMutation(internal.sequences.nextQuoteNumber, {});
    const suggested = await getSuggestedPriceInternal(
      ctx,
      quoteRequest.serviceType ?? quoteRequest.service,
      quoteRequest.frequency,
      quoteRequest.squareFootage
    );

    const unitPriceCents = suggested.priceCents ?? 0;
    const quantity = 1;
    const taxRateBps = profile.defaultTaxRateBps ?? 0;
    const computed = computeMoney({
      quantity,
      unitPriceCents,
      taxRateBps,
    });
    const now = Date.now();

    const quoteId: Id<"quotes"> = await ctx.db.insert("quotes", {
      quoteRequestId: args.quoteRequestId,
      bookingRequestId: quoteRequest.bookingRequestId ?? undefined,
      quoteNumber,
      status: "draft",
      profileKey: profile.key,
      requiresReview: false,
      createdAt: now,
      updatedAt: now,
    });

    const serviceLabel = getServiceLabel(quoteRequest.serviceType ?? quoteRequest.service);
    const revisionId = await ctx.db.insert("quoteRevisions", {
      quoteId,
      revisionNumber: 1,
      source: suggested.source,
      serviceLabel,
      description: getServiceDescription(serviceLabel),
      quantity,
      unitPriceCents,
      subtotalCents: computed.subtotalCents,
      taxName: profile.defaultTaxName,
      taxRateBps,
      taxAmountCents: computed.taxAmountCents,
      totalCents: computed.totalCents,
      currency: profile.defaultCurrency ?? "usd",
      recipientSnapshot: buildRecipientSnapshot(quoteRequest),
      inclusionsSnapshot: getInclusionsSnapshot(),
      termsSnapshot: getTermsSnapshot(),
      sendStatus: "draft",
      createdAt: now,
    });

    await ctx.db.patch(quoteId, {
      currentRevisionId: revisionId,
      updatedAt: Date.now(),
    });

    return quoteId;
  },
});

export const saveDraftRevision = mutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    source: v.optional(
      v.union(v.literal("grid_auto"), v.literal("manual_override"), v.literal("manual"))
    ),
    serviceLabel: v.optional(v.string()),
    description: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unitPriceCents: v.optional(v.number()),
    taxName: v.optional(v.string()),
    taxRateBps: v.optional(v.number()),
    currency: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_quote_request", (q) => q.eq("quoteRequestId", args.quoteRequestId))
      .first();
    if (!quote) {
      throw new Error("Quote not found. Open quote detail first.");
    }

    const currentRevision = quote.currentRevisionId
      ? await ctx.db.get(quote.currentRevisionId)
      : null;
    if (!currentRevision) {
      throw new Error("Current revision not found");
    }

    const quantity = args.quantity ?? currentRevision.quantity;
    const unitPriceCents = args.unitPriceCents ?? currentRevision.unitPriceCents;
    const taxRateBps = args.taxRateBps ?? currentRevision.taxRateBps;
    const computed = computeMoney({ quantity, unitPriceCents, taxRateBps });
    const now = Date.now();

    const revisionCount = await ctx.db
      .query("quoteRevisions")
      .withIndex("by_quote", (q) => q.eq("quoteId", quote._id))
      .collect();
    const revisionNumber =
      revisionCount.length === 0
        ? 1
        : Math.max(...revisionCount.map((r) => r.revisionNumber)) + 1;

    const source =
      args.source ??
      (args.unitPriceCents !== undefined || args.taxRateBps !== undefined
        ? "manual_override"
        : "manual");

    const revisionId = await ctx.db.insert("quoteRevisions", {
      quoteId: quote._id,
      revisionNumber,
      source,
      serviceLabel: args.serviceLabel ?? currentRevision.serviceLabel,
      description: args.description ?? currentRevision.description,
      quantity,
      unitPriceCents,
      subtotalCents: computed.subtotalCents,
      taxName: args.taxName ?? currentRevision.taxName,
      taxRateBps,
      taxAmountCents: computed.taxAmountCents,
      totalCents: computed.totalCents,
      currency: args.currency ?? currentRevision.currency,
      recipientSnapshot: currentRevision.recipientSnapshot,
      inclusionsSnapshot: currentRevision.inclusionsSnapshot,
      termsSnapshot: currentRevision.termsSnapshot,
      notes: args.notes ?? currentRevision.notes,
      sendStatus: "draft",
      createdAt: now,
    });

    await ctx.db.patch(quote._id, {
      status: "draft",
      currentRevisionId: revisionId,
      updatedAt: now,
    });

    return revisionId;
  },
});

export const listRevisions = query({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_quote_request", (q) => q.eq("quoteRequestId", args.quoteRequestId))
      .first();
    if (!quote) {
      return [];
    }

    const revisions = await ctx.db
      .query("quoteRevisions")
      .withIndex("by_quote", (q) => q.eq("quoteId", quote._id))
      .collect();

    return revisions.sort((a, b) => b.revisionNumber - a.revisionNumber);
  },
});

export const getQuoteDetailByRequestId = query({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  handler: async (ctx, args) => {
    const quoteRequest = await ctx.db.get(args.quoteRequestId);
    if (!quoteRequest) {
      return null;
    }

    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_quote_request", (q) => q.eq("quoteRequestId", args.quoteRequestId))
      .first();

    const bookingRequest = quoteRequest.bookingRequestId
      ? await ctx.db.get(quoteRequest.bookingRequestId)
      : null;
    const pricingSuggestion = await getSuggestedPriceInternal(
      ctx,
      quoteRequest.serviceType ?? quoteRequest.service,
      quoteRequest.frequency,
      quoteRequest.squareFootage
    );

    if (!quote) {
      return {
        quoteRequest,
        quote: null,
        bookingRequest,
        profile: null,
        currentRevision: null,
        revisions: [],
        pricingSuggestion,
        isExpired: false,
      };
    }

    const revisions = await ctx.db
      .query("quoteRevisions")
      .withIndex("by_quote", (q) => q.eq("quoteId", quote._id))
      .collect();
    revisions.sort((a, b) => b.revisionNumber - a.revisionNumber);

    const currentRevision = quote.currentRevisionId
      ? await ctx.db.get(quote.currentRevisionId)
      : revisions[0] ?? null;
    const profile = await getProfileByKeyOrDefault(ctx, quote.profileKey);
    const isExpired =
      Boolean(quote.expiresAt) &&
      quote.status === "sent" &&
      Date.now() > (quote.expiresAt ?? 0);

    return {
      quoteRequest,
      quote,
      bookingRequest,
      profile,
      currentRevision,
      revisions,
      pricingSuggestion,
      isExpired,
    };
  },
});

export const getRevisionPdfUrl = query({
  args: {
    revisionId: v.id("quoteRevisions"),
  },
  handler: async (ctx, args) => {
    const revision = await ctx.db.get(args.revisionId);
    if (!revision?.pdfStorageId) {
      return null;
    }
    return await ctx.storage.getUrl(revision.pdfStorageId);
  },
});

export const listQuoteBoard = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const now = Date.now();
    const requests = await ctx.db.query("quoteRequests").order("desc").take(limit);

    return await Promise.all(
      requests.map(async (request) => {
        const quote = await ctx.db
          .query("quotes")
          .withIndex("by_quote_request", (q) => q.eq("quoteRequestId", request._id))
          .first();

        if (!quote) {
          return {
            ...request,
            boardColumn: (request.requestStatus as BoardColumn) ?? "requested",
            quoteStatus: null,
            quoteId: null,
            isQuoteExpired: false,
          };
        }

        const isQuoteExpired =
          quote.status === "sent" && Boolean(quote.expiresAt) && now > (quote.expiresAt ?? 0);
        const effectiveQuoteStatus = isQuoteExpired ? "expired" : quote.status;
        return {
          ...request,
          boardColumn: mapQuoteStatusToBoardColumn(effectiveQuoteStatus),
          quoteStatus: effectiveQuoteStatus,
          quoteId: quote._id,
          isQuoteExpired,
        };
      })
    );
  },
});

export const moveBoardCard = mutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    targetColumn: v.union(v.literal("requested"), v.literal("quoted"), v.literal("confirmed")),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.quoteRequestId);
    if (!request) {
      throw new Error("Quote request not found");
    }

    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_quote_request", (q) => q.eq("quoteRequestId", args.quoteRequestId))
      .first();

    const sourceBoardColumn: BoardColumn = quote
      ? mapQuoteStatusToBoardColumn(quote.status)
      : ((request.requestStatus as BoardColumn) ?? "requested");

    if (sourceBoardColumn === "confirmed" || args.targetColumn === "confirmed") {
      throw new Error("Confirmed status is webhook-only");
    }

    const now = Date.now();
    await ctx.db.patch(args.quoteRequestId, {
      requestStatus: args.targetColumn,
      updatedAt: now,
    });

    if (!quote) {
      return { requestStatus: args.targetColumn, quoteStatus: null };
    }

    const targetQuoteStatus = mapBoardColumnToQuoteStatus(args.targetColumn);
    const patch: Record<string, any> = {
      status: targetQuoteStatus,
      updatedAt: now,
    };

    if (targetQuoteStatus === "accepted") {
      patch.acceptedAt = now;
    } else {
      patch.acceptedAt = undefined;
      patch.requiresReview = false;
      patch.reviewReason = undefined;
    }

    if (targetQuoteStatus === "sent") {
      if (!quote.sentAt) {
        patch.sentAt = now;
      }
      if (!quote.expiresAt) {
        const profile = await getProfileByKeyOrDefault(ctx, quote.profileKey);
        const validityDays = profile?.quoteValidityDays ?? 30;
        patch.expiresAt = now + validityDays * 24 * 60 * 60 * 1000;
      }
    }

    if (targetQuoteStatus === "draft") {
      patch.expiresAt = quote.expiresAt;
    }

    await ctx.db.patch(quote._id, patch);
    return { requestStatus: args.targetColumn, quoteStatus: targetQuoteStatus };
  },
});

export const refreshExpiryStatus = mutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_quote_request", (q) => q.eq("quoteRequestId", args.quoteRequestId))
      .first();
    if (!quote) {
      return null;
    }

    if (
      quote.status === "sent" &&
      quote.expiresAt &&
      Date.now() > quote.expiresAt
    ) {
      await ctx.db.patch(quote._id, {
        status: "expired",
        updatedAt: Date.now(),
      });
      return "expired";
    }

    return quote.status;
  },
});

export const expireSentQuotesSweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sentQuotes = await ctx.db
      .query("quotes")
      .withIndex("by_status", (q) => q.eq("status", "sent"))
      .collect();

    const now = Date.now();
    let expiredCount = 0;
    for (const quote of sentQuotes) {
      if (quote.expiresAt && quote.expiresAt < now) {
        await ctx.db.patch(quote._id, {
          status: "expired",
          updatedAt: now,
        });
        expiredCount += 1;
      }
    }

    return { scanned: sentQuotes.length, expiredCount };
  },
});

export const listSentQuotesForReminderSweep = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sentQuotes = await ctx.db
      .query("quotes")
      .withIndex("by_status", (q) => q.eq("status", "sent"))
      .collect();

    return await Promise.all(
      sentQuotes.map(async (quote) => {
        const quoteRequest = await ctx.db.get(quote.quoteRequestId);
        const revision = quote.latestSentRevisionId
          ? await ctx.db.get(quote.latestSentRevisionId)
          : null;
        const downloadUrl = revision?.pdfStorageId
          ? await ctx.storage.getUrl(revision.pdfStorageId)
          : null;

        return {
          _id: quote._id,
          quoteNumber: quote.quoteNumber,
          sentAt: quote.sentAt,
          expiresAt: quote.expiresAt,
          latestSentRevisionId: quote.latestSentRevisionId,
          bookingRequestId: quote.bookingRequestId ?? quoteRequest?.bookingRequestId ?? null,
          quoteRequestEmail: quoteRequest?.email ?? null,
          quoteRequestFirstName: quoteRequest?.firstName ?? null,
          recipientFirstName: revision?.recipientSnapshot?.firstName ?? null,
          totalCents: revision?.totalCents ?? 0,
          currency: revision?.currency ?? "usd",
          serviceLabel: revision?.serviceLabel ?? null,
          downloadUrl,
        };
      })
    );
  },
});

export const markQuoteRequiresReview = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteId, {
      requiresReview: true,
      reviewReason: args.reason,
      updatedAt: Date.now(),
    });
  },
});

export const getQuoteByRequestIdInternal = internalQuery({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_quote_request", (q) => q.eq("quoteRequestId", args.quoteRequestId))
      .first();
    if (!quote) {
      return null;
    }

    const quoteRequest = await ctx.db.get(args.quoteRequestId);
    if (!quoteRequest) {
      return null;
    }

    const revisions = await ctx.db
      .query("quoteRevisions")
      .withIndex("by_quote", (q) => q.eq("quoteId", quote._id))
      .collect();
    const currentRevision = quote.currentRevisionId
      ? await ctx.db.get(quote.currentRevisionId)
      : null;
    const profile = await getProfileByKeyOrDefault(ctx, quote.profileKey);

    return {
      quote,
      quoteRequest,
      revisions,
      currentRevision,
      profile,
    };
  },
});

export const markRevisionSendResult = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    revisionId: v.id("quoteRevisions"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    pdfStorageId: v.optional(v.id("_storage")),
    pdfFilename: v.optional(v.string()),
    emailSendId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    if (!quote) {
      return;
    }
    const revision = await ctx.db.get(args.revisionId);
    if (!revision) {
      return;
    }

    const now = Date.now();
    const patch: any = {
      sendStatus: args.status,
      sendError: args.errorMessage,
      pdfStorageId: args.pdfStorageId ?? revision.pdfStorageId,
      pdfFilename: args.pdfFilename ?? revision.pdfFilename,
      pdfGeneratedAt: args.pdfStorageId ? now : revision.pdfGeneratedAt,
      emailSendId: args.emailSendId,
      sentAt: args.status === "sent" ? now : revision.sentAt,
    };
    await ctx.db.patch(args.revisionId, patch);

    if (args.status === "sent") {
      const profile = await getProfileByKeyOrDefault(ctx, quote.profileKey);
      const validityDays = profile?.quoteValidityDays ?? 30;
      const expiresAt = now + validityDays * 24 * 60 * 60 * 1000;
      await ctx.db.patch(args.quoteId, {
        status: "sent",
        currentRevisionId: args.revisionId,
        latestSentRevisionId: args.revisionId,
        sentAt: now,
        expiresAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(args.quoteId, {
        status: "send_failed",
        currentRevisionId: args.revisionId,
        updatedAt: now,
      });
    }
  },
});

export const sendRevision = action({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    revisionId: v.optional(v.id("quoteRevisions")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    quoteId: Id<"quotes">;
    revisionId: Id<"quoteRevisions">;
    storageId: Id<"_storage">;
    downloadUrl: string | null;
  }> => {
    return await ctx.runAction(internal.quoteSendActions.sendRevisionNode, {
      quoteRequestId: args.quoteRequestId,
      revisionId: args.revisionId,
    });
  },
});

export const retrySendRevision = action({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    revisionId: v.id("quoteRevisions"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    quoteId: Id<"quotes">;
    revisionId: Id<"quoteRevisions">;
    storageId: Id<"_storage">;
    downloadUrl: string | null;
  }> => {
    return await ctx.runAction(internal.quoteSendActions.retrySendRevisionNode, {
      quoteRequestId: args.quoteRequestId,
      revisionId: args.revisionId,
    });
  },
});

export const onBookingRequestConfirmed = internalMutation({
  args: {
    bookingRequestId: v.id("bookingRequests"),
  },
  handler: async (ctx, args) => {
    const bookingRequest = await ctx.db.get(args.bookingRequestId);
    if (!bookingRequest?.quoteRequestId) {
      return null;
    }

    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_quote_request", (q) => q.eq("quoteRequestId", bookingRequest.quoteRequestId!))
      .first();
    if (!quote) {
      return null;
    }

    const now = Date.now();
    const isExpired = Boolean(quote.expiresAt) && now > (quote.expiresAt ?? 0);
    await ctx.db.patch(quote._id, {
      status: "accepted",
      acceptedAt: now,
      requiresReview: isExpired ? true : quote.requiresReview,
      reviewReason: isExpired ? "confirmed_after_expiry" : quote.reviewReason,
      updatedAt: now,
    });

    return quote._id;
  },
});
