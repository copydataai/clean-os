import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const ensureQuoteNumberSequence = internalMutation({
  args: { startAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const key = "quote_number";
    const existing = await ctx.db
      .query("sequences")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("sequences", {
      key,
      nextValue: args.startAt ?? 989,
      updatedAt: Date.now(),
    });
  },
});

export const nextQuoteNumber = internalMutation({
  args: {},
  handler: async (ctx) => {
    const key = "quote_number";
    const existing = await ctx.db
      .query("sequences")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!existing) {
      const startAt = 989;
      await ctx.db.insert("sequences", {
        key,
        nextValue: startAt + 1,
        updatedAt: Date.now(),
      });
      return startAt;
    }

    const value = existing.nextValue;
    await ctx.db.patch(existing._id, {
      nextValue: value + 1,
      updatedAt: Date.now(),
    });
    return value;
  },
});

