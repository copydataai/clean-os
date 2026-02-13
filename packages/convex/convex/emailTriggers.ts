"use node";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { bookingFlowLog, bookingFlowWarn } from "./lib/bookingFlowDebug";

export const sendConfirmationEmail = action({
  args: {
    requestId: v.id("bookingRequests"),
  },
  handler: async (ctx, { requestId }) => {
    const request = await ctx.runQuery(internal.bookingRequests.getRequestById, {
      id: requestId,
    });
    if (!request?.email) {
      throw new Error("No email found for this request");
    }

    let quoteData: { service?: string; frequency?: string; firstName?: string } = {};
    if (request.quoteRequestId) {
      const quote = await ctx.runQuery(internal.quoteRequests.getQuoteRequestById, {
        id: request.quoteRequestId,
      });
      if (quote) {
        quoteData = {
          service: quote.service ?? undefined,
          frequency: quote.frequency ?? undefined,
          firstName: quote.firstName ?? undefined,
        };
      }
    }

    const canonicalRoute = await ctx.runQuery(
      internal.bookingRequests.resolveCanonicalBookingRouteInternal,
      { requestId }
    );
    const organizationId = canonicalRoute?.organizationId ?? request.organizationId;
    if (!organizationId) {
      throw new Error("TALLY_CONFIRMATION_FORM_NOT_CONFIGURED");
    }
    const formLinks = await ctx.runQuery(internal.integrations.getTallyFormLinksByOrganizationIdInternal, {
      organizationId,
    });
    if (!formLinks.confirmationFormUrl) {
      throw new Error("TALLY_CONFIRMATION_FORM_NOT_CONFIGURED");
    }
    const confirmUrlObj = new URL(formLinks.confirmationFormUrl);
    confirmUrlObj.searchParams.set("request_id", requestId);
    if (canonicalRoute?.handle) {
      confirmUrlObj.searchParams.set("org_slug", canonicalRoute.handle);
      bookingFlowLog("confirmation_link_org_slug_resolved", {
        source: "email_triggers.sendConfirmationEmail",
        requestId,
        handle: canonicalRoute.handle,
      });
    } else if (request.organizationId) {
      const organization = await ctx.runQuery(internal.payments.getOrganizationByIdInternal, {
        id: request.organizationId,
      });
      const fallbackHandle = organization?.slug ?? organization?.clerkId ?? null;
      if (fallbackHandle) {
        confirmUrlObj.searchParams.set("org_slug", fallbackHandle);
      }
      bookingFlowWarn("confirmation_link_org_slug_fallback", {
        source: "email_triggers.sendConfirmationEmail",
        requestId,
        reason: fallbackHandle ? "used_request_organization" : "missing_fallback_handle",
      });
    } else {
      bookingFlowWarn("confirmation_link_org_slug_missing", {
        source: "email_triggers.sendConfirmationEmail",
        requestId,
        reason: "canonical_route_unavailable",
      });
    }
    const confirmUrl = confirmUrlObj.toString();

    const sendResult = await ctx.runAction(internal.emailRenderers.sendConfirmationLinkEmail, {
      to: request.email,
      idempotencyKey: `confirmation-link:${requestId}`,
      firstName: quoteData.firstName ?? request.contactDetails,
      service: quoteData.service,
      frequency: quoteData.frequency,
      confirmUrl,
    });

    const emailSendId = sendResult?.sendId as Id<"emailSends"> | undefined;
    await ctx.runMutation(
      internal.bookingRequests.recordConfirmationEmailDispatchInternal,
      {
        requestId,
        emailSendId,
      }
    );

    return {
      success: true,
      emailSendId,
    };
  },
});

export const sendCardRequestEmail = action({
  args: {
    requestId: v.id("bookingRequests"),
  },
  handler: async (ctx, { requestId }) => {
    const request = await ctx.runQuery(internal.bookingRequests.getRequestById, {
      id: requestId,
    });
    if (!request?.email) {
      throw new Error("No email found for this request");
    }

    let quoteData: { service?: string; frequency?: string; firstName?: string; address?: string } = {};
    if (request.quoteRequestId) {
      const quote = await ctx.runQuery(internal.quoteRequests.getQuoteRequestById, {
        id: request.quoteRequestId,
      });
      if (quote) {
        quoteData = {
          service: quote.service ?? undefined,
          frequency: quote.frequency ?? undefined,
          firstName: quote.firstName ?? undefined,
          address: quote.address ?? undefined,
        };
      }
    }

    const canonicalRoute = await ctx.runQuery(
      internal.bookingRequests.resolveCanonicalBookingRouteInternal,
      { requestId }
    );
    if (!canonicalRoute?.handle) {
      throw new Error("CANONICAL_BOOKING_ROUTE_UNAVAILABLE");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const bookingPath = `/book/${canonicalRoute.handle}?request_id=${requestId}`;
    const bookingLink = `${appUrl}${bookingPath}`;

    const sendResult = await ctx.runAction(
      internal.emailRenderers.sendBookingConfirmedEmail,
      {
        to: request.email,
        idempotencyKey: `card-request:${requestId}:${Date.now()}`,
        firstName: quoteData.firstName ?? request.contactDetails ?? undefined,
        service: quoteData.service,
        frequency: quoteData.frequency,
        address: quoteData.address,
        accessMethod: request.accessMethod ?? undefined,
        pets: request.pets ?? undefined,
        bookingLink,
      }
    );

    const emailSendId = sendResult?.sendId as Id<"emailSends"> | undefined;
    await ctx.runMutation(internal.bookingRequests.recordCardRequestEmailDispatchInternal, {
      requestId,
      emailSendId,
    });

    return {
      success: true,
      emailSendId,
    };
  },
});
