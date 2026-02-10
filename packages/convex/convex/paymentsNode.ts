"use node";

import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

type EncryptedValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

type DecryptedStripeConfig = {
  organizationId: any;
  orgSlug: string;
  secretKey: string;
  webhookSecret: string;
  status: "configured";
};

function getMasterKey(): Buffer {
  const raw = process.env.PAYMENT_SECRETS_MASTER_KEY;
  if (!raw) {
    throw new Error("Missing PAYMENT_SECRETS_MASTER_KEY");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("Invalid PAYMENT_SECRETS_MASTER_KEY length");
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
  key: Buffer
): string {
  if (!encrypted.ciphertext || !encrypted.iv || !encrypted.authTag) {
    throw new Error("ORG_NOT_CONFIGURED");
  }

  const iv = Buffer.from(encrypted.iv, "base64");
  const authTag = Buffer.from(encrypted.authTag, "base64");
  const ciphertext = Buffer.from(encrypted.ciphertext, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

export const encryptStripeSecrets = internalAction({
  args: {
    secretKey: v.string(),
    webhookSecret: v.string(),
  },
  handler: async (_ctx, args) => {
    const key = getMasterKey();
    const encryptedSecret = encryptValue(args.secretKey.trim(), key);
    const encryptedWebhook = encryptValue(args.webhookSecret.trim(), key);

    return {
      secretKeyCiphertext: encryptedSecret.ciphertext,
      secretKeyIv: encryptedSecret.iv,
      secretKeyAuthTag: encryptedSecret.authTag,
      webhookSecretCiphertext: encryptedWebhook.ciphertext,
      webhookSecretIv: encryptedWebhook.iv,
      webhookSecretAuthTag: encryptedWebhook.authTag,
    };
  },
});

export const getDecryptedStripeConfigForOrganization = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<DecryptedStripeConfig> => {
    const config: any = await ctx.runQuery(internal.payments.getOrganizationStripeConfigByOrganizationId, {
      organizationId: args.organizationId,
    });

    if (!config || config.status !== "configured") {
      throw new Error("ORG_NOT_CONFIGURED");
    }

    const key = getMasterKey();
    const secretKey = decryptValue(
      {
        ciphertext: config.secretKeyCiphertext,
        iv: config.secretKeyIv,
        authTag: config.secretKeyAuthTag,
      },
      key
    );
    const webhookSecret = decryptValue(
      {
        ciphertext: config.webhookSecretCiphertext,
        iv: config.webhookSecretIv,
        authTag: config.webhookSecretAuthTag,
      },
      key
    );

    return {
      organizationId: config.organizationId,
      orgSlug: config.orgSlug,
      secretKey,
      webhookSecret,
      status: config.status,
    };
  },
});

export const getDecryptedStripeConfigForOrgSlug = internalAction({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args): Promise<DecryptedStripeConfig> => {
    const config: any = await ctx.runQuery(internal.payments.getOrganizationStripeConfigByOrgSlug, {
      orgSlug: args.orgSlug,
    });

    if (!config || config.status !== "configured") {
      throw new Error("ORG_NOT_CONFIGURED");
    }

    const key = getMasterKey();
    const secretKey = decryptValue(
      {
        ciphertext: config.secretKeyCiphertext,
        iv: config.secretKeyIv,
        authTag: config.secretKeyAuthTag,
      },
      key
    );
    const webhookSecret = decryptValue(
      {
        ciphertext: config.webhookSecretCiphertext,
        iv: config.webhookSecretIv,
        authTag: config.webhookSecretAuthTag,
      },
      key
    );

    return {
      organizationId: config.organizationId,
      orgSlug: config.orgSlug,
      secretKey,
      webhookSecret,
      status: config.status,
    };
  },
});
