import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const createBooking = internalMutation({
  args: {
    email: v.string(),
    customerName: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    serviceDate: v.optional(v.string()),
    amount: v.optional(v.number()),
    notes: v.optional(v.string()),
    tallyResponseId: v.optional(v.string()),
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
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getBookingById = internalQuery({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBookingByCheckoutSession = internalQuery({
  args: { checkoutSessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_checkout_session", (q) =>
        q.eq("stripeCheckoutSessionId", args.checkoutSessionId)
      )
      .unique();
  },
});

export const getBookingsByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
  },
});

export const getBookingsByStatus = internalQuery({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

export const updateBookingCheckoutSession = internalMutation({
  args: {
    id: v.id("bookings"),
    stripeCheckoutSessionId: v.string(),
    stripeCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: Date.now(),
    });
  },
});

export const updateBookingStatus = internalMutation({
  args: {
    id: v.id("bookings"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const updateBookingAmount = internalMutation({
  args: {
    id: v.id("bookings"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      amount: args.amount,
      updatedAt: Date.now(),
    });
  },
});

export const createPaymentIntent = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    stripePaymentIntentId: v.string(),
    stripeCustomerId: v.string(),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    paymentMethodId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"paymentIntents">> => {
    const now = Date.now();
    return await ctx.db.insert("paymentIntents", {
      bookingId: args.bookingId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      stripeCustomerId: args.stripeCustomerId,
      amount: args.amount,
      currency: args.currency,
      status: args.status,
      paymentMethodId: args.paymentMethodId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getPaymentIntentByStripeId = internalQuery({
  args: { stripePaymentIntentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentIntents")
      .withIndex("by_stripe_id", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .unique();
  },
});

export const getPaymentIntentsByBooking = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentIntents")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();
  },
});

export const updatePaymentIntentStatus = internalMutation({
  args: {
    stripePaymentIntentId: v.string(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    paymentLinkUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pi = await ctx.db
      .query("paymentIntents")
      .withIndex("by_stripe_id", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .unique();

    if (pi) {
      await ctx.db.patch(pi._id, {
        status: args.status,
        errorMessage: args.errorMessage,
        paymentLinkUrl: args.paymentLinkUrl,
        updatedAt: Date.now(),
      });
    }
  },
});
