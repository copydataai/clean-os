import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

export const createBooking = internalMutation({
  args: {
    email: v.string(),
    customerName: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
    serviceType: v.optional(v.string()),
    serviceDate: v.optional(v.string()),
    amount: v.optional(v.number()),
    notes: v.optional(v.string()),
    tallyResponseId: v.optional(v.string()),
    bookingRequestId: v.optional(v.id("bookingRequests")),
  },
  handler: async (ctx, args): Promise<Id<"bookings">> => {
    const customerId =
      args.customerId ??
      (await ctx.runMutation(internal.customers.ensureLifecycleCustomer, {
        email: args.email,
        fullName: args.customerName,
        source: "booking",
        activateOnLink: true,
      }));

    const request = args.bookingRequestId
      ? await ctx.db.get(args.bookingRequestId)
      : null;

    const now = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      email: args.email,
      customerName: args.customerName,
      customerId,
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

    await ctx.runMutation(internal.bookingStateMachine.appendLifecycleEvent, {
      bookingId,
      eventType: "created",
      toStatus: "pending_card",
      source: "bookingDb.createBooking",
    });

    await ctx.runMutation(internal.customers.linkLifecycleRecordsToCustomer, {
      customerId,
      bookingId,
      bookingRequestId: args.bookingRequestId,
      quoteRequestId: request?.quoteRequestId,
    });

    await ctx.runMutation(internal.customers.recomputeStatsInternal, {
      customerId,
    });

    return bookingId;
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
    status: v.union(
      v.literal("pending_card"),
      v.literal("card_saved"),
      v.literal("scheduled"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("payment_failed"),
      v.literal("charged"),
      v.literal("cancelled")
    ),
    source: v.optional(v.string()),
    reason: v.optional(v.string()),
    actorUserId: v.optional(v.id("users")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.bookingStateMachine.transitionBookingStatus, {
      bookingId: args.id,
      toStatus: args.status,
      source: args.source ?? "bookingDb.updateBookingStatus",
      reason: args.reason,
      actorUserId: args.actorUserId,
      metadata: args.metadata,
    });
  },
});

export const updateBookingScheduleFields = internalMutation({
  args: {
    id: v.id("bookings"),
    serviceDate: v.optional(v.string()),
    serviceWindowStart: v.optional(v.string()),
    serviceWindowEnd: v.optional(v.string()),
    estimatedDurationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, string | number | undefined> = {
      serviceDate: args.serviceDate,
      serviceWindowStart: args.serviceWindowStart,
      serviceWindowEnd: args.serviceWindowEnd,
      estimatedDurationMinutes: args.estimatedDurationMinutes,
    };

    const patch = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(patch).length === 0) {
      return;
    }

    await ctx.db.patch(args.id, {
      ...patch,
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

export const reassignStripeCustomerId = internalMutation({
  args: {
    fromStripeCustomerId: v.string(),
    toStripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.fromStripeCustomerId)
      )
      .collect();

    for (const booking of bookings) {
      await ctx.db.patch(booking._id, {
        stripeCustomerId: args.toStripeCustomerId,
        updatedAt: Date.now(),
      });
    }
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
