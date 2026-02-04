import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const createBookingFromTally = mutation({
  args: {
    email: v.string(),
    customerName: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    serviceDate: v.optional(v.string()),
    amount: v.optional(v.number()),
    notes: v.optional(v.string()),
    tallyResponseId: v.optional(v.string()),
    bookingRequestId: v.optional(v.id("bookingRequests")),
  },
  handler: async (ctx, args): Promise<Id<"bookings">> => {
    const now = Date.now();
    return await ctx.db.insert("bookings", {
      email: args.email,
      customerName: args.customerName,
      status: "pending_card",
      serviceType: args.serviceType,
      serviceDate: args.serviceDate,
      amount: args.amount,
      notes: args.notes,
      tallyResponseId: args.tallyResponseId,
      bookingRequestId: args.bookingRequestId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createBookingFromRequest = mutation({
  args: {
    requestId: v.id("bookingRequests"),
  },
  handler: async (ctx, args): Promise<Id<"bookings">> => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Booking request not found");
    }

    if (request.bookingId) {
      return request.bookingId;
    }

    if (!request.email) {
      throw new Error("Booking request is missing email");
    }

    const now = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      email: request.email,
      customerName: request.contactDetails,
      status: "pending_card",
      notes: request.additionalNotes ?? request.attentionAreas,
      bookingRequestId: request._id,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.bookingRequests.linkBookingToRequest, {
      requestId: request._id,
      bookingId,
    });

    return bookingId;
  },
});

export const getBooking = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBookingsByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
  },
});

export const listPendingBookings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) => q.eq("status", "card_saved"))
      .collect();
  },
});

export const listCompletedBookings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();
  },
});

export const markJobCompleted = mutation({
  args: {
    bookingId: v.id("bookings"),
    finalAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    await ctx.db.patch(args.bookingId, {
      status: "completed",
      amount: args.finalAmount ?? booking.amount,
      updatedAt: Date.now(),
    });
  },
});

export const chargeCompletedJob = action({
  args: {
    bookingId: v.id("bookings"),
    amount: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    paymentIntentId?: string;
    requiresAction?: boolean;
    paymentLinkUrl?: string;
    error?: string;
  }> => {
    return await ctx.runAction(internal.stripeActions.chargeBooking, {
      bookingId: args.bookingId,
      amount: args.amount,
      description: args.description,
    });
  },
});

export const getPaymentIntentsForBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentIntents")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();
  },
});

export const listBookings = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.status) {
      const status = args.status;
      return await ctx.db
        .query("bookings")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("bookings").order("desc").take(limit);
  },
});
