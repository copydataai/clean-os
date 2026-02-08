"use node";

import { Resend } from "@convex-dev/resend";
import { components, internal } from "./_generated/api";

export const resend: Resend = new Resend(components.resend, {
  apiKey: process.env.RESEND_API_KEY,
  webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
  testMode: false,
  onEmailEvent: internal.emailEvents.onEmailEvent,
});
