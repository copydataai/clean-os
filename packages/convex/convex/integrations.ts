import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOrganizationAdmin } from "./lib/orgContext";
import {
  BOOKING_CONFIRMATION_REQUIRED_TARGETS,
  QUOTE_REQUEST_REQUIRED_TARGETS,
  hasRequiredMappings,
  suggestMappingForTargets,
  tallyMappingsValidator,
  type TallyFlowMappings,
  type TallyMappings,
} from "./lib/tallyMappings";

const TALLY_PROVIDER = "tally" as const;
const internalApi: any = internal;

type TallyIntegrationDoc = Doc<"organizationIntegrations">;

type TallyForm = {
  id: string;
  name: string;
  createdAt?: number;
  updatedAt?: number;
};

type TallyQuestion = {
  id?: string;
  key?: string;
  label: string;
  type?: string;
};

type TallyWebhookRecord = {
  id?: string;
  url?: string;
  formId?: string;
  eventType?: string;
};

const QUOTE_TARGET_SYNONYMS: Record<string, string[]> = {
  firstName: ["first name", "firstname", "first_name"],
  lastName: ["last name", "lastname", "last_name"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "phone number", "mobile"],
  service: ["service", "cleaning service"],
  serviceType: ["service type", "cleaning type", "type of service"],
  frequency: ["frequency", "how often"],
  squareFootage: ["square footage", "sqft", "square feet"],
  address: ["address", "street", "address line 1"],
  addressLine2: ["address line 2", "apt", "suite", "unit"],
  postalCode: ["postal code", "zip", "zip code"],
  city: ["city", "town"],
  state: ["state", "province"],
  additionalNotes: ["notes", "additional notes", "details"],
  utm_source: ["utm source", "utm_source"],
  utm_campaign: ["utm campaign", "utm_campaign"],
  gad_campaignid: ["gad campaign id", "campaign id", "gad_campaignid"],
  gclid: ["gclid"],
  status: ["status"],
};

const CONFIRMATION_TARGET_SYNONYMS: Record<string, string[]> = {
  contactDetails: ["contact details", "full name", "name"],
  phoneNumber: ["phone", "phone number", "mobile"],
  email: ["email", "email address"],
  accessMethod: ["access method", "entry method"],
  accessInstructions: ["access instructions", "entry instructions"],
  parkingInstructions: ["parking", "parking instructions"],
  floorTypes: ["floor types", "floors"],
  finishedBasement: ["finished basement", "basement"],
  delicateSurfaces: ["delicate surfaces"],
  attentionAreas: ["attention areas", "focus areas"],
  pets: ["pets", "animals"],
  homeDuringCleanings: ["home during cleanings", "home during cleaning"],
  scheduleAdjustmentWindows: ["schedule adjustment", "adjustment windows"],
  timingShiftOk: ["timing shift", "time shift ok", "schedule shift"],
  additionalNotes: ["notes", "additional notes"],
};

function normalizeString(value: string): string {
  return value.toLowerCase().trim();
}

function trimOrUndefined(value?: string | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toTallyItems(payload: any): any[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.forms)) {
    return payload.forms;
  }
  if (Array.isArray(payload?.webhooks)) {
    return payload.webhooks;
  }
  if (Array.isArray(payload?.questions)) {
    return payload.questions;
  }
  return [];
}

function normalizeTallyForms(payload: any): TallyForm[] {
  const forms: TallyForm[] = [];
  for (const entry of toTallyItems(payload)) {
    const id =
      trimOrUndefined(entry?.id) ??
      trimOrUndefined(entry?.formId) ??
      trimOrUndefined(entry?.form_id);
    if (!id) {
      continue;
    }
    forms.push({
      id,
      name:
        trimOrUndefined(entry?.name) ??
        trimOrUndefined(entry?.title) ??
        trimOrUndefined(entry?.slug) ??
        id,
      createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : undefined,
      updatedAt: typeof entry?.updatedAt === "number" ? entry.updatedAt : undefined,
    });
  }
  return forms;
}

function normalizeTallyQuestions(payload: any): TallyQuestion[] {
  const questions: TallyQuestion[] = [];
  for (const entry of toTallyItems(payload)) {
    const label =
      trimOrUndefined(entry?.label) ??
      trimOrUndefined(entry?.title) ??
      trimOrUndefined(entry?.text) ??
      trimOrUndefined(entry?.name) ??
      trimOrUndefined(entry?.key) ??
      trimOrUndefined(entry?.id);
    if (!label) {
      continue;
    }
    questions.push({
      id: trimOrUndefined(entry?.id) ?? trimOrUndefined(entry?.questionId),
      key: trimOrUndefined(entry?.key),
      label,
      type: trimOrUndefined(entry?.type),
    });
  }
  return questions;
}

function normalizeTallyWebhooks(payload: any): TallyWebhookRecord[] {
  return toTallyItems(payload)
    .map((entry) => ({
      id: trimOrUndefined(entry?.id),
      url: trimOrUndefined(entry?.url) ?? trimOrUndefined(entry?.targetUrl),
      formId:
        trimOrUndefined(entry?.formId) ??
        trimOrUndefined(entry?.form_id) ??
        trimOrUndefined(entry?.form?.id),
      eventType:
        trimOrUndefined(entry?.eventType) ??
        trimOrUndefined(entry?.event_type) ??
        trimOrUndefined(entry?.event),
    }))
    .filter((entry) => Boolean(entry.id || entry.url || entry.formId));
}

function sanitizeMappings(mappings?: TallyMappings | null): TallyMappings {
  const sanitizeFlow = (flow?: TallyFlowMappings): TallyFlowMappings | undefined => {
    if (!flow) {
      return undefined;
    }

    const sanitized: TallyFlowMappings = {};
    for (const [target, ref] of Object.entries(flow)) {
      const questionId = trimOrUndefined(ref?.questionId);
      const key = trimOrUndefined(ref?.key);
      const label = trimOrUndefined(ref?.label);
      if (!questionId && !key && !label) {
        continue;
      }
      sanitized[target] = { questionId, key, label };
    }

    if (Object.keys(sanitized).length === 0) {
      return undefined;
    }

    return sanitized;
  };

  return {
    quoteRequest: sanitizeFlow(mappings?.quoteRequest),
    bookingConfirmation: sanitizeFlow(mappings?.bookingConfirmation),
  };
}

function hasCredentials(config: Partial<TallyIntegrationDoc>): boolean {
  return Boolean(
    config.apiKeyCiphertext &&
      config.apiKeyIv &&
      config.apiKeyAuthTag &&
      config.webhookSecretCiphertext &&
      config.webhookSecretIv &&
      config.webhookSecretAuthTag,
  );
}

function deriveConfigStatus(config: Partial<TallyIntegrationDoc>): "configured" | "incomplete" {
  const mappings = sanitizeMappings((config.fieldMappings as TallyMappings | undefined) ?? undefined);

  const formsReady = Boolean(config.requestFormId && config.confirmationFormId);
  const mappingsReady =
    hasRequiredMappings(mappings.quoteRequest, QUOTE_REQUEST_REQUIRED_TARGETS) &&
    hasRequiredMappings(mappings.bookingConfirmation, BOOKING_CONFIRMATION_REQUIRED_TARGETS);

  if (hasCredentials(config) && formsReady && mappingsReady) {
    return "configured";
  }
  return "incomplete";
}

async function getIntegrationByOrganization(
  ctx: any,
  organizationId: Id<"organizations">,
): Promise<TallyIntegrationDoc | null> {
  return (
    (await ctx.db
      .query("organizationIntegrations")
      .withIndex("by_org_provider", (q: any) =>
        q.eq("organizationId", organizationId).eq("provider", TALLY_PROVIDER),
      )
      .order("desc")
      .first()) ?? null
  );
}

async function getOrganizationByPublicHandle(ctx: any, handle: string) {
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

async function collectActiveFormConflicts(
  ctx: any,
  args: {
    organizationId?: Id<"organizations">;
    provider: "tally";
    formId: string;
  },
): Promise<TallyIntegrationDoc[]> {
  const requestMatches = await ctx.db
    .query("organizationIntegrations")
    .withIndex("by_provider_request_form", (q: any) =>
      q.eq("provider", args.provider).eq("requestFormId", args.formId),
    )
    .collect();
  const confirmationMatches = await ctx.db
    .query("organizationIntegrations")
    .withIndex("by_provider_confirmation_form", (q: any) =>
      q.eq("provider", args.provider).eq("confirmationFormId", args.formId),
    )
    .collect();
  const map = new Map<string, TallyIntegrationDoc>();
  for (const entry of [...requestMatches, ...confirmationMatches]) {
    map.set(String(entry._id), entry);
  }

  return [...map.values()].filter(
    (entry) =>
      entry.status !== "disabled" &&
      (!args.organizationId || entry.organizationId !== args.organizationId),
  );
}

async function requireActionAdminContext(
  ctx: any,
  organizationId?: Id<"organizations">,
): Promise<{
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  orgHandle: string;
}> {
  const { user, organization } = await requireOrganizationAdmin(ctx, organizationId);

  return {
    organizationId: organization._id,
    userId: user._id,
    orgHandle: organization.slug ?? organization.clerkId,
  };
}

async function fetchQuestionsForForm(ctx: any, apiKey: string, formId: string) {
  const tryPaths = [
    `/forms/${formId}/questions`,
    `/forms/${formId}`,
  ];

  for (const path of tryPaths) {
    try {
      const response = await ctx.runAction(internalApi.integrationsNode.tallyApiRequest, {
        apiKey,
        path,
      });
      const questions = normalizeTallyQuestions(response.data);
      if (questions.length > 0) {
        return questions;
      }
    } catch {
      // Try next path.
    }
  }

  return [] as TallyQuestion[];
}

function inferTargetFromEndpoint(
  endpoint: "request" | "confirmation",
  config: TallyIntegrationDoc,
): string | undefined {
  if (endpoint === "request") {
    return config.requestFormId;
  }
  return config.confirmationFormId;
}

const endpointValidator = v.union(
  v.literal("request"),
  v.literal("confirmation"),
);

export const getTallyIntegrationByOrganizationId = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await getIntegrationByOrganization(ctx, args.organizationId);
  },
});

export const getTallyIntegrationByOrgHandle = internalQuery({
  args: {
    orgHandle: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await getOrganizationByPublicHandle(ctx, args.orgHandle);
    if (!organization) {
      return null;
    }

    return await getIntegrationByOrganization(ctx, organization._id);
  },
});

export const getTallyIntegrationByFormId = internalQuery({
  args: {
    formId: v.string(),
  },
  handler: async (ctx, args) => {
    const matches = await collectActiveFormConflicts(ctx, {
      provider: TALLY_PROVIDER,
      formId: args.formId,
    });

    if (matches.length === 0) {
      return null;
    }
    if (matches.length > 1) {
      throw new Error(`FORM_ID_AMBIGUOUS:${args.formId}`);
    }

    return matches[0] ?? null;
  },
});

export const getTallyIntegrationByWebhookRouteToken = internalQuery({
  args: {
    routeToken: v.string(),
  },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("organizationIntegrations")
      .withIndex("by_provider_route_token", (q: any) =>
        q.eq("provider", TALLY_PROVIDER).eq("webhookRouteToken", args.routeToken),
      )
      .collect();

    const active = matches.filter((entry: TallyIntegrationDoc) => entry.status !== "disabled");
    if (active.length === 0) {
      return null;
    }
    if (active.length > 1) {
      throw new Error(`WEBHOOK_ROUTE_TOKEN_AMBIGUOUS:${args.routeToken}`);
    }
    return active[0] ?? null;
  },
});

export const logIntegrationWebhookAttempt = internalMutation({
  args: {
    provider: v.union(v.literal("tally")),
    organizationId: v.optional(v.id("organizations")),
    endpoint: endpointValidator,
    routeOrgHandle: v.optional(v.string()),
    routeToken: v.optional(v.string()),
    formId: v.optional(v.string()),
    eventType: v.optional(v.string()),
    webhookId: v.optional(v.string()),
    httpStatus: v.number(),
    stage: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("integrationWebhookAttempts", {
      ...args,
      receivedAt: Date.now(),
    });
  },
});

export const upsertTallyIntegrationEncrypted = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    updatedByUserId: v.id("users"),
    apiKeyCiphertext: v.string(),
    apiKeyIv: v.string(),
    apiKeyAuthTag: v.string(),
    webhookSecretCiphertext: v.string(),
    webhookSecretIv: v.string(),
    webhookSecretAuthTag: v.string(),
    webhookRouteToken: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"organizationIntegrations">> => {
    const now = Date.now();
    const existing = await getIntegrationByOrganization(ctx, args.organizationId);

    const status = deriveConfigStatus({
      ...existing,
      ...args,
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: TALLY_PROVIDER,
        status,
        apiKeyCiphertext: args.apiKeyCiphertext,
        apiKeyIv: args.apiKeyIv,
        apiKeyAuthTag: args.apiKeyAuthTag,
        webhookSecretCiphertext: args.webhookSecretCiphertext,
        webhookSecretIv: args.webhookSecretIv,
        webhookSecretAuthTag: args.webhookSecretAuthTag,
        webhookRouteToken: existing.webhookRouteToken ?? args.webhookRouteToken,
        updatedByUserId: args.updatedByUserId,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("organizationIntegrations", {
      organizationId: args.organizationId,
      provider: TALLY_PROVIDER,
      status,
      apiKeyCiphertext: args.apiKeyCiphertext,
      apiKeyIv: args.apiKeyIv,
      apiKeyAuthTag: args.apiKeyAuthTag,
      webhookSecretCiphertext: args.webhookSecretCiphertext,
      webhookSecretIv: args.webhookSecretIv,
      webhookSecretAuthTag: args.webhookSecretAuthTag,
      webhookRouteToken: args.webhookRouteToken,
      updatedByUserId: args.updatedByUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const touchTallyValidation = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const existing = await getIntegrationByOrganization(ctx, args.organizationId);
    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, {
      lastValidationAt: Date.now(),
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

export const touchTallySync = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const existing = await getIntegrationByOrganization(ctx, args.organizationId);
    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, {
      lastSyncAt: Date.now(),
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

export const saveTallyWebhookIdsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    webhookIds: v.object({
      request: v.optional(v.string()),
      confirmation: v.optional(v.string()),
    }),
    updatedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await getIntegrationByOrganization(ctx, args.organizationId);
    if (!existing) {
      throw new Error("TALLY_NOT_CONFIGURED");
    }

    await ctx.db.patch(existing._id, {
      webhookIds: args.webhookIds,
      updatedByUserId: args.updatedByUserId,
      updatedAt: Date.now(),
    });

    return existing._id;
  },
});

export const ensureTallyWebhookRouteTokenInternal = internalMutation({
  args: {
    integrationId: v.id("organizationIntegrations"),
    webhookRouteToken: v.string(),
    updatedByUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db.get(args.integrationId);
    if (!integration || integration.provider !== TALLY_PROVIDER) {
      throw new Error("TALLY_NOT_CONFIGURED");
    }

    if (integration.webhookRouteToken) {
      return integration.webhookRouteToken;
    }

    await ctx.db.patch(integration._id, {
      webhookRouteToken: args.webhookRouteToken,
      updatedByUserId: args.updatedByUserId ?? integration.updatedByUserId,
      updatedAt: Date.now(),
    });

    return args.webhookRouteToken;
  },
});

export const bootstrapTallyIntegrationFromEnvInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    updatedByUserId: v.id("users"),
    apiKeyCiphertext: v.string(),
    apiKeyIv: v.string(),
    apiKeyAuthTag: v.string(),
    webhookSecretCiphertext: v.string(),
    webhookSecretIv: v.string(),
    webhookSecretAuthTag: v.string(),
    webhookRouteToken: v.string(),
    requestFormId: v.optional(v.string()),
    confirmationFormId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await getIntegrationByOrganization(ctx, args.organizationId);
    const now = Date.now();

    for (const formId of [args.requestFormId, args.confirmationFormId].filter(Boolean) as string[]) {
      const conflicts = await collectActiveFormConflicts(ctx, {
        organizationId: args.organizationId,
        provider: TALLY_PROVIDER,
        formId,
      });
      if (conflicts.length > 0) {
        throw new Error(`FORM_ID_ALREADY_USED:${formId}`);
      }
    }

    const next: Partial<TallyIntegrationDoc> = {
      ...existing,
      ...args,
      provider: TALLY_PROVIDER,
      formIds: {
        request: args.requestFormId,
        confirmation: args.confirmationFormId,
      },
    };

    const status = deriveConfigStatus(next);

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: TALLY_PROVIDER,
        status,
        apiKeyCiphertext: args.apiKeyCiphertext,
        apiKeyIv: args.apiKeyIv,
        apiKeyAuthTag: args.apiKeyAuthTag,
        webhookSecretCiphertext: args.webhookSecretCiphertext,
        webhookSecretIv: args.webhookSecretIv,
        webhookSecretAuthTag: args.webhookSecretAuthTag,
        webhookRouteToken: existing.webhookRouteToken ?? args.webhookRouteToken,
        requestFormId: args.requestFormId,
        confirmationFormId: args.confirmationFormId,
        formIds: {
          request: args.requestFormId,
          confirmation: args.confirmationFormId,
        },
        updatedByUserId: args.updatedByUserId,
        updatedAt: now,
      });

      return existing._id;
    }

    return await ctx.db.insert("organizationIntegrations", {
      organizationId: args.organizationId,
      provider: TALLY_PROVIDER,
      status,
      apiKeyCiphertext: args.apiKeyCiphertext,
      apiKeyIv: args.apiKeyIv,
      apiKeyAuthTag: args.apiKeyAuthTag,
      webhookSecretCiphertext: args.webhookSecretCiphertext,
      webhookSecretIv: args.webhookSecretIv,
      webhookSecretAuthTag: args.webhookSecretAuthTag,
      webhookRouteToken: args.webhookRouteToken,
      requestFormId: args.requestFormId,
      confirmationFormId: args.confirmationFormId,
      formIds: {
        request: args.requestFormId,
        confirmation: args.confirmationFormId,
      },
      updatedByUserId: args.updatedByUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getTallyIntegrationStatus = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganizationAdmin(ctx, args.organizationId);
    const integration = await getIntegrationByOrganization(ctx, organization._id);
    const baseUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim() ?? "";

    if (!integration) {
      return {
        provider: TALLY_PROVIDER,
        status: "incomplete" as const,
        orgHandle: organization.slug ?? organization.clerkId,
        hasApiKey: false,
        hasWebhookSecret: false,
        hasWebhookRouteToken: false,
        routeMode: "legacy_query" as const,
        webhookUrls: {
          request: null,
          confirmation: null,
        },
        formIds: {
          request: null,
          confirmation: null,
        },
        webhookIds: {
          request: null,
          confirmation: null,
        },
        fieldMappings: {
          quoteRequest: {},
          bookingConfirmation: {},
        } as TallyMappings,
        lastSyncAt: null,
        lastValidationAt: null,
        updatedAt: null,
      };
    }

    const routeToken = integration.webhookRouteToken?.trim();
    const canBuildWebhookUrls = Boolean(baseUrl && routeToken);
    const webhookUrls = {
      request: canBuildWebhookUrls ? `${baseUrl}/tally-request-webhook/${routeToken}` : null,
      confirmation: canBuildWebhookUrls ? `${baseUrl}/tally-confirmation-webhook/${routeToken}` : null,
    };

    return {
      provider: integration.provider,
      status: integration.status,
      orgHandle: organization.slug ?? organization.clerkId,
      hasApiKey: Boolean(integration.apiKeyCiphertext),
      hasWebhookSecret: Boolean(integration.webhookSecretCiphertext),
      hasWebhookRouteToken: Boolean(integration.webhookRouteToken),
      routeMode: integration.webhookRouteToken ? ("path_token" as const) : ("legacy_query" as const),
      webhookUrls,
      formIds: {
        request: integration.requestFormId ?? integration.formIds?.request ?? null,
        confirmation:
          integration.confirmationFormId ?? integration.formIds?.confirmation ?? null,
      },
      webhookIds: {
        request: integration.webhookIds?.request ?? null,
        confirmation: integration.webhookIds?.confirmation ?? null,
      },
      fieldMappings: sanitizeMappings(integration.fieldMappings as TallyMappings | undefined),
      lastSyncAt: integration.lastSyncAt ?? null,
      lastValidationAt: integration.lastValidationAt ?? null,
      updatedAt: integration.updatedAt,
    };
  },
});

export const upsertTallyCredentials = action({
  args: {
    organizationId: v.optional(v.id("organizations")),
    apiKey: v.string(),
    webhookSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId } = await requireActionAdminContext(ctx, args.organizationId);

    const encrypted = await ctx.runAction(internalApi.integrationsNode.encryptIntegrationSecrets, {
      apiKey: args.apiKey,
      webhookSecret: args.webhookSecret,
    });
    const webhookRouteToken = await ctx.runAction(
      internalApi.integrationsNode.generateTallyWebhookRouteToken,
      {},
    );

    const id = await ctx.runMutation(internalApi.integrations.upsertTallyIntegrationEncrypted, {
      organizationId,
      updatedByUserId: userId,
      webhookRouteToken,
      ...encrypted,
    });

    return { id };
  },
});

export const validateTallyConnection = action({
  args: {
    organizationId: v.optional(v.id("organizations")),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireActionAdminContext(ctx, args.organizationId);

    let apiKey = trimOrUndefined(args.apiKey);

    if (!apiKey) {
      const decrypted = await ctx.runAction(internalApi.integrationsNode.decryptTallyConfig, {
        organizationId,
      });
      apiKey = decrypted.apiKey;
    }

    try {
      const response = await ctx.runAction(internalApi.integrationsNode.tallyApiRequest, {
        apiKey,
        path: "/forms?limit=1",
      });
      await ctx.runMutation(internalApi.integrations.touchTallyValidation, {
        organizationId,
      });

      return {
        ok: true,
        status: response.status,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "TALLY_CONNECTION_FAILED",
      };
    }
  },
});

export const syncTallyFormsAndQuestions = action({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireActionAdminContext(ctx, args.organizationId);

    const decrypted = await ctx.runAction(internalApi.integrationsNode.decryptTallyConfig, {
      organizationId,
    });

    const formsResponse = await ctx.runAction(internalApi.integrationsNode.tallyApiRequest, {
      apiKey: decrypted.apiKey,
      path: "/forms",
    });

    const forms = normalizeTallyForms(formsResponse.data);

    const formsWithQuestions = await Promise.all(
      forms.map(async (form) => {
        const questions = await fetchQuestionsForForm(ctx, decrypted.apiKey, form.id);
        return {
          ...form,
          questions,
        };
      }),
    );

    const questionMap = new Map(formsWithQuestions.map((form) => [form.id, form.questions]));

    const requestQuestions =
      questionMap.get(decrypted.requestFormId ?? "") ?? [];
    const confirmationQuestions =
      questionMap.get(decrypted.confirmationFormId ?? "") ?? [];
    const suggestions: TallyMappings = {
      quoteRequest: suggestMappingForTargets(requestQuestions, QUOTE_TARGET_SYNONYMS),
      bookingConfirmation: suggestMappingForTargets(
        confirmationQuestions,
        CONFIRMATION_TARGET_SYNONYMS,
      ),
    };

    await ctx.runMutation(internalApi.integrations.touchTallySync, {
      organizationId,
    });

    return {
      forms: formsWithQuestions,
      suggestions,
    };
  },
});

export const saveTallyMappingsAndFormsInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    updatedByUserId: v.id("users"),
    webhookRouteToken: v.string(),
    requestFormId: v.string(),
    confirmationFormId: v.string(),
    fieldMappings: tallyMappingsValidator,
  },
  handler: async (ctx, args) => {
    const requestFormId = trimOrUndefined(args.requestFormId);
    const confirmationFormId = trimOrUndefined(args.confirmationFormId);

    if (!requestFormId || !confirmationFormId) {
      throw new Error("REQUEST_AND_CONFIRMATION_FORMS_REQUIRED");
    }

    const uniqueLocal = new Set([requestFormId, confirmationFormId].filter(Boolean));
    if (uniqueLocal.size !== [requestFormId, confirmationFormId].filter(Boolean).length) {
      throw new Error("FORM_IDS_MUST_BE_UNIQUE");
    }

    for (const formId of [requestFormId, confirmationFormId].filter(Boolean) as string[]) {
      const conflicts = await collectActiveFormConflicts(ctx, {
        organizationId: args.organizationId,
        provider: TALLY_PROVIDER,
        formId,
      });
      if (conflicts.length > 0) {
        throw new Error(`FORM_ID_ALREADY_USED:${formId}`);
      }
    }

    const sanitizedMappings = sanitizeMappings(args.fieldMappings as TallyMappings);

    const existing = await getIntegrationByOrganization(ctx, args.organizationId);
    const now = Date.now();
    const webhookRouteToken = existing?.webhookRouteToken ?? args.webhookRouteToken;

    const next: Partial<TallyIntegrationDoc> = {
      ...existing,
      requestFormId,
      confirmationFormId,
      webhookRouteToken,
      fieldMappings: sanitizedMappings as any,
    };
    const status = deriveConfigStatus(next);

    if (!existing) {
      return await ctx.db.insert("organizationIntegrations", {
        organizationId: args.organizationId,
        provider: TALLY_PROVIDER,
        status,
        webhookRouteToken,
        requestFormId,
        confirmationFormId,
        formIds: {
          request: requestFormId,
          confirmation: confirmationFormId,
        },
        fieldMappings: sanitizedMappings as any,
        updatedByUserId: args.updatedByUserId,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(existing._id, {
      status,
      requestFormId,
      confirmationFormId,
      webhookRouteToken,
      formIds: {
        request: requestFormId,
        confirmation: confirmationFormId,
      },
      fieldMappings: sanitizedMappings as any,
      updatedByUserId: args.updatedByUserId,
      updatedAt: now,
    });

    return existing._id;
  },
});

export const saveTallyMappingsAndForms = action({
  args: {
    organizationId: v.optional(v.id("organizations")),
    requestFormId: v.string(),
    confirmationFormId: v.string(),
    fieldMappings: tallyMappingsValidator,
  },
  handler: async (ctx, args) => {
    const { organizationId: requestedOrganizationId, requestFormId, confirmationFormId, fieldMappings } = args;
    const { organizationId, userId } = await requireActionAdminContext(ctx, requestedOrganizationId);
    const webhookRouteToken = await ctx.runAction(
      internalApi.integrationsNode.generateTallyWebhookRouteToken,
      {},
    );

    return await ctx.runMutation(internalApi.integrations.saveTallyMappingsAndFormsInternal, {
      organizationId,
      updatedByUserId: userId,
      webhookRouteToken,
      requestFormId,
      confirmationFormId,
      fieldMappings,
    });
  },
});

export const listTallyWebhookHealth = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganizationAdmin(ctx, args.organizationId);
    const limit = args.limit ?? 25;

    return await ctx.db
      .query("integrationWebhookAttempts")
      .withIndex("by_org_provider_received", (q) =>
        q.eq("organizationId", organization._id).eq("provider", TALLY_PROVIDER),
      )
      .order("desc")
      .take(limit);
  },
});

export const ensureTallyWebhooks = action({
  args: {
    organizationId: v.optional(v.id("organizations")),
    operation: v.union(v.literal("list"), v.literal("ensure"), v.literal("delete")),
    target: v.optional(v.union(v.literal("all"), endpointValidator)),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId } = await requireActionAdminContext(ctx, args.organizationId);

    const decrypted = await ctx.runAction(internalApi.integrationsNode.decryptTallyConfig, {
      organizationId,
    });

    const listResponse = await ctx.runAction(internalApi.integrationsNode.tallyApiRequest, {
      apiKey: decrypted.apiKey,
      path: "/webhooks",
    });

    const existingWebhooks = normalizeTallyWebhooks(listResponse.data);

    if (args.operation === "list") {
      return {
        webhooks: existingWebhooks,
      };
    }

    const targetList =
      args.target && args.target !== "all"
        ? [args.target]
        : (["request", "confirmation"] as const);

    const baseUrl = process.env.CONVEX_SITE_URL?.trim();
    if (!baseUrl) {
      throw new Error("MISSING_CONVEX_SITE_URL");
    }

    const pathByEndpoint: Record<"request" | "confirmation", string> = {
      request: "/tally-request-webhook",
      confirmation: "/tally-confirmation-webhook",
    };

    const nextWebhookIds = {
      request: decrypted.webhookIds?.request,
      confirmation: decrypted.webhookIds?.confirmation,
    } as {
      request?: string;
      confirmation?: string;
    };

    const operationResults: Array<{
      endpoint: "request" | "confirmation";
      action: "created" | "updated" | "deleted" | "unchanged" | "skipped";
      webhookId?: string;
      reason?: string;
    }> = [];

    for (const endpoint of targetList) {
      const formId = inferTargetFromEndpoint(endpoint, decrypted);
      if (!formId) {
        operationResults.push({
          endpoint,
          action: "skipped",
          reason: "FORM_ID_NOT_CONFIGURED",
        });
        continue;
      }

      const routeToken = decrypted.webhookRouteToken;
      if (!routeToken) {
        throw new Error("MISSING_WEBHOOK_ROUTE_TOKEN");
      }
      const targetUrl = `${baseUrl}${pathByEndpoint[endpoint]}/${encodeURIComponent(routeToken)}`;
      const knownId = nextWebhookIds[endpoint];

      const knownWebhook = knownId
        ? existingWebhooks.find((webhook) => webhook.id === knownId)
        : undefined;

      const matchedWebhook =
        knownWebhook ??
        existingWebhooks.find(
          (webhook) =>
            webhook.formId === formId &&
            normalizeString(webhook.eventType ?? "") === "form_response",
        );

      if (args.operation === "delete") {
        if (!matchedWebhook?.id) {
          operationResults.push({ endpoint, action: "unchanged" });
          nextWebhookIds[endpoint] = undefined;
          continue;
        }

        await ctx.runAction(internalApi.integrationsNode.tallyApiRequest, {
          apiKey: decrypted.apiKey,
          path: `/webhooks/${matchedWebhook.id}`,
          method: "DELETE",
        });

        nextWebhookIds[endpoint] = undefined;
        operationResults.push({
          endpoint,
          action: "deleted",
          webhookId: matchedWebhook.id,
        });
        continue;
      }

      if (matchedWebhook?.id) {
        const needsUpdate = matchedWebhook.url !== targetUrl || matchedWebhook.formId !== formId;

        if (needsUpdate) {
          await ctx.runAction(internalApi.integrationsNode.tallyApiRequest, {
            apiKey: decrypted.apiKey,
            path: `/webhooks/${matchedWebhook.id}`,
            method: "PATCH",
            body: {
              url: targetUrl,
              eventTypes: ["FORM_RESPONSE"],
              formId,
            },
          });

          operationResults.push({
            endpoint,
            action: "updated",
            webhookId: matchedWebhook.id,
          });
        } else {
          operationResults.push({
            endpoint,
            action: "unchanged",
            webhookId: matchedWebhook.id,
          });
        }

        nextWebhookIds[endpoint] = matchedWebhook.id;
        continue;
      }

      const created = await ctx.runAction(internalApi.integrationsNode.tallyApiRequest, {
        apiKey: decrypted.apiKey,
        path: "/webhooks",
        method: "POST",
        body: {
          url: targetUrl,
          eventTypes: ["FORM_RESPONSE"],
          formId,
        },
      });

      const createdWebhook = normalizeTallyWebhooks(created.data)[0];
      const createdId = createdWebhook?.id ?? trimOrUndefined(created.data?.id);
      nextWebhookIds[endpoint] = createdId;

      operationResults.push({
        endpoint,
        action: "created",
        webhookId: createdId,
      });
    }

    await ctx.runMutation(internalApi.integrations.saveTallyWebhookIdsInternal, {
      organizationId,
      webhookIds: nextWebhookIds,
      updatedByUserId: userId,
    });

    return {
      operation: args.operation,
      results: operationResults,
      webhookIds: nextWebhookIds,
    };
  },
});

export const bootstrapTallyIntegrationFromEnv = action({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { organizationId, userId } = await requireActionAdminContext(ctx, args.organizationId);

    const apiKey = trimOrUndefined(process.env.TALLY_API_KEY);
    const webhookSecret = trimOrUndefined(process.env.TALLY_WEBHOOK_SECRET);

    if (!apiKey || !webhookSecret) {
      return {
        seeded: false,
        reason: "TALLY_API_KEY_OR_TALLY_WEBHOOK_SECRET_MISSING",
      };
    }

    const encrypted = await ctx.runAction(internalApi.integrationsNode.encryptIntegrationSecrets, {
      apiKey,
      webhookSecret,
    });
    const webhookRouteToken = await ctx.runAction(
      internalApi.integrationsNode.generateTallyWebhookRouteToken,
      {},
    );

    const id = await ctx.runMutation(internalApi.integrations.bootstrapTallyIntegrationFromEnvInternal, {
      organizationId,
      updatedByUserId: userId,
      webhookRouteToken,
      ...encrypted,
      requestFormId: trimOrUndefined(process.env.TALLY_REQUEST_FORM_ID),
      confirmationFormId: trimOrUndefined(process.env.TALLY_CONFIRM_FORM_ID),
    });

    return {
      seeded: true,
      id,
    };
  },
});
