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
import {
  assertRecordInActiveOrg,
  requireActiveOrganization,
} from "./lib/orgContext";

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
  organizationId?: Id<"organizations">,
  serviceType?: string | null,
  frequency?: string | null,
  squareFootage?: number | null
): Promise<{ priceCents: number | null; source: "grid_auto" | "manual" }> {
  const serviceTypeNorm = normalize(serviceType);
  const frequencyNorm = normalize(frequency);
  const sqft = squareFootage ?? 0;

  const activeRules = organizationId
    ? await ctx.db
        .query("quotePricingRules")
        .withIndex("by_org_active", (q: any) =>
          q.eq("organizationId", organizationId).eq("isActive", true)
        )
        .collect()
    : await ctx.db
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
type UrgencyLevel = "normal" | "warning" | "critical" | "expired";

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

function getMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function computeUrgency(
  status: string | null,
  expiresAt?: number | null
): { urgencyLevel: UrgencyLevel; hoursUntilExpiry: number | null } {
  if (!status || !expiresAt) {
    return { urgencyLevel: "normal", hoursUntilExpiry: null };
  }
  const now = Date.now();
  if (status === "expired" || (status === "sent" && now > expiresAt)) {
    return { urgencyLevel: "expired", hoursUntilExpiry: 0 };
  }
  if (status !== "sent") {
    return { urgencyLevel: "normal", hoursUntilExpiry: null };
  }
  const hoursUntilExpiry = Math.max(0, Math.ceil((expiresAt - now) / (60 * 60 * 1000)));
  if (hoursUntilExpiry <= 24) {
    return { urgencyLevel: "critical", hoursUntilExpiry };
  }
  if (hoursUntilExpiry <= 72) {
    return { urgencyLevel: "warning", hoursUntilExpiry };
  }
  return { urgencyLevel: "normal", hoursUntilExpiry };
}

async function getProfileByKeyOrDefault(
  ctx: any,
  organizationId?: Id<"organizations">,
  key?: string | null
) {
  if (key) {
    const byKey = organizationId
      ? await ctx.db
          .query("quoteProfiles")
          .withIndex("by_org_key", (q: any) =>
            q.eq("organizationId", organizationId).eq("key", key)
          )
          .first()
      : await ctx.db
          .query("quoteProfiles")
          .withIndex("by_key", (q: any) => q.eq("key", key))
          .first();
    if (byKey) {
      return byKey;
    }
  }

  const defaultProfile = organizationId
    ? await ctx.db
        .query("quoteProfiles")
        .withIndex("by_org_key", (q: any) =>
          q.eq("organizationId", organizationId).eq("key", "kathy_clean_default")
        )
        .first()
    : await ctx.db
        .query("quoteProfiles")
        .withIndex("by_key", (q: any) => q.eq("key", "kathy_clean_default"))
        .first();

  if (defaultProfile) {
    return defaultProfile;
  }

  if (organizationId) {
    return await ctx.db
      .query("quoteProfiles")
      .withIndex("by_organization", (q: any) => q.eq("organizationId", organizationId))
      .first();
  }

  return await ctx.db.query("quoteProfiles").first();
}

export const ensureDraftFromRequest = mutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  handler: async (ctx, args): Promise<Id<"quotes">> => {
    const { organization } = await requireActiveOrganization(ctx);

    await ctx.runMutation(internal.quoteProfiles.ensureDefaultProfile, {
      organizationId: organization._id,
    });
    await ctx.runMutation(internal.quotePricing.ensureDefaultRules, {
      organizationId: organization._id,
    });
    await ctx.runMutation(internal.sequences.ensureQuoteNumberSequence, {
      startAt: 989,
    });

    const quoteRequest = await ctx.db.get(args.quoteRequestId);
    if (!quoteRequest) {
      throw new Error("Quote request not found");
    }
    assertRecordInActiveOrg(quoteRequest.organizationId, organization._id);

    const existing = await ctx.db
      .query("quotes")
      .withIndex("by_org_quote_request", (q) =>
        q.eq("organizationId", organization._id).eq("quoteRequestId", args.quoteRequestId)
      )
      .first();
    if (existing) {
      return existing._id;
    }

    const profile = await getProfileByKeyOrDefault(ctx, organization._id);
    if (!profile) {
      throw new Error("Quote profile not found");
    }

    const quoteNumber: number = await ctx.runMutation(internal.sequences.nextQuoteNumber, {});
    const suggested = await getSuggestedPriceInternal(
      ctx,
      organization._id,
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
      organizationId: organization._id,
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
      organizationId: organization._id,
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
    const { organization } = await requireActiveOrganization(ctx);
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_org_quote_request", (q) =>
        q.eq("organizationId", organization._id).eq("quoteRequestId", args.quoteRequestId)
      )
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
      organizationId: organization._id,
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
    const { organization } = await requireActiveOrganization(ctx);
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_org_quote_request", (q) =>
        q.eq("organizationId", organization._id).eq("quoteRequestId", args.quoteRequestId)
      )
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
    const { organization } = await requireActiveOrganization(ctx);
    const quoteRequest = await ctx.db.get(args.quoteRequestId);
    if (!quoteRequest) {
      return null;
    }
    assertRecordInActiveOrg(quoteRequest.organizationId, organization._id);

    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_org_quote_request", (q) =>
        q.eq("organizationId", organization._id).eq("quoteRequestId", args.quoteRequestId)
      )
      .first();

    const bookingRequest = quoteRequest.bookingRequestId
      ? await ctx.db.get(quoteRequest.bookingRequestId)
      : null;
    const pricingSuggestion = await getSuggestedPriceInternal(
      ctx,
      organization._id,
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
    const profile = await getProfileByKeyOrDefault(
      ctx,
      organization._id,
      quote.profileKey
    );
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
    const { organization } = await requireActiveOrganization(ctx);
    const revision = await ctx.db.get(args.revisionId);
    if (revision) {
      assertRecordInActiveOrg(revision.organizationId, organization._id);
    }
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
    const { organization } = await requireActiveOrganization(ctx);
    const limit = args.limit ?? 50;
    const now = Date.now();
    const requests = await ctx.db
      .query("quoteRequests")
      .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(limit);

    const rows = await Promise.all(
      requests.map(async (request) => {
        const quote = await ctx.db
          .query("quotes")
          .withIndex("by_org_quote_request", (q) =>
            q.eq("organizationId", organization._id).eq("quoteRequestId", request._id)
          )
          .first();

        if (!quote) {
          return {
            ...request,
            boardColumn: (request.requestStatus as BoardColumn) ?? "requested",
            quoteStatus: null,
            quoteId: null,
            isQuoteExpired: false,
            sentAt: null,
            expiresAt: null,
            hoursUntilExpiry: null,
            urgencyLevel: "normal" as UrgencyLevel,
          };
        }

        const isQuoteExpired =
          quote.status === "sent" && Boolean(quote.expiresAt) && now > (quote.expiresAt ?? 0);
        const effectiveQuoteStatus = isQuoteExpired ? "expired" : quote.status;
        const urgency = computeUrgency(effectiveQuoteStatus, quote.expiresAt ?? null);
        return {
          ...request,
          boardColumn: mapQuoteStatusToBoardColumn(effectiveQuoteStatus),
          quoteStatus: effectiveQuoteStatus,
          quoteId: quote._id,
          isQuoteExpired,
          sentAt: quote.sentAt ?? null,
          expiresAt: quote.expiresAt ?? null,
          hoursUntilExpiry: urgency.hoursUntilExpiry,
          urgencyLevel: urgency.urgencyLevel,
        };
      })
    );

    return rows.sort((a, b) => {
      if (a.boardColumn === "quoted" && b.boardColumn === "quoted") {
        const aExpires = typeof a.expiresAt === "number" ? a.expiresAt : Number.MAX_SAFE_INTEGER;
        const bExpires = typeof b.expiresAt === "number" ? b.expiresAt : Number.MAX_SAFE_INTEGER;
        if (aExpires !== bExpires) return aExpires - bExpires;
        const aSent = typeof a.sentAt === "number" ? a.sentAt : Number.MAX_SAFE_INTEGER;
        const bSent = typeof b.sentAt === "number" ? b.sentAt : Number.MAX_SAFE_INTEGER;
        if (aSent !== bSent) return aSent - bSent;
      }
      return b.createdAt - a.createdAt;
    });
  },
});

export const moveBoardCard = mutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    targetColumn: v.union(v.literal("requested"), v.literal("quoted"), v.literal("confirmed")),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const request = await ctx.db.get(args.quoteRequestId);
    if (!request) {
      throw new Error("Quote request not found");
    }
    assertRecordInActiveOrg(request.organizationId, organization._id);

    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_org_quote_request", (q) =>
        q.eq("organizationId", organization._id).eq("quoteRequestId", args.quoteRequestId)
      )
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
        const profile = await getProfileByKeyOrDefault(
          ctx,
          organization._id,
          quote.profileKey
        );
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
    const { organization } = await requireActiveOrganization(ctx);
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_org_quote_request", (q) =>
        q.eq("organizationId", organization._id).eq("quoteRequestId", args.quoteRequestId)
      )
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
          quoteRequestId: quote.quoteRequestId,
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

export const createQuoteReminderEvent = internalMutation({
  args: {
    quoteId: v.id("quotes"),
    quoteRequestId: v.id("quoteRequests"),
    bookingRequestId: v.optional(v.id("bookingRequests")),
    revisionId: v.optional(v.id("quoteRevisions")),
    stage: v.union(
      v.literal("r1_24h"),
      v.literal("r2_72h"),
      v.literal("r3_pre_expiry"),
      v.literal("manual")
    ),
    triggerSource: v.union(v.literal("cron"), v.literal("manual")),
    idempotencyKey: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
      v.literal("suppressed"),
      v.literal("missing_context")
    ),
    emailSendId: v.optional(v.id("emailSends")),
    errorMessage: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.quoteId);
    return await ctx.db.insert("quoteReminderEvents", {
      organizationId: quote?.organizationId,
      ...args,
      createdAt: Date.now(),
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
    const profile = await getProfileByKeyOrDefault(
      ctx,
      quote.organizationId,
      quote.profileKey
    );

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
      organizationId: quote.organizationId,
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
      const profile = await getProfileByKeyOrDefault(
        ctx,
        quote.organizationId,
        quote.profileKey
      );
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
    const { organization } = await requireActiveOrganization(ctx);
    const quoteRequest = await ctx.runQuery(internal.quoteRequests.getQuoteRequestById, {
      id: args.quoteRequestId,
    });
    if (!quoteRequest) {
      throw new Error("Quote request not found");
    }
    assertRecordInActiveOrg(quoteRequest.organizationId, organization._id);

    return await ctx.runAction(internal.quoteSendActions.sendRevisionNode, {
      quoteRequestId: args.quoteRequestId,
      revisionId: args.revisionId,
    });
  },
});

export const sendManualReminder = action({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  handler: async (ctx, args): Promise<{
    eventId: Id<"quoteReminderEvents">;
    status: "sent" | "failed" | "skipped" | "suppressed" | "missing_context";
    idempotencyKey: string;
  }> => {
    const { organization } = await requireActiveOrganization(ctx);
    const quoteRequest = await ctx.runQuery(internal.quoteRequests.getQuoteRequestById, {
      id: args.quoteRequestId,
    });
    if (!quoteRequest) {
      throw new Error("Quote request not found");
    }
    assertRecordInActiveOrg(quoteRequest.organizationId, organization._id);

    return await ctx.runAction(internal.quoteReminderActions.sendManualReminderInternal, {
      quoteRequestId: args.quoteRequestId,
    });
  },
});

export const getQuoteReminderTimeline = query({
  args: {
    quoteRequestId: v.id("quoteRequests"),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_org_quote_request", (q) =>
        q.eq("organizationId", organization._id).eq("quoteRequestId", args.quoteRequestId)
      )
      .first();
    if (!quote) {
      return [];
    }

    const events = await ctx.db
      .query("quoteReminderEvents")
      .withIndex("by_org_quote_created", (q) =>
        q.eq("organizationId", organization._id).eq("quoteId", quote._id)
      )
      .collect();

    return events.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getQuoteFunnelMetrics = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const days = args.days ?? 30;
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    const quoteRequests = (
      await ctx.db
        .query("quoteRequests")
        .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
        .collect()
    ).filter((request) => request.createdAt >= cutoff);
    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
      .collect();
    const quotesByRequestId = new Map<string, (typeof quotes)[number]>();
    for (const quote of quotes) {
      if (!quotesByRequestId.has(quote.quoteRequestId)) {
        quotesByRequestId.set(quote.quoteRequestId, quote);
      }
    }

    const requestedCount = quoteRequests.length;
    let quotedCount = 0;
    let confirmedCount = 0;
    const timeToQuoteValues: number[] = [];
    const timeToConfirmValues: number[] = [];

    for (const request of quoteRequests) {
      const quote = quotesByRequestId.get(request._id);
      if (!quote) continue;

      if (typeof quote.sentAt === "number") {
        quotedCount += 1;
        const timeToQuote = quote.sentAt - request.createdAt;
        if (timeToQuote >= 0) {
          timeToQuoteValues.push(timeToQuote);
        }
      }

      if (typeof quote.acceptedAt === "number") {
        confirmedCount += 1;
        if (typeof quote.sentAt === "number") {
          const timeToConfirm = quote.acceptedAt - quote.sentAt;
          if (timeToConfirm >= 0) {
            timeToConfirmValues.push(timeToConfirm);
          }
        }
      }
    }

    return {
      windowDays: days,
      requestedCount,
      quotedCount,
      confirmedCount,
      quotedRate: requestedCount > 0 ? quotedCount / requestedCount : 0,
      confirmedRate: requestedCount > 0 ? confirmedCount / requestedCount : 0,
      medianTimeToQuoteMs: getMedian(timeToQuoteValues),
      medianTimeToConfirmMs: getMedian(timeToConfirmValues),
    };
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
    const { organization } = await requireActiveOrganization(ctx);
    const quoteRequest = await ctx.runQuery(internal.quoteRequests.getQuoteRequestById, {
      id: args.quoteRequestId,
    });
    if (!quoteRequest) {
      throw new Error("Quote request not found");
    }
    assertRecordInActiveOrg(quoteRequest.organizationId, organization._id);

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
