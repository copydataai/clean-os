"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable");
  }
  return new Resend(apiKey);
}

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
  handler: async (_ctx, { to, subject, html, from, attachments }) => {
    const resend = getResendClient();
    const fromAddress = from ?? process.env.RESEND_FROM_ADDRESS ?? "Clean OS <noreply@cleanos.com>";

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: Buffer.from(attachment.contentBase64, "base64"),
      })),
    });

    if (error) {
      console.error("[Email] Failed to send", { to, subject, error });
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log("[Email] Sent successfully", { to, subject, emailId: data?.id });
    return { emailId: data?.id };
  },
});
