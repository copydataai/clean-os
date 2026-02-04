"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { createHmac, timingSafeEqual } from "crypto";

const TALLY_FIELD_IDS = {
  contactDetails: "oGJQLM",
  phoneNumber: "GlMyAz",
  email: "OGRyMA",
  accessMethod: "kELxDr",
  accessInstructions: "vYRb7g",
  parkingInstructions: "AvkGWo",
  floorTypes: "VJryOl",
  finishedBasement: "POoyJ0",
  delicateSurfaces: "EWpELq",
  attentionAreas: "Lp8yAy",
  pets: "B7v5Oe",
  homeDuringCleanings: "K1Xy7g",
  scheduleAdjustmentWindows: "EWprll",
  timingShiftOk: "POoeld",
  additionalNotes: "B7vlA4",
} as const;

const TALLY_QUOTE_FIELD_IDS = {
  firstName: "9W87bQ",
  lastName: "e6Vake",
  email: "WNL8xN",
  phone: "a6R27B",
  service: "2epKQj",
  serviceType: "BXrxMQ",
  frequency: "ky2NMR",
  squareFootage: "LbePRv",
  address: "xpAJOr",
  addressLine2: "ZNM2qo",
  postalCode: "N6a7Gl",
  city: "qd9R0G",
  state: "QDb7P7",
  additionalNotes: "67gZak",
  utm_source: "7WyN6Z",
  utm_campaign: "b7oWbL",
  gad_campaignid: "vAlPo0",
  gclid: "K69Vd8",
  status: "AdEB1D",
} as const;

function normalizeTallySignature(signature: string): string {
  return signature.startsWith("sha256=") ? signature.slice(7) : signature;
}

function verifyTallySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
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

function buildFieldMaps(fields: any[]): {
  byId: Record<string, any>;
  byKey: Record<string, any>;
} {
  const byId: Record<string, any> = {};
  const byKey: Record<string, any> = {};

  for (const field of fields) {
    const id = field?.id ?? field?.questionId ?? field?.fieldId;
    if (id) {
      byId[id] = field.value;
    }
    if (field?.key) {
      byKey[field.key] = field.value;
    }
  }

  return { byId, byKey };
}

function readHiddenField(fields: any[], key: string): string | undefined {
  for (const field of fields) {
    if (
      field?.key === key ||
      field?.id === key ||
      field?.label === key ||
      field?.name === key
    ) {
      return field.value;
    }
  }
  return undefined;
}

function toStringArray(value: any): string[] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry))
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === "object") {
    const flattened = Object.values(value).flatMap((entry) =>
      Array.isArray(entry) ? entry : [entry],
    );
    return flattened
      .map((entry) => String(entry))
      .filter((entry) => entry.length > 0);
  }
  return [String(value)];
}

function parseBookingRequestFields(fields: any[]) {
  const { byId } = buildFieldMaps(fields);
  return {
    contactDetails: byId[TALLY_FIELD_IDS.contactDetails],
    phoneNumber: byId[TALLY_FIELD_IDS.phoneNumber],
    email: byId[TALLY_FIELD_IDS.email],
    accessMethod: toStringArray(byId[TALLY_FIELD_IDS.accessMethod]),
    accessInstructions: byId[TALLY_FIELD_IDS.accessInstructions],
    parkingInstructions: byId[TALLY_FIELD_IDS.parkingInstructions],
    floorTypes: toStringArray(byId[TALLY_FIELD_IDS.floorTypes]),
    finishedBasement: byId[TALLY_FIELD_IDS.finishedBasement],
    delicateSurfaces: byId[TALLY_FIELD_IDS.delicateSurfaces],
    attentionAreas: byId[TALLY_FIELD_IDS.attentionAreas],
    pets: toStringArray(byId[TALLY_FIELD_IDS.pets]),
    homeDuringCleanings: byId[TALLY_FIELD_IDS.homeDuringCleanings],
    scheduleAdjustmentWindows: toStringArray(
      byId[TALLY_FIELD_IDS.scheduleAdjustmentWindows],
    ),
    timingShiftOk: byId[TALLY_FIELD_IDS.timingShiftOk],
    additionalNotes: byId[TALLY_FIELD_IDS.additionalNotes],
  };
}

function parseQuoteRequestFields(fields: any[]) {
  const { byId, byKey } = buildFieldMaps(fields);
  const squareRaw = byId[TALLY_QUOTE_FIELD_IDS.squareFootage];
  const squareFootage =
    typeof squareRaw === "number"
      ? squareRaw
      : squareRaw
      ? Number.parseInt(squareRaw, 10)
      : undefined;

  return {
    firstName: byId[TALLY_QUOTE_FIELD_IDS.firstName],
    lastName: byId[TALLY_QUOTE_FIELD_IDS.lastName],
    email: byId[TALLY_QUOTE_FIELD_IDS.email],
    phone: byId[TALLY_QUOTE_FIELD_IDS.phone],
    service: byId[TALLY_QUOTE_FIELD_IDS.service],
    serviceType: byId[TALLY_QUOTE_FIELD_IDS.serviceType],
    frequency: byId[TALLY_QUOTE_FIELD_IDS.frequency],
    squareFootage: Number.isNaN(squareFootage) ? undefined : squareFootage,
    address: byId[TALLY_QUOTE_FIELD_IDS.address],
    addressLine2: byId[TALLY_QUOTE_FIELD_IDS.addressLine2],
    postalCode: byId[TALLY_QUOTE_FIELD_IDS.postalCode],
    city: byId[TALLY_QUOTE_FIELD_IDS.city],
    state: byId[TALLY_QUOTE_FIELD_IDS.state],
    additionalNotes: byId[TALLY_QUOTE_FIELD_IDS.additionalNotes],
    utm_source: byKey.utm_source ?? byId[TALLY_QUOTE_FIELD_IDS.utm_source],
    utm_campaign: byKey.utm_campaign ?? byId[TALLY_QUOTE_FIELD_IDS.utm_campaign],
    gad_campaignid: byKey.gad_campaignid ?? byId[TALLY_QUOTE_FIELD_IDS.gad_campaignid],
    gclid: byKey.gclid ?? byId[TALLY_QUOTE_FIELD_IDS.gclid],
    status: byKey.Status ?? byKey.status ?? byId[TALLY_QUOTE_FIELD_IDS.status],
  };
}

function verifyAndParseTallyPayload(
  payload: string,
  signature: string,
  expectedFormId?: string,
  contextLabel?: string,
): { error: string; status: number } | { data: any; fields: any[]; formId?: string; responseId?: string } {
  const webhookSecret = process.env.TALLY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[Tally Webhook] Missing TALLY_WEBHOOK_SECRET");
    return { error: "Server configuration error", status: 500 };
  }

  if (!verifyTallySignature(payload, signature, webhookSecret)) {
    console.error("[Tally Webhook] Invalid signature", { contextLabel });
    return { error: "Invalid signature", status: 400 };
  }

  let data: any;
  try {
    data = JSON.parse(payload);
  } catch (err) {
    console.error("[Tally Webhook] Invalid JSON payload", err);
    return { error: "Invalid JSON payload", status: 400 };
  }

  if (data.eventType !== "FORM_RESPONSE") {
    console.error("[Tally Webhook] Unsupported event type", data.eventType);
    return { error: "Unsupported event type", status: 400 };
  }

  const formId = getTallyFormId(data);
  if (expectedFormId && formId !== expectedFormId) {
    console.error("[Tally Webhook] Form ID mismatch", {
      contextLabel,
      formId,
      expectedFormId,
    });
    return { error: "Mismatched form id", status: 400 };
  }

  return {
    data,
    fields: getTallyFields(data),
    formId,
    responseId: getTallyResponseId(data),
  };
}

type WebhookResult = 
  | { error: string; status: number }
  | { success: true; requestId: string; status: number; bookingRequestId?: string }
  | { success: true; requestId: any; status: number; bookingRequestId?: string };

export const handleTallyRequestWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { payload, signature }): Promise<WebhookResult> => {
    const expectedFormId = process.env.TALLY_REQUEST_FORM_ID;
    const verified = verifyAndParseTallyPayload(payload, signature, expectedFormId, "request");
    
    if ("error" in verified) {
      return verified;
    }

    const parsedFields = parseQuoteRequestFields(verified.fields);
    const contactDetails = [parsedFields.firstName, parsedFields.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const bookingRequestId = await ctx.runMutation(
      internal.bookingRequests.createRequest,
      {
        requestResponseId: verified.responseId,
        requestFormId: verified.formId,
        email: parsedFields.email,
        contactDetails: contactDetails.length > 0 ? contactDetails : undefined,
        phoneNumber: parsedFields.phone,
        rawRequestPayload: verified.data,
      },
    );

    const quoteRequestId = await ctx.runMutation(
      internal.quoteRequests.createQuoteRequest,
      {
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
      },
    );

    await ctx.runMutation(internal.bookingRequests.linkQuoteRequestToRequest, {
      requestId: bookingRequestId,
      quoteRequestId,
    });

    return { success: true, requestId: quoteRequestId, bookingRequestId, status: 200 };
  },
});

export const handleTallyConfirmationWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { payload, signature }): Promise<WebhookResult> => {
    const expectedFormId = process.env.TALLY_CONFIRM_FORM_ID;
    const verified = verifyAndParseTallyPayload(payload, signature, expectedFormId, "confirmation");
    
    if ("error" in verified) {
      return verified;
    }

    const requestId =
      readHiddenField(verified.fields, "requestId") ??
      readHiddenField(verified.fields, "request_id");
    const parsedFields = parseBookingRequestFields(verified.fields);

    const updatedRequestId = await ctx.runMutation(
      internal.bookingRequests.confirmRequest,
      {
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
      },
    );

    if (!updatedRequestId) {
      console.error("[Tally Webhook] No matching request found for confirmation");
      return { error: "Booking request not found", status: 400 };
    }

    return { success: true, requestId: updatedRequestId, status: 200 };
  },
});
