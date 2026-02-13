import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../emailSender.ts": () => import("../emailSender"),
  "../emailSuppressions.ts": () => import("../emailSuppressions"),
  "../emailSends.ts": () => import("../emailSends"),
};

describe.sequential("email sender provider", () => {
  it("queues sends as convex_resend even when EMAIL_SENDER_PROVIDER is set to legacy", async () => {
    const t = convexTest(schema, modules);
    const idempotencyKey = `provider-check:${Date.now()}`;
    const originalProvider = process.env.EMAIL_SENDER_PROVIDER;
    process.env.EMAIL_SENDER_PROVIDER = "legacy_resend";

    try {
      await t.mutation(internal.emailSuppressions.suppressEmail, {
        email: "Test@Example.com",
        reason: "complaint",
      });

      const result = await t.action(internal.emailSender.sendTransactional, {
        to: "Test@Example.com",
        subject: "Provider check",
        template: "quote-received",
        templateProps: {},
        idempotencyKey,
      });

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("suppressed");

      const send = await t.run(async (ctx) => {
        return await ctx.db
          .query("emailSends")
          .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
          .first();
      });

      expect(send?.provider).toBe("convex_resend");
      expect(send?.status).toBe("skipped");
    } finally {
      if (originalProvider === undefined) {
        delete process.env.EMAIL_SENDER_PROVIDER;
      } else {
        process.env.EMAIL_SENDER_PROVIDER = originalProvider;
      }
    }
  });
});
