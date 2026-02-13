"use node";

import React from "react";
import { v } from "convex/values";
import { render } from "@react-email/render";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { resend } from "./resend";
import QuoteReceivedEmail from "../../email-templates/emails/quote-received";
import ConfirmationLinkEmail from "../../email-templates/emails/confirmation-link";
import BookingConfirmedEmail from "../../email-templates/emails/booking-confirmed";
import PaymentSavedEmail from "../../email-templates/emails/payment-saved";
import QuoteReadyEmail from "../../email-templates/emails/quote-ready";
import QuoteReminderEmail from "../../email-templates/emails/quote-reminder";

type SupportedTemplate =
  | "quote-received"
  | "confirmation-link"
  | "booking-confirmed"
  | "payment-saved"
  | "quote-ready"
  | "quote-reminder";

function buildTemplate(template: SupportedTemplate, templateProps: any) {
  switch (template) {
    case "quote-received":
      return React.createElement(QuoteReceivedEmail, templateProps);
    case "confirmation-link":
      return React.createElement(ConfirmationLinkEmail, templateProps);
    case "booking-confirmed":
      return React.createElement(BookingConfirmedEmail, templateProps);
    case "payment-saved":
      return React.createElement(PaymentSavedEmail, templateProps);
    case "quote-ready":
      return React.createElement(QuoteReadyEmail, templateProps);
    case "quote-reminder":
      return React.createElement(QuoteReminderEmail, templateProps);
    default:
      throw new Error(`Unsupported template: ${template}`);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

type SendResult = {
  skipped?: boolean;
  reason?: string;
  sendId: string;
  status?: string;
  success?: boolean;
  provider?: "convex_resend";
  providerEmailId?: string;
};

export const sendTransactional = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    template: v.union(
      v.literal("quote-received"),
      v.literal("confirmation-link"),
      v.literal("booking-confirmed"),
      v.literal("payment-saved"),
      v.literal("quote-ready"),
      v.literal("quote-reminder")
    ),
    templateProps: v.any(),
    idempotencyKey: v.string(),
    from: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SendResult> => {
    const to = normalizeEmail(args.to);
    const provider = "convex_resend" as const;

    const existing = await ctx.runQuery(internal.emailSends.getByIdempotencyKey, {
      idempotencyKey: args.idempotencyKey,
    });

    if (existing && ["queued", "sent", "skipped"].includes(existing.status)) {
      return {
        skipped: true,
        reason: "idempotent_reuse",
        sendId: existing._id as string,
        status: existing.status,
      };
    }

    const suppression = await ctx.runQuery(internal.emailSuppressions.isSuppressed, {
      email: to,
    });

    const sendId = await ctx.runMutation(internal.emailSends.queueSend, {
      idempotencyKey: args.idempotencyKey,
      to,
      subject: args.subject,
      template: args.template,
      provider,
    });

    if (suppression.suppressed) {
      await ctx.runMutation(internal.emailSends.markSendStatus, {
        sendId,
        status: "skipped",
        errorCode: "suppressed",
        errorMessage: `Suppressed due to ${suppression.reason}`,
      });

      return {
        skipped: true,
        reason: "suppressed",
        sendId: sendId as string,
      };
    }

    const fromAddress =
      args.from ??
      process.env.RESEND_FROM_ADDRESS ??
      "Clean OS <noreply@cleanos.com>";

    const html = await render(buildTemplate(args.template, args.templateProps));

    try {
      const providerEmailId = await resend.sendEmail(ctx, {
        from: fromAddress,
        to,
        subject: args.subject,
        html,
      });

      await ctx.runMutation(internal.emailSends.markSendStatus, {
        sendId,
        status: "sent",
        providerEmailId,
      });

      return {
        success: true,
        sendId: sendId as string,
        provider,
        providerEmailId,
      };
    } catch (error: any) {
      const message = error instanceof Error ? error.message : "Email send failed";
      await ctx.runMutation(internal.emailSends.markSendStatus, {
        sendId,
        status: "failed",
        errorCode: "send_failed",
        errorMessage: message,
      });
      throw error;
    }
  },
});
