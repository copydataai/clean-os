"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { resend } from "./resend";

export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    from: v.optional(v.string()),
    attachments: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          contentBase64: v.string(),
          contentType: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, { to, subject, html, from, attachments: _attachments }) => {
    const fromAddress = from ?? process.env.RESEND_FROM_ADDRESS ?? "JoluAI <jose@joluai.com>";

    const providerEmailId = await resend.sendEmail(ctx, {
      from: fromAddress,
      to,
      subject,
      html,
    });

    return { emailId: providerEmailId };
  },
});
