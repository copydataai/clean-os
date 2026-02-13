import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../emailEvents.ts": () => import("../emailEvents"),
  "../emailSends.ts": () => import("../emailSends"),
  "../emailSuppressions.ts": () => import("../emailSuppressions"),
};

function buildEvent(args: {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.delivery_delayed"
    | "email.bounced"
    | "email.complained"
    | "email.failed";
  createdAt: string;
  resendEmailId: string;
  to?: string;
  from?: string;
  subject?: string;
}) {
  const baseData = {
    created_at: args.createdAt,
    email_id: args.resendEmailId,
    from: args.from ?? "Clean OS <noreply@cleanos.com>",
    to: args.to ?? "customer@example.com",
    subject: args.subject ?? "Status update",
  };

  if (args.type === "email.failed") {
    return {
      type: args.type,
      created_at: args.createdAt,
      data: {
        ...baseData,
        failed: {
          reason: "Provider rejected message",
        },
      },
    };
  }

  if (args.type === "email.bounced") {
    return {
      type: args.type,
      created_at: args.createdAt,
      data: {
        ...baseData,
        bounce: {
          type: "hard",
          subType: "suppression",
          message: "Mailbox unavailable",
        },
      },
    };
  }

  return {
    type: args.type,
    created_at: args.createdAt,
    data: baseData,
  };
}

describe.sequential("email events", () => {
  it("uses callback id as primary lookup key and marks delivered", async () => {
    const t = convexTest(schema, modules);
    const callbackEmailId = "convex_email_001";
    const resendEmailId = "resend_email_001";
    const idempotencyKey = `email-events:primary:${Date.now()}`;

    const sendId = await t.run(async (ctx) => {
      return await ctx.db.insert("emailSends", {
        idempotencyKey,
        to: "customer@example.com",
        subject: "Primary lookup",
        template: "booking-confirmed",
        provider: "convex_resend",
        status: "sent",
        providerEmailId: callbackEmailId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.mutation(internal.emailEvents.onEmailEvent, {
      id: callbackEmailId as any,
      event: buildEvent({
        type: "email.delivered",
        createdAt: "2026-02-13T16:00:00.000Z",
        resendEmailId,
      }) as any,
    });

    expect(result.duplicate).toBe(false);

    const after = await t.run(async (ctx) => {
      const send = await ctx.db.get(sendId);
      const events = await ctx.db.query("emailEvents").collect();
      return { send, events };
    });

    expect(after.send?.status).toBe("delivered");
    expect(after.send?.providerEmailId).toBe(callbackEmailId);
    expect(after.events).toHaveLength(1);
    expect(after.events[0]?.providerEmailId).toBe(resendEmailId);
  });

  it("falls back to resend id lookup when callback id does not match", async () => {
    const t = convexTest(schema, modules);
    const resendEmailId = "resend_email_fallback";

    const sendId = await t.run(async (ctx) => {
      return await ctx.db.insert("emailSends", {
        idempotencyKey: `email-events:fallback:${Date.now()}`,
        to: "customer@example.com",
        subject: "Fallback lookup",
        template: "confirmation-link",
        provider: "convex_resend",
        status: "sent",
        providerEmailId: resendEmailId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.mutation(internal.emailEvents.onEmailEvent, {
      id: "convex_unmatched_id" as any,
      event: buildEvent({
        type: "email.delivered",
        createdAt: "2026-02-13T16:30:00.000Z",
        resendEmailId,
      }) as any,
    });

    const send = await t.run(async (ctx) => {
      return await ctx.db.get(sendId);
    });
    expect(send?.status).toBe("delivered");
    expect(send?.providerEmailId).toBe(resendEmailId);
  });

  it("maps delayed/failed events and de-duplicates repeated webhook payloads", async () => {
    const t = convexTest(schema, modules);
    const callbackEmailId = "convex_email_003";
    const resendEmailId = "resend_email_003";

    const sendId = await t.run(async (ctx) => {
      return await ctx.db.insert("emailSends", {
        idempotencyKey: `email-events:delay-fail:${Date.now()}`,
        to: "customer@example.com",
        subject: "Delay + fail",
        template: "quote-ready",
        provider: "convex_resend",
        status: "sent",
        providerEmailId: callbackEmailId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const delayedArgs = {
      id: callbackEmailId as any,
      event: buildEvent({
        type: "email.delivery_delayed",
        createdAt: "2026-02-13T17:00:00.000Z",
        resendEmailId,
      }) as any,
    };

    const first = await t.mutation(internal.emailEvents.onEmailEvent, delayedArgs);
    const second = await t.mutation(internal.emailEvents.onEmailEvent, delayedArgs);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);

    await t.mutation(internal.emailEvents.onEmailEvent, {
      id: callbackEmailId as any,
      event: buildEvent({
        type: "email.failed",
        createdAt: "2026-02-13T17:05:00.000Z",
        resendEmailId,
      }) as any,
    });

    const after = await t.run(async (ctx) => {
      const send = await ctx.db.get(sendId);
      const events = await ctx.db.query("emailEvents").collect();
      return { send, events };
    });

    expect(after.send?.status).toBe("failed");
    expect(after.send?.errorCode).toBe("email.failed");
    expect(after.send?.errorMessage).toBe("Provider rejected message");
    expect(after.events).toHaveLength(2);
  });
});
