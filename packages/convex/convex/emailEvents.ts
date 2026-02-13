import { vOnEmailEventArgs } from "@convex-dev/resend";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

function readRecipientEmail(to: string | string[]): string {
  if (Array.isArray(to)) {
    return (to[0] ?? "unknown").toLowerCase();
  }
  return to.toLowerCase();
}

export const onEmailEvent = internalMutation({
  args: vOnEmailEventArgs,
  handler: async (ctx, args) => {
    const callbackEmailId = String(args.id);
    const resendEmailId = args.event.data.email_id;
    const eventId = `${callbackEmailId}:${args.event.type}:${args.event.created_at}`;
    const email = readRecipientEmail(args.event.data.to);

    const existing = await ctx.db
      .query("emailEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
      .first();

    if (existing) {
      return { duplicate: true };
    }

    await ctx.db.insert("emailEvents", {
      eventId,
      type: args.event.type,
      email,
      providerEmailId: resendEmailId,
      raw: args.event,
      processedAt: Date.now(),
    });

    let send = await ctx.db
      .query("emailSends")
      .withIndex("by_provider_email_id", (q) =>
        q.eq("providerEmailId", callbackEmailId)
      )
      .first();

    if (!send && resendEmailId !== callbackEmailId) {
      send = await ctx.db
        .query("emailSends")
        .withIndex("by_provider_email_id", (q) =>
          q.eq("providerEmailId", resendEmailId)
        )
        .first();
    }

    if (send) {
      const trackedProviderEmailId = send.providerEmailId ?? callbackEmailId;
      const currentStatus = send.status;

      if (
        args.event.type === "email.sent" &&
        !["delivered", "delivery_delayed", "failed"].includes(currentStatus)
      ) {
        await ctx.runMutation(internal.emailSends.markSendStatus, {
          sendId: send._id,
          status: "sent",
          providerEmailId: trackedProviderEmailId,
        });
      }

      if (
        args.event.type === "email.delivered" &&
        !["delivered", "failed"].includes(currentStatus)
      ) {
        await ctx.runMutation(internal.emailSends.markSendStatus, {
          sendId: send._id,
          status: "delivered",
          providerEmailId: trackedProviderEmailId,
        });
      }

      if (
        args.event.type === "email.delivery_delayed" &&
        ["queued", "sent"].includes(currentStatus)
      ) {
        await ctx.runMutation(internal.emailSends.markSendStatus, {
          sendId: send._id,
          status: "delivery_delayed",
          providerEmailId: trackedProviderEmailId,
        });
      }

      if (
        args.event.type === "email.bounced" ||
        args.event.type === "email.complained" ||
        args.event.type === "email.failed"
      ) {
        await ctx.runMutation(internal.emailSends.markSendStatus, {
          sendId: send._id,
          status: "failed",
          providerEmailId: trackedProviderEmailId,
          errorCode: args.event.type,
          errorMessage:
            args.event.type === "email.bounced"
              ? args.event.data.bounce.message
              : args.event.type === "email.failed"
                ? args.event.data.failed.reason
                : "Recipient complaint",
        });
      }
    }

    if (args.event.type === "email.complained" && email !== "unknown") {
      await ctx.runMutation(internal.emailSuppressions.suppressEmail, {
        email,
        reason: "complaint",
        sourceEventId: eventId,
      });
    }

    if (
      args.event.type === "email.bounced" &&
      email !== "unknown" &&
      args.event.data.bounce.type.toLowerCase().includes("hard")
    ) {
      await ctx.runMutation(internal.emailSuppressions.suppressEmail, {
        email,
        reason: "hard_bounce",
        sourceEventId: eventId,
      });
    }

    return { duplicate: false };
  },
});
