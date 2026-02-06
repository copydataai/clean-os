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

            // Send payment saved email
            const email = session.customer_email ?? session.metadata?.email;
            if (email) {
              try {
                await ctx.runAction(internal.emailRenderers.sendPaymentSavedEmail, {
                  to: email,
                  idempotencyKey: `payment-saved:${session.id}`,
                  bookingRef: session.metadata?.bookingId,
                });
              } catch (err) {
                console.error("[Stripe Webhook] Failed to send payment saved email", err);
              }
            }
          }
          break;
        }

        case "setup_intent.created": {
          const setupIntent = evt.data.object as Stripe.SetupIntent;
          console.log("[Stripe Webhook] SetupIntent lifecycle", {
            eventType: evt.type,
            setupIntentId: setupIntent.id,
            customerId: setupIntent.customer,
            status: setupIntent.status,
          });
          await ctx.runMutation(internal.cardDb.updateSetupIntentStatus, {
            setupIntentId: setupIntent.id,
            status: setupIntent.status,
            lastStripeStatus: setupIntent.status,
          });
          break;
        }

        case "setup_intent.succeeded": {
          const setupIntent = evt.data.object as Stripe.SetupIntent;
          console.log("[Stripe Webhook] SetupIntent lifecycle", {
            eventType: evt.type,
            setupIntentId: setupIntent.id,
            customerId: setupIntent.customer,
            status: setupIntent.status,
          });
          await ctx.runMutation(internal.cardDb.updateSetupIntentStatus, {
            setupIntentId: setupIntent.id,
            status: setupIntent.status,
            failureCode: undefined,
            failureMessage: undefined,
            lastStripeStatus: setupIntent.status,
          });
          if (setupIntent.metadata?.clerkId && setupIntent.payment_method) {
            await ctx.runAction(internal.cardWebhooks.saveCardFromSetupIntent, {
              setupIntentId: setupIntent.id,
              clerkId: setupIntent.metadata.clerkId,
            });
          }
          break;
        }

        case "setup_intent.requires_action": {
          const setupIntent = evt.data.object as Stripe.SetupIntent;
          console.log("[Stripe Webhook] SetupIntent lifecycle", {
            eventType: evt.type,
            setupIntentId: setupIntent.id,
            customerId: setupIntent.customer,
            status: setupIntent.status,
          });
          await ctx.runMutation(internal.cardDb.updateSetupIntentStatus, {
            setupIntentId: setupIntent.id,
            status: "requires_action",
            lastStripeStatus: setupIntent.status,
          });
          break;
        }

        case "setup_intent.canceled": {
          const setupIntent = evt.data.object as Stripe.SetupIntent;
          console.log("[Stripe Webhook] SetupIntent lifecycle", {
            eventType: evt.type,
            setupIntentId: setupIntent.id,
            customerId: setupIntent.customer,
            status: setupIntent.status,
          });
          await ctx.runMutation(internal.cardDb.updateSetupIntentStatus, {
            setupIntentId: setupIntent.id,
            status: "canceled",
            lastStripeStatus: setupIntent.status,
          });
          break;
        }

        case "setup_intent.setup_failed": {
          const setupIntent = evt.data.object as Stripe.SetupIntent;
          const failureCode = setupIntent.last_setup_error?.code;
          const failureMessage =
            setupIntent.last_setup_error?.message ?? "Card setup failed";

          console.log("[Stripe Webhook] SetupIntent setup_failed", {
            eventType: evt.type,
            setupIntentId: setupIntent.id,
            customerId: setupIntent.customer,
            status: setupIntent.status,
            failureCode,
            failureMessage,
          });

          await ctx.runMutation(internal.cardDb.updateSetupIntentStatus, {
            setupIntentId: setupIntent.id,
            status: "setup_failed",
            failureCode,
            failureMessage,
            lastStripeStatus: setupIntent.status,
          });
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
          console.log(`[Stripe Webhook] Ignoring unhandled event: ${evt.type}`);
      }
    } catch (err) {
      console.error(`Error processing Stripe event ${evt.type}:`, err);
      return { error: "Error processing webhook", status: 500 };
    }

    return { success: true, status: 200 };
  },
});
