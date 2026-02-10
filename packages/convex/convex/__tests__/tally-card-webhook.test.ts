import { createHmac } from "node:crypto";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../integrations.ts": () => import("../integrations"),
  "../integrationsNode.ts": () => import("../integrationsNode"),
  "../payments.ts": () => import("../payments"),
  "../httpHandlers/tallyActions.ts": () => import("../httpHandlers/tallyActions"),
};

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64");
}

async function seedTallyIntegration(
  t: ReturnType<typeof convexTest>,
  options?: { cardFormId?: string },
): Promise<{ organizationId: Id<"organizations">; orgHandle: string; secret: string }> {
  const now = Date.now();
  const suffix = Math.random().toString(36).slice(2, 10);
  const seeded = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: `user_${suffix}`,
      email: `user_${suffix}@example.com`,
      firstName: "Test",
      lastName: "Admin",
    });

    const orgId = await ctx.db.insert("organizations", {
      clerkId: `org_${suffix}`,
      name: "Tally Org",
      slug: `tally-org-${suffix}`,
    });

    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_${suffix}`,
      userId,
      organizationId: orgId,
      role: "owner",
    });

    return { organizationId: orgId, userId };
  });

  const org = await t.run(async (ctx) => ctx.db.get(seeded.organizationId));
  if (!org) {
    throw new Error("Failed to seed organization");
  }

  const webhookSecret = "test_webhook_secret";
  const apiKey = "test_api_key";

  const encrypted = await t.action(internal.integrationsNode.encryptIntegrationSecrets, {
    apiKey,
    webhookSecret,
  });

  const integrationId = await t.mutation(internal.integrations.bootstrapTallyIntegrationFromEnvInternal, {
    organizationId: seeded.organizationId,
    updatedByUserId: seeded.userId as Id<"users">,
    ...encrypted,
    requestFormId: "form_request",
    confirmationFormId: "form_confirm",
    cardFormId: options?.cardFormId ?? "form_card",
  });

  await t.run(async (ctx) => {
    await ctx.db.patch(integrationId, {
      webhookIds: {
        request: "wh_request",
        confirmation: "wh_confirmation",
        card: "wh_card",
      },
      updatedAt: now,
    });
  });

  return {
    organizationId: seeded.organizationId,
    orgHandle: org.slug ?? org.clerkId,
    secret: webhookSecret,
  };
}

describe.sequential("tally card webhook", () => {
  it("accepts org-route and form-id lookup flows", async () => {
    const previous = process.env.INTEGRATION_SECRETS_MASTER_KEY;
    process.env.INTEGRATION_SECRETS_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");

    try {
      const t = convexTest(schema, modules);
      const seeded = await seedTallyIntegration(t);

      const payload = JSON.stringify({
        eventType: "FORM_RESPONSE",
        data: {
          formId: "form_card",
          responseId: "resp_1",
          fields: [],
        },
      });
      const signature = signPayload(payload, seeded.secret);

      const withOrg = await t.action(internal.httpHandlers.tallyActions.handleTallyCardWebhook, {
        payload,
        signature,
        orgHandle: seeded.orgHandle,
      });
      expect(withOrg.status).toBe(200);

      const byFormId = await t.action(internal.httpHandlers.tallyActions.handleTallyCardWebhook, {
        payload,
        signature,
      });
      expect(byFormId.status).toBe(200);
    } finally {
      if (previous) {
        process.env.INTEGRATION_SECRETS_MASTER_KEY = previous;
      } else {
        delete process.env.INTEGRATION_SECRETS_MASTER_KEY;
      }
    }
  });

  it("rejects invalid signatures and missing config", async () => {
    const previous = process.env.INTEGRATION_SECRETS_MASTER_KEY;
    process.env.INTEGRATION_SECRETS_MASTER_KEY = Buffer.alloc(32, 8).toString("base64");

    try {
      const t = convexTest(schema, modules);
      const seeded = await seedTallyIntegration(t);

      const payload = JSON.stringify({
        eventType: "FORM_RESPONSE",
        data: {
          formId: "form_card",
          responseId: "resp_2",
          fields: [],
        },
      });

      const invalidSignature = await t.action(internal.httpHandlers.tallyActions.handleTallyCardWebhook, {
        payload,
        signature: "bad_signature",
        orgHandle: seeded.orgHandle,
      });
      expect(invalidSignature).toEqual({ error: "Invalid signature", status: 400 });

      const missingConfigPayload = JSON.stringify({
        eventType: "FORM_RESPONSE",
        data: {
          formId: "unknown_form",
          responseId: "resp_3",
          fields: [],
        },
      });
      const missingConfig = await t.action(internal.httpHandlers.tallyActions.handleTallyCardWebhook, {
        payload: missingConfigPayload,
        signature: signPayload(missingConfigPayload, seeded.secret),
      });
      expect(missingConfig).toEqual({ error: "TALLY_NOT_CONFIGURED", status: 400 });
    } finally {
      if (previous) {
        process.env.INTEGRATION_SECRETS_MASTER_KEY = previous;
      } else {
        delete process.env.INTEGRATION_SECRETS_MASTER_KEY;
      }
    }
  });
});
