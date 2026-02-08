import { v } from "convex/values";
import { query } from "./_generated/server";

export const listFailedSends = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("emailSends")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit ?? 50);
  },
});

export const getComplaintCount = query({
  args: { lookbackDays: v.optional(v.number()) },
  handler: async (ctx, { lookbackDays }) => {
    const cutoff = Date.now() - (lookbackDays ?? 30) * 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("emailEvents")
      .withIndex("by_type", (q) => q.eq("type", "email.complained"))
      .collect();

    return rows.filter((row) => row.processedAt >= cutoff).length;
  },
});

export const getBounceRateTrend = query({
  args: { lookbackDays: v.optional(v.number()) },
  handler: async (ctx, { lookbackDays }) => {
    const days = lookbackDays ?? 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const sendRows = await ctx.db.query("emailSends").collect();
    const eventRows = await ctx.db
      .query("emailEvents")
      .withIndex("by_type", (q) => q.eq("type", "email.bounced"))
      .collect();

    const sendsInWindow = sendRows.filter((row) => row.createdAt >= cutoff);
    const bouncesInWindow = eventRows.filter((row) => row.processedAt >= cutoff);

    const sentCount = sendsInWindow.length;
    const bouncedCount = bouncesInWindow.length;
    const bounceRate = sentCount === 0 ? 0 : bouncedCount / sentCount;

    return {
      lookbackDays: days,
      sentCount,
      bouncedCount,
      bounceRate,
    };
  },
});
