"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { renderQuotePdfBuffer } from "./pdf/quotePdf";

async function sendRevisionInternal(
  ctx: any,
  quoteRequestId: Id<"quoteRequests">,
  revisionId?: Id<"quoteRevisions">
): Promise<{
  success: boolean;
  quoteId: Id<"quotes">;
  revisionId: Id<"quoteRevisions">;
  storageId: Id<"_storage">;
  downloadUrl: string | null;
}> {
  const data: any = await ctx.runQuery(internal.quotes.getQuoteByRequestIdInternal, {
    quoteRequestId,
  });
  if (!data) {
    throw new Error("Quote not found");
  }

  const { quote, quoteRequest, currentRevision, profile }: any = data;
  const revision =
    (revisionId
      ? data.revisions.find((candidate: any) => candidate._id === revisionId)
      : null) ?? currentRevision;

  if (!revision) {
    throw new Error("No revision found to send");
  }
  if (!profile) {
    throw new Error("Quote profile not found");
  }
  if (!quoteRequest.email) {
    throw new Error("Quote request is missing email");
  }

  const pdfBuffer = await renderQuotePdfBuffer({
    quoteNumber: quote.quoteNumber,
    sentAt: Date.now(),
    profile: {
      displayName: profile.displayName,
      legalName: profile.legalName,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      state: profile.state,
      postalCode: profile.postalCode,
    },
    recipient: revision.recipientSnapshot,
    lineItem: {
      serviceLabel: revision.serviceLabel,
      description: revision.description,
      quantity: revision.quantity,
      unitPriceCents: revision.unitPriceCents,
      subtotalCents: revision.subtotalCents,
      taxName: revision.taxName,
      taxRateBps: revision.taxRateBps,
      taxAmountCents: revision.taxAmountCents,
      totalCents: revision.totalCents,
      currency: revision.currency,
    },
    inclusions: revision.inclusionsSnapshot,
    terms: revision.termsSnapshot,
  });

  const filename = `quote_${quote.quoteNumber}_rev_${revision.revisionNumber}.pdf`;
  const pdfBytes = Uint8Array.from(pdfBuffer);
  const storageId = await ctx.storage.store(new Blob([pdfBytes], { type: "application/pdf" }));
  const downloadUrl = await ctx.storage.getUrl(storageId);

  const confirmBaseUrl = process.env.NEXT_PUBLIC_TALLY_CONFIRM_URL?.trim();
  if (!confirmBaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_TALLY_CONFIRM_URL environment variable");
  }
  const confirmUrlObj = new URL(confirmBaseUrl);
  const bookingRequestId = quoteRequest.bookingRequestId ?? quote.bookingRequestId;
  if (!bookingRequestId) {
    throw new Error("Quote request is missing linked booking request id");
  }
  confirmUrlObj.searchParams.set("request_id", bookingRequestId);
  const confirmUrl = confirmUrlObj.toString();

  try {
    const sendResult = await ctx.runAction(internal.emailRenderers.sendQuoteReadyEmail, {
      to: quoteRequest.email,
      idempotencyKey: `quote-ready:${quote._id}:${revision._id}:${revision.revisionNumber}`,
      firstName: revision.recipientSnapshot.firstName,
      quoteNumber: quote.quoteNumber,
      totalCents: revision.totalCents,
      currency: revision.currency,
      validUntilTimestamp:
        Date.now() + (profile.quoteValidityDays ?? 30) * 24 * 60 * 60 * 1000,
      confirmUrl,
      downloadUrl: downloadUrl ?? undefined,
      serviceLabel: revision.serviceLabel,
      attachmentFilename: filename,
      attachmentContentBase64: pdfBuffer.toString("base64"),
      attachmentContentType: "application/pdf",
    });

    await ctx.runMutation(internal.quotes.markRevisionSendResult, {
      quoteId: quote._id,
      revisionId: revision._id,
      status: "sent",
      pdfStorageId: storageId,
      pdfFilename: filename,
      emailSendId: sendResult?.sendId,
    });

    await ctx.runMutation(internal.quoteRequests.updateRequestStatusInternal, {
      quoteRequestId: quoteRequest._id,
      requestStatus: "quoted",
    });

    return {
      success: true,
      quoteId: quote._id,
      revisionId: revision._id,
      storageId,
      downloadUrl,
    };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Failed to send quote";
    await ctx.runMutation(internal.quotes.markRevisionSendResult, {
      quoteId: quote._id,
      revisionId: revision._id,
      status: "failed",
      pdfStorageId: storageId,
      pdfFilename: filename,
      errorMessage: message,
    });
    throw error;
  }
}

export const sendRevisionNode = internalAction({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    revisionId: v.optional(v.id("quoteRevisions")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    quoteId: Id<"quotes">;
    revisionId: Id<"quoteRevisions">;
    storageId: Id<"_storage">;
    downloadUrl: string | null;
  }> => {
    return await sendRevisionInternal(ctx, args.quoteRequestId, args.revisionId);
  },
});

export const retrySendRevisionNode = internalAction({
  args: {
    quoteRequestId: v.id("quoteRequests"),
    revisionId: v.id("quoteRevisions"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    quoteId: Id<"quotes">;
    revisionId: Id<"quoteRevisions">;
    storageId: Id<"_storage">;
    downloadUrl: string | null;
  }> => {
    return await sendRevisionInternal(ctx, args.quoteRequestId, args.revisionId);
  },
});
