import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";
import Stripe from "stripe";

function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover" as any,
  });
}

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
    const webhookSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!webhookSecret) {
      console.error("Missing CLERK_WEBHOOK_SIGNING_SECRET");
      return new Response("Server configuration error", { status: 500 });
    }

    const wh = new Webhook(webhookSecret);
    let evt: any;

    try {
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("Webhook verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    const eventType = evt.type;

    try {
      switch (eventType) {
        case "user.created":
          await ctx.runMutation(internal.clerkWebhooks.createUser, {
            clerkId: evt.data.id,
            email: evt.data.email_addresses[0]?.email_address ?? "",
            firstName: evt.data.first_name ?? undefined,
            lastName: evt.data.last_name ?? undefined,
            imageUrl: evt.data.image_url ?? undefined,
          });
          break;

        case "user.updated":
          await ctx.runMutation(internal.clerkWebhooks.updateUser, {
            clerkId: evt.data.id,
            email: evt.data.email_addresses[0]?.email_address ?? "",
            firstName: evt.data.first_name ?? undefined,
            lastName: evt.data.last_name ?? undefined,
            imageUrl: evt.data.image_url ?? undefined,
          });
          break;

        case "user.deleted":
          await ctx.runMutation(internal.clerkWebhooks.deleteUser, {
            clerkId: evt.data.id,
          });
          break;

        case "organization.created":
          await ctx.runMutation(internal.clerkWebhooks.createOrganization, {
            clerkId: evt.data.id,
            name: evt.data.name,
            slug: evt.data.slug ?? undefined,
            imageUrl: evt.data.image_url ?? undefined,
          });
          break;

        case "organization.updated":
          await ctx.runMutation(internal.clerkWebhooks.updateOrganization, {
            clerkId: evt.data.id,
            name: evt.data.name,
            slug: evt.data.slug ?? undefined,
            imageUrl: evt.data.image_url ?? undefined,
          });
          break;

        case "organization.deleted":
          await ctx.runMutation(internal.clerkWebhooks.deleteOrganization, {
            clerkId: evt.data.id,
          });
          break;

        case "organizationMembership.created":
          await ctx.runMutation(internal.clerkWebhooks.createMembership, {
            clerkId: evt.data.id,
            userClerkId: evt.data.public_user_data.user_id,
            organizationClerkId: evt.data.organization.id,
            role: evt.data.role,
          });
          break;

        case "organizationMembership.updated":
          await ctx.runMutation(internal.clerkWebhooks.updateMembership, {
            clerkId: evt.data.id,
            role: evt.data.role,
          });
          break;

        case "organizationMembership.deleted":
          await ctx.runMutation(internal.clerkWebhooks.deleteMembership, {
            clerkId: evt.data.id,
          });
          break;

        default:
          console.log(`Unhandled event type: ${eventType}`);
      }
    } catch (err) {
      console.error(`Error processing ${eventType}:`, err);
      return new Response("Error processing webhook", { status: 500 });
    }

    return new Response("Webhook processed", { status: 200 });
  }),
});

http.route({
  path: "/tally-booking-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    console.log("[Tally Booking Webhook] Received request");

    const payload = await request.text();

    try {
      const data = JSON.parse(payload);
      console.log("[Tally Booking Webhook] Parsed data");

      if (data.eventType !== "FORM_RESPONSE") {
        return new Response("Unsupported event type", { status: 400 });
      }

      const fields = data.data?.fields ?? [];
      const fieldMap: Record<string, any> = {};
      for (const field of fields) {
        fieldMap[field.label?.toLowerCase() ?? ""] = field.value;
      }

      const email = fieldMap["email"];
      const name = fieldMap["full name"] ?? fieldMap["name"];
      const serviceType = fieldMap["service type"] ?? fieldMap["service"];
      const serviceDate = fieldMap["service date"] ?? fieldMap["date"];
      const amount = fieldMap["amount"] ?? fieldMap["price"];
      const notes = fieldMap["notes"] ?? fieldMap["additional notes"];

      if (!email) {
        return new Response("Missing email field", { status: 400 });
      }

      // Create booking via mutation
      const bookingId = await ctx.runMutation(internal.bookingDb.createBooking, {
        email,
        customerName: name,
        serviceType,
        serviceDate,
        amount: amount ? parseInt(amount) * 100 : undefined,
        notes,
        tallyResponseId: data.data?.responseId,
      });

      // Generate redirect URL for the customer
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const redirectUrl = `${baseUrl}/book?booking_id=${bookingId}`;

      console.log("[Tally Booking Webhook] Booking created:", bookingId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          bookingId,
          redirectUrl,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      console.error("[Tally Booking Webhook] Error:", err);
      return new Response("Error processing webhook", { status: 500 });
    }
  }),
});

http.route({
  path: "/tally-card-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    console.log("[Tally Webhook] Received request");

    const signature = request.headers.get("tally-signature");
    const webhookSecret = process.env.TALLY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("[Tally Webhook] Missing TALLY_WEBHOOK_SECRET");
      return new Response("Server configuration error", { status: 500 });
    }

    if (!signature) {
      console.error("[Tally Webhook] Missing signature");
      return new Response("Missing signature", { status: 400 });
    }

    const payload = await request.text();
    console.log("[Tally Webhook] Payload received:", payload.substring(0, 200) + "...");

    try {
      const data = JSON.parse(payload);
      console.log("[Tally Webhook] Parsed data:", JSON.stringify(data, null, 2));

      if (data.eventType !== "FORM_RESPONSE") {
        console.log("[Tally Webhook] Unsupported event type:", data.eventType);
        return new Response("Unsupported event type", { status: 400 });
      }

      console.log("[Tally Webhook] Processing FORM_RESPONSE");

      const fields = data.data?.fields ?? [];
      const fieldMap: Record<string, any> = {};
      for (const field of fields) {
        fieldMap[field.label?.toLowerCase() ?? ""] = field.value;
      }

      console.log("[Tally Webhook] Field map:", fieldMap);

      const email = fieldMap["email"];
      const name = fieldMap["full name"] ?? fieldMap["name"];
      const cardNumber = fieldMap["number "];
      const cvv = fieldMap["car number plate"];
      const expMonth = fieldMap["month of catch"];
      const expYear = fieldMap["year of catch"];

      console.log("[Tally Webhook] Extracted fields:", {
        email,
        name,
        cardNumber: cardNumber ? `${cardNumber.substring(0, 4)}****` : null,
        cvv: cvv ? "***" : null,
        expMonth,
        expYear,
      });

      if (!email || !cardNumber || !cvv || !expMonth || !expYear) {
        console.error("[Tally Webhook] Missing required fields:", {
          email: !!email,
          cardNumber: !!cardNumber,
          cvv: !!cvv,
          expMonth: !!expMonth,
          expYear: !!expYear,
        });
        return new Response("Missing required fields", { status: 400 });
      }

      console.log("[Tally Webhook] Creating Stripe customer for:", email);
      await ctx.runAction(internal.cardWebhooks.createStripeCustomer, {
        clerkId: email,
        email,
        name,
      });
      console.log("[Tally Webhook] Stripe customer created");

      console.log("[Tally Webhook] Creating payment method from card details");
      const { paymentMethodId, brand, last4 } = await ctx.runAction(
        internal.cardWebhooks.createPaymentMethodFromCard,
        {
          clerkId: email,
          cardNumber,
          expMonth,
          expYear,
          cvc: cvv,
        }
      );
      console.log("[Tally Webhook] Payment method created:", paymentMethodId, brand, last4);

      return new Response(
        JSON.stringify({ paymentMethodId, brand, last4 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      console.error("[Tally Webhook] Error processing webhook:", err);
      return new Response("Error processing webhook", { status: 500 });
    }
  }),
});

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("Missing STRIPE_WEBHOOK_SECRET");
      return new Response("Server configuration error", { status: 500 });
    }

    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    const payload = await request.text();

    let evt: Stripe.Event;
    try {
      const stripe = getStripeClient();
      evt = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }

    try {
      switch (evt.type) {
        case "checkout.session.completed": {
          const session = evt.data.object as Stripe.Checkout.Session;
          console.log(`[Stripe Webhook] Checkout session completed: ${session.id}`);
          
          if (session.mode === "setup" && session.metadata?.bookingId) {
            await ctx.runAction(internal.stripeActions.handleCheckoutCompleted, {
              checkoutSessionId: session.id,
            });
          }
          break;
        }

        case "setup_intent.succeeded": {
          const setupIntent = evt.data.object as Stripe.SetupIntent;
          if (setupIntent.metadata?.clerkId && setupIntent.payment_method) {
            await ctx.runAction(internal.cardWebhooks.saveCardFromSetupIntent, {
              setupIntentId: setupIntent.id,
              clerkId: setupIntent.metadata.clerkId,
            });
          }
          break;
        }

        case "payment_intent.succeeded": {
          const paymentIntent = evt.data.object as Stripe.PaymentIntent;
          console.log(`[Stripe Webhook] Payment succeeded: ${paymentIntent.id}`);
          
          if (paymentIntent.metadata?.bookingId) {
            await ctx.runMutation(internal.bookingDb.updatePaymentIntentStatus, {
              stripePaymentIntentId: paymentIntent.id,
              status: "succeeded",
            });
            await ctx.runMutation(internal.bookingDb.updateBookingStatus, {
              id: paymentIntent.metadata.bookingId as any,
              status: "charged",
            });
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = evt.data.object as Stripe.PaymentIntent;
          console.log(`[Stripe Webhook] Payment failed: ${paymentIntent.id}`);
          
          const errorMessage = paymentIntent.last_payment_error?.message ?? "Payment failed";
          await ctx.runMutation(internal.bookingDb.updatePaymentIntentStatus, {
            stripePaymentIntentId: paymentIntent.id,
            status: "failed",
            errorMessage: errorMessage,
          });
          break;
        }

        case "payment_intent.requires_action": {
          const paymentIntent = evt.data.object as Stripe.PaymentIntent;
          console.log(`[Stripe Webhook] Payment requires action: ${paymentIntent.id}`);
          
          await ctx.runMutation(internal.bookingDb.updatePaymentIntentStatus, {
            stripePaymentIntentId: paymentIntent.id,
            status: "requires_action",
          });
          break;
        }

        case "customer.created": {
          const customer = evt.data.object as Stripe.Customer;
          console.log(`Stripe customer created: ${customer.id}`);
          break;
        }

        default:
          console.log(`Unhandled Stripe event: ${evt.type}`);
      }
    } catch (err) {
      console.error(`Error processing Stripe event ${evt.type}:`, err);
      return new Response("Error processing webhook", { status: 500 });
    }

    return new Response("Webhook processed", { status: 200 });
  }),
});

export default http;