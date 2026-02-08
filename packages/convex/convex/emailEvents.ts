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
    const eventId = `${args.id}:${args.event.type}:${args.event.created_at}`;
    const providerEmailId = args.event.data.email_id;
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
      providerEmailId,
      raw: args.event,
      processedAt: Date.now(),
    });

    const send = await ctx.db
      .query("emailSends")
      .withIndex("by_provider_email_id", (q) =>
        q.eq("providerEmailId", providerEmailId)
      )
      .first();

    if (send) {
      if (
        args.event.type === "email.sent" ||
        args.event.type === "email.delivered"
      ) {
        await ctx.runMutation(internal.emailSends.markSendStatus, {
          sendId: send._id,
          status: "sent",
          providerEmailId,
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
          providerEmailId,
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
