import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

function isAdminRole(role?: string | null) {
  const normalized = (role ?? "").toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "owner" ||
    normalized.endsWith(":admin") ||
    normalized.endsWith(":owner") ||
    normalized.includes("admin")
  );
}

async function requireOrganizationMembership(ctx: any, organizationId: Id<"organizations">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    throw new Error("Authenticated user record not found");
  }

  const membership = await ctx.db
    .query("organizationMemberships")
    .withIndex("by_user_and_org", (q: any) =>
      q.eq("userId", user._id).eq("organizationId", organizationId)
    )
    .unique();

  if (!membership) {
    throw new Error("ORG_UNAUTHORIZED");
  }

  return { user, membership };
}

async function requireOrganizationAdmin(ctx: any, organizationId: Id<"organizations">) {
  const { user, membership } = await requireOrganizationMembership(ctx, organizationId);
  if (!isAdminRole(membership.role)) {
    throw new Error("ORG_UNAUTHORIZED");
  }

  return user._id as Id<"users">;
}

function deriveStripeMode(secretKey: string): "test" | "live" {
  const normalized = secretKey.trim().toLowerCase();
  return normalized.startsWith("sk_live_") ? "live" : "test";
}

async function resolveOrganizationByPublicHandle(ctx: any, handle: string) {
  const bySlug = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q: any) => q.eq("slug", handle))
    .unique();
  const byClerkId = await ctx.db
    .query("organizations")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", handle))
    .unique();

  if (bySlug && byClerkId && bySlug._id !== byClerkId._id) {
    throw new Error("ORG_HANDLE_AMBIGUOUS");
  }

  return bySlug ?? byClerkId ?? null;
}

export const getOrganizationStripeConfigByOrganizationId = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizationStripeConfigs")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .first();
  },
});

export const getOrganizationStripeConfigByOrgSlug = internalQuery({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizationStripeConfigs")
      .withIndex("by_org_slug", (q) => q.eq("orgSlug", args.orgSlug))
      .order("desc")
      .first();
  },
});

export const getOrganizationBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const getOrganizationByPublicHandle = query({
  args: {
    handle: v.string(),
  },
  handler: async (ctx, args) => {
    return await resolveOrganizationByPublicHandle(ctx, args.handle);
  },
});

export const getPublicStripeRecoveryConfig = query({
  args: {
    handle: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await resolveOrganizationByPublicHandle(ctx, args.handle);
    if (!organization) {
      return null;
    }

    const config = await ctx.db
      .query("organizationStripeConfigs")
      .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .first();

    if (!config || config.status !== "configured" || !config.publishableKey) {
      return null;
    }

    return {
      organizationId: organization._id,
      orgSlug: organization.slug ?? organization.clerkId,
      publishableKey: config.publishableKey,
      mode: config.mode ?? null,
    };
  },
});

export const getOrganizationBySlugInternal = internalQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const getOrganizationByPublicHandleInternal = internalQuery({
  args: {
    handle: v.string(),
  },
  handler: async (ctx, args) => {
    return await resolveOrganizationByPublicHandle(ctx, args.handle);
  },
});

export const getOrganizationByIdInternal = internalQuery({
  args: {
    id: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getPaymentsEnvironmentStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        ready: false,
        code: "AUTH_REQUIRED",
        message: "Authentication required.",
      };
    }

    const masterKey = process.env.PAYMENT_SECRETS_MASTER_KEY?.trim();
    if (!masterKey) {
      return {
        ready: false,
        code: "MISSING_MASTER_KEY",
        message:
          "PAYMENT_SECRETS_MASTER_KEY is not configured on the Convex deployment.",
      };
    }

    return {
      ready: true,
      code: "OK",
      message: null as string | null,
    };
  },
});

export const upsertOrganizationStripeConfigEncrypted = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    updatedByUserId: v.id("users"),
    mode: v.union(v.literal("test"), v.literal("live")),
    publishableKey: v.string(),
    secretKeyCiphertext: v.string(),
    secretKeyIv: v.string(),
    secretKeyAuthTag: v.string(),
    webhookSecretCiphertext: v.string(),
    webhookSecretIv: v.string(),
    webhookSecretAuthTag: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("ORG_NOT_FOUND");
    }
    const orgSlug = organization.slug ?? organization.clerkId;
    const now = Date.now();

    const existing = await ctx.db
      .query("organizationStripeConfigs")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        orgSlug,
        status: "configured",
        mode: args.mode,
        publishableKey: args.publishableKey,
        secretKeyCiphertext: args.secretKeyCiphertext,
        secretKeyIv: args.secretKeyIv,
        secretKeyAuthTag: args.secretKeyAuthTag,
        webhookSecretCiphertext: args.webhookSecretCiphertext,
        webhookSecretIv: args.webhookSecretIv,
        webhookSecretAuthTag: args.webhookSecretAuthTag,
        keyVersion: (existing.keyVersion ?? 0) + 1,
        updatedByUserId: args.updatedByUserId,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("organizationStripeConfigs", {
      organizationId: args.organizationId,
      orgSlug,
      status: "configured",
      mode: args.mode,
      publishableKey: args.publishableKey,
      secretKeyCiphertext: args.secretKeyCiphertext,
      secretKeyIv: args.secretKeyIv,
      secretKeyAuthTag: args.secretKeyAuthTag,
      webhookSecretCiphertext: args.webhookSecretCiphertext,
      webhookSecretIv: args.webhookSecretIv,
      webhookSecretAuthTag: args.webhookSecretAuthTag,
      keyVersion: 1,
      updatedByUserId: args.updatedByUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const recordWebhookEventReceived = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    eventId: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paymentWebhookEvents")
      .withIndex("by_org_event", (q) =>
        q.eq("organizationId", args.organizationId).eq("eventId", args.eventId)
      )
      .unique();

    if (existing) {
      return { duplicate: true, id: existing._id };
    }

    const now = Date.now();
    const id = await ctx.db.insert("paymentWebhookEvents", {
      organizationId: args.organizationId,
      eventId: args.eventId,
      eventType: args.eventType,
      receivedAt: now,
      status: "received",
    });

    return { duplicate: false, id };
  },
});

export const markWebhookEventProcessed = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paymentWebhookEvents")
      .withIndex("by_org_event", (q) =>
        q.eq("organizationId", args.organizationId).eq("eventId", args.eventId)
      )
      .unique();

    if (!existing) {
      return;
    }

    await ctx.db.patch(existing._id, {
      status: "processed",
      processedAt: Date.now(),
      errorMessage: undefined,
    });
  },
});

export const markWebhookEventFailed = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    eventId: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paymentWebhookEvents")
      .withIndex("by_org_event", (q) =>
        q.eq("organizationId", args.organizationId).eq("eventId", args.eventId)
      )
      .unique();

    if (!existing) {
      return;
    }

    await ctx.db.patch(existing._id, {
      status: "failed",
      processedAt: Date.now(),
      errorMessage: args.errorMessage,
    });
  },
});

export const logWebhookAttempt = internalMutation({
  args: {
    orgSlug: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    stripeEventId: v.optional(v.string()),
    eventType: v.optional(v.string()),
    httpStatus: v.number(),
    failureStage: v.union(
      v.literal("route_validation"),
      v.literal("config_lookup"),
      v.literal("signature_verification"),
      v.literal("event_recording"),
      v.literal("event_processing"),
      v.literal("success"),
      v.literal("duplicate")
    ),
    failureCode: v.optional(v.string()),
    failureMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("paymentWebhookAttempts", {
      orgSlug: args.orgSlug,
      organizationId: args.organizationId,
      stripeEventId: args.stripeEventId,
      eventType: args.eventType,
      receivedAt: Date.now(),
      httpStatus: args.httpStatus,
      failureStage: args.failureStage,
      failureCode: args.failureCode,
      failureMessage: args.failureMessage,
    });
  },
});

export const getOrganizationStripeConfigStatus = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requireOrganizationMembership(ctx, args.organizationId);

    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      return null;
    }

    const config = await ctx.db
      .query("organizationStripeConfigs")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .first();

    return {
      organizationId: args.organizationId,
      orgSlug: organization.slug ?? organization.clerkId,
      status: config?.status ?? "incomplete",
      mode: config?.mode ?? null,
      keyVersion: config?.keyVersion ?? 0,
      updatedAt: config?.updatedAt ?? null,
      hasSecretKey: Boolean(config?.secretKeyCiphertext),
      hasWebhookSecret: Boolean(config?.webhookSecretCiphertext),
      hasPublishableKey: Boolean(config?.publishableKey),
    };
  },
});

export const getOrganizationPaymentHealth = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requireOrganizationMembership(ctx, args.organizationId);

    const events = await ctx.db
      .query("paymentWebhookEvents")
      .withIndex("by_org_received", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .take(100);
    const attempts = await ctx.db
      .query("paymentWebhookAttempts")
      .withIndex("by_org_received", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .take(25);

    const failures = events.filter((event) => event.status === "failed");
    const lastWebhookAt = events[0]?.receivedAt ?? null;
    const lastFailure = failures[0] ?? null;
    const deliveryFailures = attempts.filter((attempt) => attempt.httpStatus >= 400);
    const lastAttempt = attempts[0] ?? null;
    const lastDeliveryFailure = deliveryFailures[0] ?? null;

    return {
      lastWebhookAt,
      recentEventsCount: events.length,
      recentFailureCount: failures.length,
      lastFailureAt: lastFailure?.processedAt ?? null,
      lastFailureMessage: lastFailure?.errorMessage ?? null,
      lastAttemptAt: lastAttempt?.receivedAt ?? null,
      lastAttemptStatus: lastAttempt?.httpStatus ?? null,
      recentDeliveryFailureCount: deliveryFailures.length,
      lastDeliveryFailureAt: lastDeliveryFailure?.receivedAt ?? null,
      lastDeliveryFailureMessage: lastDeliveryFailure?.failureMessage ?? null,
      recentAttempts: attempts.map((attempt) => ({
        _id: attempt._id,
        receivedAt: attempt.receivedAt,
        httpStatus: attempt.httpStatus,
        failureStage: attempt.failureStage,
        failureCode: attempt.failureCode ?? null,
        failureMessage: attempt.failureMessage ?? null,
        eventType: attempt.eventType ?? null,
      })),
    };
  },
});

export const upsertOrganizationStripeConfig = action({
  args: {
    organizationId: v.id("organizations"),
    secretKey: v.string(),
    webhookSecret: v.string(),
    publishableKey: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"organizationStripeConfigs">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const user: any = await ctx.runQuery(api.queries.getCurrentUser);
    if (!user) {
      throw new Error("Authenticated user record not found");
    }

    const organizations = await ctx.runQuery(api.queries.getUserOrganizations);
    const activeMembership = organizations.find((organization: any) => organization?._id === args.organizationId);
    const isAdmin = isAdminRole(activeMembership?.role);
    if (!isAdmin) {
      throw new Error("ORG_UNAUTHORIZED");
    }

    let encrypted: {
      secretKeyCiphertext: string;
      secretKeyIv: string;
      secretKeyAuthTag: string;
      webhookSecretCiphertext: string;
      webhookSecretIv: string;
      webhookSecretAuthTag: string;
    };
    try {
      encrypted = await ctx.runAction(internal.paymentsNode.encryptStripeSecrets, {
        secretKey: args.secretKey,
        webhookSecret: args.webhookSecret,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Missing PAYMENT_SECRETS_MASTER_KEY")) {
        throw new Error("PAYMENT_ENV_NOT_CONFIGURED");
      }
      if (message.includes("Invalid PAYMENT_SECRETS_MASTER_KEY length")) {
        throw new Error("PAYMENT_ENV_INVALID_MASTER_KEY");
      }
      throw error;
    }

    const mode = deriveStripeMode(args.secretKey);

    return await ctx.runMutation(internal.payments.upsertOrganizationStripeConfigEncrypted, {
      organizationId: args.organizationId,
      updatedByUserId: user._id as Id<"users">,
      mode,
      publishableKey: args.publishableKey.trim(),
      ...encrypted,
    });
  },
});

export const disableOrganizationStripeConfig = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAdmin(ctx, args.organizationId);

    const existing = await ctx.db
      .query("organizationStripeConfigs")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .first();

    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, {
      status: "disabled",
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});
