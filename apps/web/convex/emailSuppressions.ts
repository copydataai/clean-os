import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const isSuppressed = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    const suppression = await ctx.db
      .query("emailSuppressions")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();

    return {
      suppressed: !!suppression,
      reason: suppression?.reason,
    };
  },
});

export const suppressEmail = internalMutation({
  args: {
    email: v.string(),
    reason: v.union(v.literal("hard_bounce"), v.literal("complaint")),
    sourceEventId: v.optional(v.string()),
  },
  handler: async (ctx, { email, reason, sourceEventId }) => {
    const normalized = normalizeEmail(email);
    const existing = await ctx.db
      .query("emailSuppressions")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        reason,
        sourceEventId,
        createdAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("emailSuppressions", {
      email: normalized,
      reason,
      sourceEventId,
      createdAt: Date.now(),
    });
  },
});

export const listRecentSuppressions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("emailSuppressions").collect();
    const sorted = rows.sort((a, b) => b.createdAt - a.createdAt);
    return sorted.slice(0, limit ?? 50);
  },
});
