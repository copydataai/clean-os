import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const FALLBACK_LOOKBACK_DAYS = 7;
const FALLBACK_SAMPLE_SIZE = 10;

export const createRequest = internalMutation({
  args: {
    requestResponseId: v.optional(v.string()),
    requestFormId: v.optional(v.string()),
    quoteRequestId: v.optional(v.id("quoteRequests")),
    email: v.optional(v.string()),
    contactDetails: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    accessMethod: v.optional(v.array(v.string())),
    accessInstructions: v.optional(v.string()),
    parkingInstructions: v.optional(v.string()),
    floorTypes: v.optional(v.array(v.string())),
    finishedBasement: v.optional(v.string()),
    delicateSurfaces: v.optional(v.string()),
    attentionAreas: v.optional(v.string()),
    pets: v.optional(v.array(v.string())),
    homeDuringCleanings: v.optional(v.string()),
    scheduleAdjustmentWindows: v.optional(v.array(v.string())),
    timingShiftOk: v.optional(v.string()),
    additionalNotes: v.optional(v.string()),
    rawRequestPayload: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<Id<"bookingRequests">> => {
    const customerId = args.email
      ? await ctx.runMutation(internal.customers.ensureLifecycleCustomer, {
          email: args.email,
          contactDetails: args.contactDetails,
          phone: args.phoneNumber,
          source: "booking_request",
        })
      : undefined;

    const now = Date.now();
    const requestId = await ctx.db.insert("bookingRequests", {
      status: "requested",
      requestResponseId: args.requestResponseId,
      requestFormId: args.requestFormId,
      quoteRequestId: args.quoteRequestId,
      customerId,
      email: args.email,
      contactDetails: args.contactDetails,
      phoneNumber: args.phoneNumber,
      accessMethod: args.accessMethod,
      accessInstructions: args.accessInstructions,
      parkingInstructions: args.parkingInstructions,
      floorTypes: args.floorTypes,
      finishedBasement: args.finishedBasement,
      delicateSurfaces: args.delicateSurfaces,
      attentionAreas: args.attentionAreas,
      pets: args.pets,
      homeDuringCleanings: args.homeDuringCleanings,
      scheduleAdjustmentWindows: args.scheduleAdjustmentWindows,
      timingShiftOk: args.timingShiftOk,
      additionalNotes: args.additionalNotes,
      rawRequestPayload: args.rawRequestPayload,
      createdAt: now,
      updatedAt: now,
    });

    if (customerId) {
      await ctx.runMutation(internal.customers.linkLifecycleRecordsToCustomer, {
        customerId,
        bookingRequestId: requestId,
        quoteRequestId: args.quoteRequestId,
      });
    }

    return requestId;
  },
});

export const confirmRequest = internalMutation({
  args: {
    requestId: v.optional(v.id("bookingRequests")),
    email: v.optional(v.string()),
    confirmationResponseId: v.optional(v.string()),
    confirmationFormId: v.optional(v.string()),
    quoteRequestId: v.optional(v.id("quoteRequests")),
    contactDetails: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    accessMethod: v.optional(v.array(v.string())),
    accessInstructions: v.optional(v.string()),
    parkingInstructions: v.optional(v.string()),
    floorTypes: v.optional(v.array(v.string())),
    finishedBasement: v.optional(v.string()),
    delicateSurfaces: v.optional(v.string()),
    attentionAreas: v.optional(v.string()),
    pets: v.optional(v.array(v.string())),
    homeDuringCleanings: v.optional(v.string()),
    scheduleAdjustmentWindows: v.optional(v.array(v.string())),
    timingShiftOk: v.optional(v.string()),
    additionalNotes: v.optional(v.string()),
    rawConfirmationPayload: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<Id<"bookingRequests"> | null> => {
    let request = args.requestId ? await ctx.db.get(args.requestId) : null;
    const normalizedEmail = args.email?.trim().toLowerCase();

    if (!request && args.email) {
      const candidates = await ctx.db
        .query("bookingRequests")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .order("desc")
        .take(FALLBACK_SAMPLE_SIZE);

      const normalizedCandidates =
        normalizedEmail && normalizedEmail !== args.email
          ? await ctx.db
              .query("bookingRequests")
              .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
              .order("desc")
              .take(FALLBACK_SAMPLE_SIZE)
          : [];

      const cutoff = Date.now() - FALLBACK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
      request =
        [...candidates, ...normalizedCandidates].find(
          (candidate) => candidate.createdAt >= cutoff
        ) ?? null;
    }

    if (!request) {
      if (args.requestId) {
        return null;
      }
      const customerId = args.email
        ? await ctx.runMutation(internal.customers.ensureLifecycleCustomer, {
            email: args.email,
            contactDetails: args.contactDetails,
            phone: args.phoneNumber,
            source: "booking_request",
          })
        : undefined;

      const now = Date.now();
      const createdId = await ctx.db.insert("bookingRequests", {
        status: "confirmed",
        confirmationResponseId: args.confirmationResponseId,
        confirmationFormId: args.confirmationFormId,
        quoteRequestId: args.quoteRequestId,
        customerId,
        email: args.email,
        contactDetails: args.contactDetails,
        phoneNumber: args.phoneNumber,
        accessMethod: args.accessMethod,
        accessInstructions: args.accessInstructions,
        parkingInstructions: args.parkingInstructions,
        floorTypes: args.floorTypes,
        finishedBasement: args.finishedBasement,
        delicateSurfaces: args.delicateSurfaces,
        attentionAreas: args.attentionAreas,
        pets: args.pets,
        homeDuringCleanings: args.homeDuringCleanings,
        scheduleAdjustmentWindows: args.scheduleAdjustmentWindows,
        timingShiftOk: args.timingShiftOk,
        additionalNotes: args.additionalNotes,
        rawConfirmationPayload: args.rawConfirmationPayload,
        createdAt: now,
        updatedAt: now,
        confirmedAt: now,
      });

      if (customerId) {
        await ctx.runMutation(internal.customers.linkLifecycleRecordsToCustomer, {
          customerId,
          bookingRequestId: createdId,
          quoteRequestId: args.quoteRequestId,
        });
      }

      if (args.quoteRequestId) {
        await ctx.runMutation(internal.quoteRequests.markConfirmed, {
          quoteRequestId: args.quoteRequestId,
        });
      }
      await ctx.runMutation(internal.quotes.onBookingRequestConfirmed, {
        bookingRequestId: createdId,
      });
      return createdId;
    }

    const nextEmail = args.email ?? request.email;
    const nextQuoteRequestId = args.quoteRequestId ?? request.quoteRequestId;
    const customerId = nextEmail
      ? await ctx.runMutation(internal.customers.ensureLifecycleCustomer, {
          email: nextEmail,
          contactDetails: args.contactDetails ?? request.contactDetails,
          phone: args.phoneNumber ?? request.phoneNumber,
          source: "booking_request",
        })
      : request.customerId;

    await ctx.db.patch(request._id, {
      status: "confirmed",
      confirmationResponseId: args.confirmationResponseId,
      confirmationFormId: args.confirmationFormId,
      quoteRequestId: nextQuoteRequestId,
      customerId,
      email: nextEmail,
      contactDetails: args.contactDetails ?? request.contactDetails,
      phoneNumber: args.phoneNumber ?? request.phoneNumber,
      accessMethod: args.accessMethod ?? request.accessMethod,
      accessInstructions: args.accessInstructions ?? request.accessInstructions,
      parkingInstructions: args.parkingInstructions ?? request.parkingInstructions,
      floorTypes: args.floorTypes ?? request.floorTypes,
      finishedBasement: args.finishedBasement ?? request.finishedBasement,
      delicateSurfaces: args.delicateSurfaces ?? request.delicateSurfaces,
      attentionAreas: args.attentionAreas ?? request.attentionAreas,
      pets: args.pets ?? request.pets,
      homeDuringCleanings: args.homeDuringCleanings ?? request.homeDuringCleanings,
      scheduleAdjustmentWindows: args.scheduleAdjustmentWindows ?? request.scheduleAdjustmentWindows,
      timingShiftOk: args.timingShiftOk ?? request.timingShiftOk,
      additionalNotes: args.additionalNotes ?? request.additionalNotes,
      rawConfirmationPayload: args.rawConfirmationPayload,
      updatedAt: Date.now(),
      confirmedAt: Date.now(),
    });

    if (customerId) {
      await ctx.runMutation(internal.customers.linkLifecycleRecordsToCustomer, {
        customerId,
        bookingRequestId: request._id,
        quoteRequestId: nextQuoteRequestId,
      });
    }

    if (nextQuoteRequestId) {
      await ctx.runMutation(internal.quoteRequests.markConfirmed, {
        quoteRequestId: nextQuoteRequestId,
      });
    }

    await ctx.runMutation(internal.quotes.onBookingRequestConfirmed, {
      bookingRequestId: request._id,
    });

    return request._id;
  },
});

export const getRequestById = internalQuery({
  args: { id: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getLatestRequestByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookingRequests")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .order("desc")
      .first();
  },
});

export const linkBookingToRequest = internalMutation({
  args: {
    requestId: v.id("bookingRequests"),
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      bookingId: args.bookingId,
      updatedAt: Date.now(),
    });
  },
});

export const linkQuoteRequestToRequest = internalMutation({
  args: {
    requestId: v.id("bookingRequests"),
    quoteRequestId: v.id("quoteRequests"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      quoteRequestId: args.quoteRequestId,
      updatedAt: Date.now(),
    });
  },
});

export const markLinkSent = mutation({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      linkSentAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markConfirmLinkSentInternal = internalMutation({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      confirmLinkSentAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markConfirmLinkSent = mutation({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      confirmLinkSentAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getById = query({
  args: { id: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    let requests;
    if (args.status) {
      const status = args.status;
      requests = await ctx.db
        .query("bookingRequests")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(limit);
    } else {
      requests = await ctx.db.query("bookingRequests").order("desc").take(limit);
    }

    const withBookingStatus = await Promise.all(
      requests.map(async (request) => {
        if (!request.bookingId) {
          return { ...request, bookingStatus: null };
        }
        const booking = await ctx.db.get(request.bookingId);
        return {
          ...request,
          bookingStatus: booking?.status ?? null,
        };
      })
    );

    return withBookingStatus;
  },
});

export const listByStatus = query({
  args: {
    status: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("bookingRequests")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .take(limit);
  },
});
