import type { Doc, Id } from "../_generated/dataModel";

export type PublicBookingErrorCode =
  | "REQUEST_NOT_FOUND"
  | "ORG_CONTEXT_REQUIRED"
  | "ORG_DATA_CONFLICT"
  | "ORG_NOT_CONFIGURED_PUBLIC";

type AuthorityFailure = {
  errorCode: Exclude<PublicBookingErrorCode, "ORG_NOT_CONFIGURED_PUBLIC">;
  request: null;
  quoteRequest: null;
  organization: null;
  organizationId: null;
};

type AuthoritySuccess = {
  errorCode: null;
  request: Doc<"bookingRequests">;
  quoteRequest: Doc<"quoteRequests"> | null;
  organization: Doc<"organizations">;
  organizationId: Id<"organizations">;
};

type PublicContextFailure = {
  errorCode: PublicBookingErrorCode;
  requestId: Id<"bookingRequests">;
  requestStatus: string | null;
  organizationId: Id<"organizations"> | null;
  canonicalSlug: string | null;
  stripeConfigured: boolean;
};

type PublicContextSuccess = {
  errorCode: null;
  requestId: Id<"bookingRequests">;
  requestStatus: string;
  organizationId: Id<"organizations">;
  canonicalSlug: string;
  stripeConfigured: boolean;
};

function isStripeConfigured(config: any) {
  return (
    Boolean(config) &&
    config.status === "configured" &&
    Boolean(config.secretKeyCiphertext) &&
    Boolean(config.webhookSecretCiphertext)
  );
}

export async function resolveRequestOrganizationAuthority(
  ctx: any,
  requestId: Id<"bookingRequests">
): Promise<AuthorityFailure | AuthoritySuccess> {
  const request = await ctx.db.get(requestId);
  if (!request) {
    return {
      errorCode: "REQUEST_NOT_FOUND",
      request: null,
      quoteRequest: null,
      organization: null,
      organizationId: null,
    };
  }

  const quoteRequest = request.quoteRequestId
    ? await ctx.db.get(request.quoteRequestId)
    : null;

  if (
    request.organizationId &&
    quoteRequest?.organizationId &&
    request.organizationId !== quoteRequest.organizationId
  ) {
    console.warn("ORG_DATA_CONFLICT booking request authority", {
      requestId,
      requestOrganizationId: request.organizationId,
      quoteRequestId: quoteRequest._id,
      quoteRequestOrganizationId: quoteRequest.organizationId,
    });
    return {
      errorCode: "ORG_DATA_CONFLICT",
      request: null,
      quoteRequest: null,
      organization: null,
      organizationId: null,
    };
  }

  const organizationId = request.organizationId ?? quoteRequest?.organizationId ?? null;
  if (!organizationId) {
    console.warn("ORG_CONTEXT_REQUIRED booking request authority", {
      requestId,
      quoteRequestId: quoteRequest?._id ?? null,
    });
    return {
      errorCode: "ORG_CONTEXT_REQUIRED",
      request: null,
      quoteRequest: null,
      organization: null,
      organizationId: null,
    };
  }

  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    console.warn("ORG_CONTEXT_REQUIRED missing organization row", {
      requestId,
      organizationId,
    });
    return {
      errorCode: "ORG_CONTEXT_REQUIRED",
      request: null,
      quoteRequest: null,
      organization: null,
      organizationId: null,
    };
  }

  return {
    errorCode: null,
    request,
    quoteRequest,
    organization,
    organizationId,
  };
}

export async function resolvePublicBookingContext(
  ctx: any,
  requestId: Id<"bookingRequests">
): Promise<PublicContextFailure | PublicContextSuccess> {
  const authority = await resolveRequestOrganizationAuthority(ctx, requestId);
  if (authority.errorCode) {
    return {
      errorCode: authority.errorCode,
      requestId,
      requestStatus: null,
      organizationId: null,
      canonicalSlug: null,
      stripeConfigured: false,
    };
  }

  const canonicalSlug = authority.organization.slug?.trim() ?? "";
  if (!canonicalSlug) {
    console.warn("ORG_CONTEXT_REQUIRED missing organization slug", {
      requestId,
      organizationId: authority.organizationId,
    });
    return {
      errorCode: "ORG_CONTEXT_REQUIRED",
      requestId,
      requestStatus: authority.request.status ?? null,
      organizationId: authority.organizationId,
      canonicalSlug: null,
      stripeConfigured: false,
    };
  }

  const stripeConfig = await ctx.db
    .query("organizationStripeConfigs")
    .withIndex("by_organization", (q: any) =>
      q.eq("organizationId", authority.organizationId)
    )
    .order("desc")
    .first();
  const stripeConfigured = isStripeConfigured(stripeConfig);

  if (!stripeConfigured) {
    return {
      errorCode: "ORG_NOT_CONFIGURED_PUBLIC",
      requestId,
      requestStatus: authority.request.status,
      organizationId: authority.organizationId,
      canonicalSlug,
      stripeConfigured: false,
    };
  }

  return {
    errorCode: null,
    requestId,
    requestStatus: authority.request.status,
    organizationId: authority.organizationId,
    canonicalSlug,
    stripeConfigured: true,
  };
}

