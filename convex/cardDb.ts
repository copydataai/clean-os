import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getCustomerByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stripeCustomers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

export const saveStripeCustomerToDb = internalMutation({
  args: {
    clerkId: v.string(),
    stripeCustomerId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("stripeCustomers", {
      clerkId: args.clerkId,
      stripeCustomerId: args.stripeCustomerId,
      email: args.email,
      createdAt: Date.now(),
    });
  },
});

export const saveSetupIntentToDb = internalMutation({
  args: {
    clerkId: v.string(),
    setupIntentId: v.string(),
    clientSecret: v.string(),
    status: v.string(),
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("setupIntents", {
      clerkId: args.clerkId,
      setupIntentId: args.setupIntentId,
      clientSecret: args.clientSecret,
      status: args.status,
      customerId: args.customerId,
      createdAt: Date.now(),
    });
  },
});

export const updateSetupIntentStatus = internalMutation({
  args: {
    setupIntentId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const si = await ctx.db
      .query("setupIntents")
      .withIndex("by_setup_intent_id", (q) => q.eq("setupIntentId", args.setupIntentId))
      .first();
    if (si) {
      await ctx.db.patch(si._id, { status: args.status });
    }
  },
});

export const savePaymentMethodToDb = internalMutation({
  args: {
    clerkId: v.string(),
    stripePaymentMethodId: v.string(),
    stripeCustomerId: v.string(),
    type: v.string(),
    card: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("paymentMethods", {
      clerkId: args.clerkId,
      stripePaymentMethodId: args.stripePaymentMethodId,
      stripeCustomerId: args.stripeCustomerId,
      type: args.type,
      card: args.card,
      createdAt: Date.now(),
    });
  },
});

export const getPaymentMethodByStripeId = internalQuery({
  args: { stripePaymentMethodId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentMethods")
      .withIndex("by_stripe_id", (q) =>
        q.eq("stripePaymentMethodId", args.stripePaymentMethodId)
      )
      .unique();
  },
});

export const deletePaymentMethodFromDb = internalMutation({
  args: { id: v.id("paymentMethods") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const listPaymentMethods = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentMethods")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .collect();
  },
});
