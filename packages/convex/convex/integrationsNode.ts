"use node";

import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
const internalApi: any = internal;

type EncryptedValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function getMasterKey(): Buffer {
  const raw =
    process.env.INTEGRATION_SECRETS_MASTER_KEY ??
    process.env.PAYMENT_SECRETS_MASTER_KEY;

  if (!raw) {
    throw new Error("MISSING_INTEGRATION_SECRETS_MASTER_KEY");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("INVALID_INTEGRATION_SECRETS_MASTER_KEY");
  }
  return key;
}

function encryptValue(value: string, key: Buffer): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

function decryptValue(
  encrypted: { ciphertext?: string; iv?: string; authTag?: string },
  key: Buffer,
): string {
  if (!encrypted.ciphertext || !encrypted.iv || !encrypted.authTag) {
    throw new Error("TALLY_NOT_CONFIGURED");
  }

  const iv = Buffer.from(encrypted.iv, "base64");
  const authTag = Buffer.from(encrypted.authTag, "base64");
  const ciphertext = Buffer.from(encrypted.ciphertext, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

export const encryptIntegrationSecrets = internalAction({
  args: {
    apiKey: v.string(),
    webhookSecret: v.string(),
  },
  handler: async (_ctx, args) => {
    const key = getMasterKey();
    const encryptedApi = encryptValue(args.apiKey.trim(), key);
    const encryptedWebhook = encryptValue(args.webhookSecret.trim(), key);

    return {
      apiKeyCiphertext: encryptedApi.ciphertext,
      apiKeyIv: encryptedApi.iv,
      apiKeyAuthTag: encryptedApi.authTag,
      webhookSecretCiphertext: encryptedWebhook.ciphertext,
      webhookSecretIv: encryptedWebhook.iv,
      webhookSecretAuthTag: encryptedWebhook.authTag,
    };
  },
});

export const decryptTallyConfig = internalAction({
  args: {
    organizationId: v.optional(v.id("organizations")),
    orgHandle: v.optional(v.string()),
    formId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const integration = args.organizationId
      ? await ctx.runQuery(internalApi.integrations.getTallyIntegrationByOrganizationId, {
          organizationId: args.organizationId,
        })
      : args.orgHandle
        ? await ctx.runQuery(internalApi.integrations.getTallyIntegrationByOrgHandle, {
            orgHandle: args.orgHandle,
          })
        : args.formId
          ? await ctx.runQuery(internalApi.integrations.getTallyIntegrationByFormId, {
              formId: args.formId,
            })
          : null;

    if (!integration || integration.status === "disabled") {
      throw new Error("TALLY_NOT_CONFIGURED");
    }

    const key = getMasterKey();
    const apiKey = decryptValue(
      {
        ciphertext: integration.apiKeyCiphertext,
        iv: integration.apiKeyIv,
        authTag: integration.apiKeyAuthTag,
      },
      key,
    );
    const webhookSecret = decryptValue(
      {
        ciphertext: integration.webhookSecretCiphertext,
        iv: integration.webhookSecretIv,
        authTag: integration.webhookSecretAuthTag,
      },
      key,
    );

    const organization = await ctx.runQuery(internalApi.payments.getOrganizationByIdInternal, {
      id: integration.organizationId,
    });

    return {
      ...integration,
      orgHandle: organization?.slug ?? organization?.clerkId ?? null,
      apiKey,
      webhookSecret,
    };
  },
});

export const tallyApiRequest = internalAction({
  args: {
    apiKey: v.string(),
    path: v.string(),
    method: v.optional(v.string()),
    body: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
    const method = (args.method ?? "GET").toUpperCase();
    const url = `https://api.tally.so${normalizePath(args.path)}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(args.body ?? {}),
    });

    const text = await response.text();
    let data: any = null;
    if (text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      const detail =
        data?.message ??
        data?.error ??
        data?.raw ??
        `Tally request failed with status ${response.status}`;
      throw new Error(`TALLY_API_${response.status}:${detail}`);
    }

    return {
      status: response.status,
      data,
      retryAfter: response.headers.get("retry-after"),
    };
  },
});
