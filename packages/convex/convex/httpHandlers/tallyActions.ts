"use node";

import { createHmac, timingSafeEqual } from "crypto";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import {
  BOOKING_CONFIRMATION_REQUIRED_TARGETS,
  QUOTE_REQUEST_REQUIRED_TARGETS,
  type TallyMappings,
} from "../lib/tallyMappings";
import {
  buildTallyFieldMaps,
  parseFlowValuesFromMapping,
  readHiddenField,
  toStringArray,
} from "../lib/tallyRuntime";

type Endpoint = "request" | "confirmation" | "card";

type WebhookResult =
  | { error: string; status: number }
  | { success: true; requestId?: string; bookingRequestId?: string; status: number };

type VerifiedWebhookPayload = {
  data: any;
  fields: any[];
  formId?: string;
  responseId?: string;
  config: {
    organizationId: any;
    orgHandle?: string | null;
    requestFormId?: string;
    confirmationFormId?: string;
    cardFormId?: string;
    webhookIds?: {
      request?: string;
      confirmation?: string;
      card?: string;
    };
    fieldMappings?: TallyMappings;
    webhookSecret: string;
  };
};

function normalizeTallySignature(signature: string): string {
  return signature.startsWith("sha256=") ? signature.slice(7) : signature;
}

function verifyTallySignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("base64");
  const provided = normalizeTallySignature(signature);
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

function getTallyFormId(data: any): string | undefined {
  return (
    data?.data?.formId ??
    data?.data?.formID ??
    data?.data?.form_id ??
    data?.formId ??
    data?.formID ??
    data?.form_id
  );
}

function getTallyResponseId(data: any): string | undefined {
  return (
    data?.data?.responseId ??
    data?.data?.responseID ??
    data?.responseId ??
    data?.responseID
  );
}

function getTallyFields(data: any): any[] {
  return data?.data?.fields ?? [];
}

function expectedFormIdForEndpoint(config: VerifiedWebhookPayload["config"], endpoint: Endpoint) {
  if (endpoint === "request") {
    return config.requestFormId;
  }
  if (endpoint === "confirmation") {
    return config.confirmationFormId;
  }
  return config.cardFormId;
}

function logMissingFields(
  contextLabel: string,
  fields: Record<string, any>,
  requiredKeys: readonly string[],
) {
  const missing = requiredKeys.filter((key) => {
    const value = fields[key];
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return value === undefined || value === null || value === "";
  });
  if (missing.length > 0) {
    console.warn(`[Tally Webhook] Missing ${contextLabel} fields`, { missing });
  }
}

function parseQuoteRequestFields(fields: any[], mappings?: TallyMappings) {
  const maps = buildTallyFieldMaps(fields);
  const mapped = parseFlowValuesFromMapping(maps, mappings?.quoteRequest);

  const squareRaw = mapped.squareFootage;
  const squareFootage =
    typeof squareRaw === "number"
      ? squareRaw
      : squareRaw
      ? Number.parseInt(String(squareRaw), 10)
      : undefined;

  return {
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    email: mapped.email,
    phone: mapped.phone,
    service: mapped.service,
    serviceType: mapped.serviceType,
    frequency: mapped.frequency,
    squareFootage: Number.isNaN(squareFootage) ? undefined : squareFootage,
    address: mapped.address,
    addressLine2: mapped.addressLine2,
    postalCode: mapped.postalCode,
    city: mapped.city,
    state: mapped.state,
    additionalNotes: mapped.additionalNotes,
    utm_source: mapped.utm_source,
    utm_campaign: mapped.utm_campaign,
    gad_campaignid: mapped.gad_campaignid,
    gclid: mapped.gclid,
    status: mapped.status,
  };
}

function parseBookingRequestFields(fields: any[], mappings?: TallyMappings) {
  const maps = buildTallyFieldMaps(fields);
  const mapped = parseFlowValuesFromMapping(maps, mappings?.bookingConfirmation);

  return {
    contactDetails: mapped.contactDetails,
    phoneNumber: mapped.phoneNumber,
    email: mapped.email,
    accessMethod: toStringArray(mapped.accessMethod),
    accessInstructions: mapped.accessInstructions,
    parkingInstructions: mapped.parkingInstructions,
    floorTypes: toStringArray(mapped.floorTypes),
    finishedBasement: mapped.finishedBasement,
    delicateSurfaces: mapped.delicateSurfaces,
    attentionAreas: mapped.attentionAreas,
    pets: toStringArray(mapped.pets),
    homeDuringCleanings: mapped.homeDuringCleanings,
    scheduleAdjustmentWindows: toStringArray(mapped.scheduleAdjustmentWindows),
    timingShiftOk: mapped.timingShiftOk,
    additionalNotes: mapped.additionalNotes,
  };
}

function parseCardCaptureFields(fields: any[], mappings?: TallyMappings) {
  const maps = buildTallyFieldMaps(fields);
  const mapped = parseFlowValuesFromMapping(maps, mappings?.cardCapture);

  return {
    email: mapped.email,
    paymentMethod: mapped.paymentMethod,
    cardLast4: mapped.cardLast4,
    cardBrand: mapped.cardBrand,
    status: mapped.status,
  };
}

async function logTallyAttempt(
  ctx: any,
  args: {
    endpoint: Endpoint;
    organizationId?: any;
    routeOrgHandle?: string;
    formId?: string;
    eventType?: string;
    webhookId?: string;
    httpStatus: number;
    stage: string;
    message?: string;
  },
) {
  await ctx.runMutation(internal.integrations.logIntegrationWebhookAttempt, {
    provider: "tally",
    organizationId: args.organizationId,
    endpoint: args.endpoint,
    routeOrgHandle: args.routeOrgHandle,
    formId: args.formId,
    eventType: args.eventType,
    webhookId: args.webhookId,
    httpStatus: args.httpStatus,
    stage: args.stage,
    message: args.message,
  });
}

async function verifyAndResolveTallyPayload(
  ctx: any,
  args: {
    payload: string;
    signature: string;
    endpoint: Endpoint;
    orgHandle?: string;
  },
): Promise<{ error: string; status: number } | VerifiedWebhookPayload> {
  let data: any;
  try {
    data = JSON.parse(args.payload);
  } catch (err) {
    await logTallyAttempt(ctx, {
      endpoint: args.endpoint,
      routeOrgHandle: args.orgHandle,
      httpStatus: 400,
      stage: "payload_parse",
      message: err instanceof Error ? err.message : "Invalid JSON payload",
    });
    return { error: "Invalid JSON payload", status: 400 };
  }

  const eventType = data?.eventType;
  const formId = getTallyFormId(data);

  let config: any;
  try {
    config = args.orgHandle
      ? await ctx.runAction(internal.integrationsNode.decryptTallyConfig, {
          orgHandle: args.orgHandle,
        })
      : formId
        ? await ctx.runAction(internal.integrationsNode.decryptTallyConfig, {
            formId,
          })
        : null;
  } catch (err) {
    await logTallyAttempt(ctx, {
      endpoint: args.endpoint,
      routeOrgHandle: args.orgHandle,
      formId,
      eventType,
      httpStatus: 400,
      stage: "config_lookup",
      message: err instanceof Error ? err.message : "TALLY_NOT_CONFIGURED",
    });
    return { error: "TALLY_NOT_CONFIGURED", status: 400 };
  }

  if (!config) {
    await logTallyAttempt(ctx, {
      endpoint: args.endpoint,
      routeOrgHandle: args.orgHandle,
      formId,
      eventType,
      httpStatus: 400,
      stage: "config_lookup",
      message: "TALLY_NOT_CONFIGURED",
    });
    return { error: "TALLY_NOT_CONFIGURED", status: 400 };
  }

  if (!verifyTallySignature(args.payload, args.signature, config.webhookSecret)) {
    await logTallyAttempt(ctx, {
      endpoint: args.endpoint,
      organizationId: config.organizationId,
      routeOrgHandle: args.orgHandle,
      formId,
      eventType,
      webhookId: config.webhookIds?.[args.endpoint],
      httpStatus: 400,
      stage: "signature_verification",
      message: "Invalid signature",
    });
    return { error: "Invalid signature", status: 400 };
  }

  if (eventType !== "FORM_RESPONSE") {
    await logTallyAttempt(ctx, {
      endpoint: args.endpoint,
      organizationId: config.organizationId,
      routeOrgHandle: args.orgHandle,
      formId,
      eventType,
      webhookId: config.webhookIds?.[args.endpoint],
      httpStatus: 400,
      stage: "event_type",
      message: `Unsupported event type: ${String(eventType)}`,
    });
    return { error: "Unsupported event type", status: 400 };
  }

  const expectedFormId = expectedFormIdForEndpoint(config, args.endpoint);
  if (expectedFormId && formId !== expectedFormId) {
    await logTallyAttempt(ctx, {
      endpoint: args.endpoint,
      organizationId: config.organizationId,
      routeOrgHandle: args.orgHandle,
      formId,
      eventType,
      webhookId: config.webhookIds?.[args.endpoint],
      httpStatus: 400,
      stage: "form_id_mismatch",
      message: `Expected ${expectedFormId} but received ${formId ?? "none"}`,
    });
    return { error: "Mismatched form id", status: 400 };
  }

  return {
    data,
    formId,
    responseId: getTallyResponseId(data),
    fields: getTallyFields(data),
    config,
  };
}

export const handleTallyRequestWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
    orgHandle: v.optional(v.string()),
  },
  handler: async (ctx, { payload, signature, orgHandle }): Promise<WebhookResult> => {
    const verified = await verifyAndResolveTallyPayload(ctx, {
      payload,
      signature,
      endpoint: "request",
      orgHandle,
    });

    if ("error" in verified) {
      return verified;
    }

    const parsedFields = parseQuoteRequestFields(verified.fields, verified.config.fieldMappings);
    logMissingFields("quote request", parsedFields, QUOTE_REQUEST_REQUIRED_TARGETS);

    const contactDetails = [parsedFields.firstName, parsedFields.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const bookingRequestId = await ctx.runMutation(internal.bookingRequests.createRequest, {
      organizationId: verified.config.organizationId,
      requestResponseId: verified.responseId,
      requestFormId: verified.formId,
      email: parsedFields.email,
      contactDetails: contactDetails.length > 0 ? contactDetails : undefined,
      phoneNumber: parsedFields.phone,
      rawRequestPayload: verified.data,
    });

    const quoteRequestId = await ctx.runMutation(internal.quoteRequests.createQuoteRequest, {
      organizationId: verified.config.organizationId,
      firstName: parsedFields.firstName,
      lastName: parsedFields.lastName,
      email: parsedFields.email,
      phone: parsedFields.phone,
      service: parsedFields.service,
      serviceType: parsedFields.serviceType,
      frequency: parsedFields.frequency,
      squareFootage: parsedFields.squareFootage,
      address: parsedFields.address,
      addressLine2: parsedFields.addressLine2,
      postalCode: parsedFields.postalCode,
      city: parsedFields.city,
      state: parsedFields.state,
      additionalNotes: parsedFields.additionalNotes,
      utm_source: parsedFields.utm_source,
      utm_campaign: parsedFields.utm_campaign,
      gad_campaignid: parsedFields.gad_campaignid,
      gclid: parsedFields.gclid,
      status: parsedFields.status,
      tallyFormId: verified.formId,
      bookingRequestId,
      rawRequestPayload: verified.data,
    });

    await ctx.runMutation(internal.bookingRequests.linkQuoteRequestToRequest, {
      requestId: bookingRequestId,
      quoteRequestId,
    });

    if (parsedFields.email) {
      try {
        await ctx.runAction(internal.emailRenderers.sendQuoteReceivedEmail, {
          to: parsedFields.email,
          idempotencyKey: `quote-received:${quoteRequestId}`,
          firstName: parsedFields.firstName,
          service: parsedFields.service,
          serviceType: parsedFields.serviceType,
          frequency: parsedFields.frequency,
          squareFootage: parsedFields.squareFootage,
          address: parsedFields.address,
          city: parsedFields.city,
          state: parsedFields.state,
        });
      } catch (err) {
        console.error("[Tally Webhook] Failed to send quote received email", err);
      }
    }

    await logTallyAttempt(ctx, {
      endpoint: "request",
      organizationId: verified.config.organizationId,
      routeOrgHandle: orgHandle,
      formId: verified.formId,
      eventType: "FORM_RESPONSE",
      webhookId: verified.config.webhookIds?.request,
      httpStatus: 200,
      stage: "success",
    });

    return { success: true, requestId: quoteRequestId, bookingRequestId, status: 200 };
  },
});

export const handleTallyConfirmationWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
    orgHandle: v.optional(v.string()),
  },
  handler: async (ctx, { payload, signature, orgHandle }): Promise<WebhookResult> => {
    const verified = await verifyAndResolveTallyPayload(ctx, {
      payload,
      signature,
      endpoint: "confirmation",
      orgHandle,
    });

    if ("error" in verified) {
      return verified;
    }

    const requestId =
      readHiddenField(verified.fields, "requestId") ??
      readHiddenField(verified.fields, "request_id");

    const parsedFields = parseBookingRequestFields(verified.fields, verified.config.fieldMappings);
    logMissingFields("booking confirmation", parsedFields, BOOKING_CONFIRMATION_REQUIRED_TARGETS);

    const updatedRequestId = await ctx.runMutation(internal.bookingRequests.confirmRequest, {
      organizationId: verified.config.organizationId,
      requestId: requestId ? (requestId as any) : undefined,
      email: parsedFields.email,
      confirmationResponseId: verified.responseId,
      confirmationFormId: verified.formId,
      contactDetails: parsedFields.contactDetails,
      phoneNumber: parsedFields.phoneNumber,
      accessMethod: parsedFields.accessMethod,
      accessInstructions: parsedFields.accessInstructions,
      parkingInstructions: parsedFields.parkingInstructions,
      floorTypes: parsedFields.floorTypes,
      finishedBasement: parsedFields.finishedBasement,
      delicateSurfaces: parsedFields.delicateSurfaces,
      attentionAreas: parsedFields.attentionAreas,
      pets: parsedFields.pets,
      homeDuringCleanings: parsedFields.homeDuringCleanings,
      scheduleAdjustmentWindows: parsedFields.scheduleAdjustmentWindows,
      timingShiftOk: parsedFields.timingShiftOk,
      additionalNotes: parsedFields.additionalNotes,
      rawConfirmationPayload: verified.data,
    });

    if (!updatedRequestId) {
      await logTallyAttempt(ctx, {
        endpoint: "confirmation",
        organizationId: verified.config.organizationId,
        routeOrgHandle: orgHandle,
        formId: verified.formId,
        eventType: "FORM_RESPONSE",
        webhookId: verified.config.webhookIds?.confirmation,
        httpStatus: 400,
        stage: "request_resolution",
        message: "Booking request not found",
      });
      return { error: "Booking request not found", status: 400 };
    }

    const confirmEmail = parsedFields.email;
    if (confirmEmail && updatedRequestId) {
      try {
        const bookingRequest = await ctx.runQuery(internal.bookingRequests.getRequestById, {
          id: updatedRequestId,
        });

        let quoteData: { service?: string; frequency?: string; address?: string; firstName?: string } = {};
        if (bookingRequest?.quoteRequestId) {
          const quote = await ctx.runQuery(internal.quoteRequests.getQuoteRequestById, {
            id: bookingRequest.quoteRequestId,
          });
          if (quote) {
            quoteData = {
              service: quote.service ?? undefined,
              frequency: quote.frequency ?? undefined,
              address: quote.address ?? undefined,
              firstName: quote.firstName ?? undefined,
            };
          }
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
        const organization = await ctx.runQuery(internal.payments.getOrganizationByIdInternal, {
          id: verified.config.organizationId,
        });
        const orgHandleForLink =
          verified.config.orgHandle ?? organization?.slug ?? organization?.clerkId;

        if (!orgHandleForLink) {
          throw new Error("ORG_HANDLE_MISSING_FOR_BOOKING_LINK");
        }

        const bookingPath = `/book/${orgHandleForLink}?request_id=${updatedRequestId}`;
        const bookingLink = `${appUrl}${bookingPath}`;

        await ctx.runAction(internal.emailRenderers.sendBookingConfirmedEmail, {
          to: confirmEmail,
          idempotencyKey: `booking-confirmed:${updatedRequestId}`,
          firstName: quoteData.firstName ?? parsedFields.contactDetails,
          service: quoteData.service,
          frequency: quoteData.frequency,
          address: quoteData.address,
          accessMethod: parsedFields.accessMethod,
          pets: parsedFields.pets,
          bookingLink,
        });
      } catch (err) {
        console.error("[Tally Webhook] Failed to send booking confirmed email", err);
      }
    }

    await logTallyAttempt(ctx, {
      endpoint: "confirmation",
      organizationId: verified.config.organizationId,
      routeOrgHandle: orgHandle,
      formId: verified.formId,
      eventType: "FORM_RESPONSE",
      webhookId: verified.config.webhookIds?.confirmation,
      httpStatus: 200,
      stage: "success",
    });

    return { success: true, requestId: updatedRequestId, status: 200 };
  },
});

export const handleTallyCardWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
    orgHandle: v.optional(v.string()),
  },
  handler: async (ctx, { payload, signature, orgHandle }): Promise<WebhookResult> => {
    const verified = await verifyAndResolveTallyPayload(ctx, {
      payload,
      signature,
      endpoint: "card",
      orgHandle,
    });

    if ("error" in verified) {
      return verified;
    }

    const parsed = parseCardCaptureFields(verified.fields, verified.config.fieldMappings);

    await logTallyAttempt(ctx, {
      endpoint: "card",
      organizationId: verified.config.organizationId,
      routeOrgHandle: orgHandle,
      formId: verified.formId,
      eventType: "FORM_RESPONSE",
      webhookId: verified.config.webhookIds?.card,
      httpStatus: 200,
      stage: "success",
      message: JSON.stringify({
        email: parsed.email,
        status: parsed.status,
      }),
    });

    return { success: true, requestId: verified.responseId, status: 200 };
  },
});
