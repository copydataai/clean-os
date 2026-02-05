import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getCustomerByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const customers = await ctx.db
      .query("stripeCustomers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .collect();

    if (customers.length === 0) {
      return null;
    }

    if (customers.length > 1) {
      console.warn("[stripeCustomers] Duplicate clerkId records detected", {
        clerkId: args.clerkId,
        count: customers.length,
      });
    }

    return customers.reduce((latest, current) => {
      const latestTs = latest.createdAt ?? 0;
      const currentTs = current.createdAt ?? 0;
      return currentTs > latestTs ? current : latest;
    });
  },
});

export const listStripeCustomersByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const customers = await ctx.db
      .query("stripeCustomers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .collect();

    return customers.sort((a, b) => {
      const aTs = a.createdAt ?? 0;
      const bTs = b.createdAt ?? 0;
      return bTs - aTs;
    });
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

export const saveStripeCustomerIfAbsent = internalMutation({
  args: {
    clerkId: v.string(),
    stripeCustomerId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripeCustomers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .order("desc")
      .first();

    if (existing) {
      return existing;
    }

    const id = await ctx.db.insert("stripeCustomers", {
      clerkId: args.clerkId,
      stripeCustomerId: args.stripeCustomerId,
      email: args.email,
      createdAt: Date.now(),
    });

    return await ctx.db.get(id);
  },
});

export const deleteStripeCustomerById = internalMutation({
  args: { id: v.id("stripeCustomers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
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
    source: v.optional(v.string()),
    card: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("paymentMethods", {
      clerkId: args.clerkId,
      stripePaymentMethodId: args.stripePaymentMethodId,
      stripeCustomerId: args.stripeCustomerId,
      type: args.type,
      source: args.source,
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

export const deletePaymentMethodsByStripeCustomerIds = internalMutation({
  args: { stripeCustomerIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    for (const stripeCustomerId of args.stripeCustomerIds) {
      const methods = await ctx.db
        .query("paymentMethods")
        .withIndex("by_stripe_customer", (q) =>
          q.eq("stripeCustomerId", stripeCustomerId)
        )
        .collect();

      for (const method of methods) {
        await ctx.db.delete(method._id);
      }
    }
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
