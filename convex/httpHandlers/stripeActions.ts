"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Stripe from "stripe";

function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover" as any,
  });
}

export const handleStripeWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { payload, signature }) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("Missing STRIPE_WEBHOOK_SECRET");
      return { error: "Server configuration error", status: 500 };
    }

    let evt: Stripe.Event;
    try {
      const stripe = getStripeClient();
      evt = await stripe.webhooks.constructEventAsync(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error("Stripe webhook verification failed:", err);
      return { error: "Invalid signature", status: 400 };
    }

    try {
      switch (evt.type) {
        case "checkout.session.completed": {
          const session = evt.data.object as Stripe.Checkout.Session;
          console.log(
            `[Stripe Webhook] Checkout session completed: ${session.id}`,
          );

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

          const errorMessage =
            paymentIntent.last_payment_error?.message ?? "Payment failed";
          await ctx.runMutation(internal.bookingDb.updatePaymentIntentStatus, {
            stripePaymentIntentId: paymentIntent.id,
            status: "failed",
            errorMessage: errorMessage,
          });
          break;
        }

        case "payment_intent.requires_action": {
          const paymentIntent = evt.data.object as Stripe.PaymentIntent;
          console.log(
            `[Stripe Webhook] Payment requires action: ${paymentIntent.id}`,
          );

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
      return { error: "Error processing webhook", status: 500 };
    }

    return { success: true, status: 200 };
  },
});
