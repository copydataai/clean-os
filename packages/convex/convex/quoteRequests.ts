import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const createQuoteRequest = internalMutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    service: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    frequency: v.optional(v.string()),
    squareFootage: v.optional(v.number()),
    address: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    additionalNotes: v.optional(v.string()),
    utm_source: v.optional(v.string()),
    utm_campaign: v.optional(v.string()),
    gad_campaignid: v.optional(v.string()),
    gclid: v.optional(v.string()),
    status: v.optional(v.string()),
    tallyFormId: v.optional(v.string()),
    bookingRequestId: v.optional(v.id("bookingRequests")),
    rawRequestPayload: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<Id<"quoteRequests">> => {
    const address =
      args.address || args.addressLine2 || args.city || args.state || args.postalCode
        ? {
            street: args.address,
            addressLine2: args.addressLine2,
            city: args.city,
            state: args.state,
            postalCode: args.postalCode,
          }
        : undefined;

    const customerId = args.email
      ? await ctx.runMutation(internal.customers.ensureLifecycleCustomer, {
          email: args.email,
          firstName: args.firstName,
          lastName: args.lastName,
          phone: args.phone,
          address,
          squareFootage: args.squareFootage,
          source: "quote_request",
        })
      : undefined;

    const now = Date.now();
    const quoteRequestId = await ctx.db.insert("quoteRequests", {
      ...args,
      customerId,
      requestStatus: "requested",
      createdAt: now,
      updatedAt: now,
    });

    if (customerId && args.bookingRequestId) {
      await ctx.runMutation(internal.customers.linkLifecycleRecordsToCustomer, {
        customerId,
        quoteRequestId,
        bookingRequestId: args.bookingRequestId,
      });
    }

    return quoteRequestId;
  },
});

export const linkBookingRequest = internalMutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    bookingRequestId: v.id("bookingRequests"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteRequestId, {
      bookingRequestId: args.bookingRequestId,
      requestStatus: "confirmed",
      updatedAt: Date.now(),
    });
  },
});

export const linkBookingRequestId = internalMutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    bookingRequestId: v.id("bookingRequests"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteRequestId, {
      bookingRequestId: args.bookingRequestId,
      updatedAt: Date.now(),
    });
  },
});

export const markConfirmed = internalMutation({
  args: { quoteRequestId: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteRequestId, {
      requestStatus: "confirmed",
      updatedAt: Date.now(),
    });
  },
});

export const getQuoteRequestById = internalQuery({
  args: { id: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getById = query({
  args: { id: v.id("quoteRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db.query("quoteRequests").order("desc").take(limit);
  },
});

export const updateRequestStatus = mutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    requestStatus: v.union(
      v.literal("requested"),
      v.literal("quoted"),
      v.literal("confirmed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteRequestId, {
      requestStatus: args.requestStatus,
      updatedAt: Date.now(),
    });
  },
});

export const updateRequestStatusInternal = internalMutation({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    requestStatus: v.union(
      v.literal("requested"),
      v.literal("quoted"),
      v.literal("confirmed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quoteRequestId, {
      requestStatus: args.requestStatus,
      updatedAt: Date.now(),
    });
  },
});
