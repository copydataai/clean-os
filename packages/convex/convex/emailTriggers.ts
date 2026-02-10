"use node";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
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

    const confirmBaseUrl = process.env.NEXT_PUBLIC_TALLY_CONFIRM_URL?.trim();
    if (!confirmBaseUrl) {
      throw new Error("Missing NEXT_PUBLIC_TALLY_CONFIRM_URL environment variable");
    }
    const confirmUrlObj = new URL(confirmBaseUrl);
    confirmUrlObj.searchParams.set("request_id", requestId);
    const canonicalRoute = await ctx.runQuery(
      internal.bookingRequests.resolveCanonicalBookingRouteInternal,
      { requestId }
    );
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

    await ctx.runAction(internal.emailRenderers.sendConfirmationLinkEmail, {
      to: request.email,
      idempotencyKey: `confirmation-link:${requestId}`,
      firstName: quoteData.firstName ?? request.contactDetails,
      service: quoteData.service,
      frequency: quoteData.frequency,
      confirmUrl,
    });

    // Mark that the confirmation link was sent
    await ctx.runMutation(internal.bookingRequests.markConfirmLinkSentInternal, {
      requestId,
    });

    return { success: true };
  },
});
