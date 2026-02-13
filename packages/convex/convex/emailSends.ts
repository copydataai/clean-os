import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getByIdempotencyKey = internalQuery({
  args: { idempotencyKey: v.string() },
  handler: async (ctx, { idempotencyKey }) => {
    return await ctx.db
      .query("emailSends")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", idempotencyKey)
      )
      .first();
  },
});

export const queueSend = internalMutation({
  args: {
    idempotencyKey: v.string(),
    to: v.string(),
    subject: v.string(),
    template: v.string(),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailSends")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", args.idempotencyKey)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("emailSends", {
      ...args,
      status: "queued",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markSendStatus = internalMutation({
  args: {
    sendId: v.id("emailSends"),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("delivery_delayed"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    providerEmailId: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sendId, {
      status: args.status,
      providerEmailId: args.providerEmailId,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
  },
});
