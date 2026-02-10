import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { resend } from "./resend";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const svix_id = request.headers.get("svix-id");
    const svix_timestamp = request.headers.get("svix-timestamp");
    const svix_signature = request.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    const payload = await request.text();
    const result = await ctx.runAction(internal.httpHandlers.clerkActions.handleClerkWebhook, {
      payload,
      svix_id,
      svix_timestamp,
      svix_signature,
    });

    if ("error" in result) {
      return new Response(result.error, { status: result.status });
    }
    return new Response("Webhook processed", { status: 200 });
  }),
});

http.route({
  path: "/tally-request-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    console.log("[Tally Request Webhook] Received request");
    const url = new URL(request.url);
    const orgHandle = url.searchParams.get("org") ?? undefined;
    const signature = request.headers.get("tally-signature");
    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    const payload = await request.text();
    const result = await ctx.runAction(internal.httpHandlers.tallyActions.handleTallyRequestWebhook, {
      payload,
      signature,
      orgHandle,
    });

    if ("error" in result) {
      return new Response(result.error, { status: result.status });
    }
    return new Response(
      JSON.stringify({
        success: true,
        requestId: result.requestId,
        bookingRequestId: "bookingRequestId" in result ? result.bookingRequestId : undefined,
      }),
      {
      status: 200,
      headers: { "Content-Type": "application/json" },
      }
    );
  }),
});

http.route({
  path: "/tally-booking-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    console.log("[Tally Booking Webhook] Received request (alias)");
    const url = new URL(request.url);
    const orgHandle = url.searchParams.get("org") ?? undefined;
    const signature = request.headers.get("tally-signature");
    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    const payload = await request.text();
    const result = await ctx.runAction(internal.httpHandlers.tallyActions.handleTallyRequestWebhook, {
      payload,
      signature,
      orgHandle,
    });

    if ("error" in result) {
      return new Response(result.error, { status: result.status });
    }
    return new Response(
      JSON.stringify({
        success: true,
        requestId: result.requestId,
        bookingRequestId: "bookingRequestId" in result ? result.bookingRequestId : undefined,
      }),
      {
      status: 200,
      headers: { "Content-Type": "application/json" },
      }
    );
  }),
});

http.route({
  path: "/tally-confirmation-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    console.log("[Tally Confirmation Webhook] Received request");
    const url = new URL(request.url);
    const orgHandle = url.searchParams.get("org") ?? undefined;
    const signature = request.headers.get("tally-signature");
    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    const payload = await request.text();
    const result = await ctx.runAction(internal.httpHandlers.tallyActions.handleTallyConfirmationWebhook, {
      payload,
      signature,
      orgHandle,
    });

    if ("error" in result) {
      return new Response(result.error, { status: result.status });
    }
    return new Response(JSON.stringify({ success: true, requestId: result.requestId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/tally-card-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    console.log("[Tally Card Webhook] Received request");
    const url = new URL(request.url);
    const orgHandle = url.searchParams.get("org") ?? undefined;
    const signature = request.headers.get("tally-signature");
    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    const payload = await request.text();
    const result = await ctx.runAction(internal.httpHandlers.tallyActions.handleTallyCardWebhook, {
      payload,
      signature,
      orgHandle,
    });

    if ("error" in result) {
      return new Response(result.error, { status: result.status });
    }

    return new Response(JSON.stringify({ success: true, requestId: result.requestId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    return await resend.handleResendEventWebhook(ctx, request);
  }),
});

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const org = url.searchParams.get("org");
    if (!org) {
      await ctx.runMutation(internal.payments.logWebhookAttempt, {
        httpStatus: 400,
        failureStage: "route_validation",
        failureCode: "MISSING_ORG",
        failureMessage: "Missing org",
      });
      return new Response("Missing org", { status: 400 });
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      await ctx.runMutation(internal.payments.logWebhookAttempt, {
        orgSlug: org,
        httpStatus: 400,
        failureStage: "route_validation",
        failureCode: "MISSING_SIGNATURE",
        failureMessage: "Missing signature",
      });
      return new Response("Missing signature", { status: 400 });
    }

    const payload = await request.text();
    const result = await ctx.runAction(internal.httpHandlers.stripeActions.handleStripeWebhook, {
      orgSlug: org,
      payload,
      signature,
    });

    if ("error" in result) {
      return new Response(result.error, { status: result.status });
    }
    return new Response("Webhook processed", { status: 200 });
  }),
});

export default http;
