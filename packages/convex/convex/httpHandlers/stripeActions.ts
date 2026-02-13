"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Stripe from "stripe";
import { extractBrandFromProfile } from "../lib/brandUtils";

function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2025-12-15.clover" as any,
  });
}

export const handleStripeWebhook = internalAction({
  args: {
    orgSlug: v.string(),
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { orgSlug, payload, signature }) => {
    let stripe: Stripe;
    let webhookSecret: string;
    let organizationId: any;

    const logAttempt = async (args: {
      organizationId?: any;
      stripeEventId?: string;
      eventType?: string;
      httpStatus: number;
      failureStage:
        | "route_validation"
        | "config_lookup"
        | "signature_verification"
        | "event_recording"
        | "event_processing"
        | "success"
        | "duplicate";
      failureCode?: string;
      failureMessage?: string;
    }) => {
      await ctx.runMutation(internal.payments.logWebhookAttempt, {
        orgSlug,
        organizationId: args.organizationId,
        stripeEventId: args.stripeEventId,
        eventType: args.eventType,
        httpStatus: args.httpStatus,
        failureStage: args.failureStage,
        failureCode: args.failureCode,
        failureMessage: args.failureMessage,
      });
    };

    try {
      const config = await ctx.runAction(internal.paymentsNode.getDecryptedStripeConfigForOrgSlug, {
        orgSlug,
      });
      stripe = createStripeClient(config.secretKey);
      webhookSecret = config.webhookSecret;
      organizationId = config.organizationId;
    } catch (err) {
      console.error("[Stripe Webhook] Missing or invalid organization config", { orgSlug, err });
      await logAttempt({
        httpStatus: 400,
        failureStage: "config_lookup",
        failureCode: "ORG_NOT_CONFIGURED",
        failureMessage: err instanceof Error ? err.message : "ORG_NOT_CONFIGURED",
      });
      return { error: "ORG_NOT_CONFIGURED", status: 400 };
    }

    let evt: Stripe.Event;
    try {
      evt = await stripe.webhooks.constructEventAsync(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error("Stripe webhook verification failed:", err);
      await logAttempt({
        organizationId,
        httpStatus: 400,
        failureStage: "signature_verification",
        failureCode: "INVALID_SIGNATURE",
        failureMessage: err instanceof Error ? err.message : "Invalid signature",
      });
      return { error: "Invalid signature", status: 400 };
    }

    let recorded: { duplicate: boolean; id: any };
    try {
      recorded = await ctx.runMutation(internal.payments.recordWebhookEventReceived, {
        organizationId,
        eventId: evt.id,
        eventType: evt.type,
      });
    } catch (err) {
      await logAttempt({
        organizationId,
        stripeEventId: evt.id,
        eventType: evt.type,
        httpStatus: 500,
        failureStage: "event_recording",
        failureCode: "RECORD_EVENT_FAILED",
        failureMessage: err instanceof Error ? err.message : "Failed to record event",
      });
      return { error: "Error processing webhook", status: 500 };
    }

    if (recorded.duplicate) {
      await logAttempt({
        organizationId,
        stripeEventId: evt.id,
        eventType: evt.type,
        httpStatus: 200,
        failureStage: "duplicate",
      });
      return { success: true, status: 200 };
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
              organizationId,
            });

            // Send payment saved email
            const email = session.customer_email ?? session.metadata?.email;
            if (email) {
              try {
                const profile = await ctx.runQuery(internal.quoteProfiles.getProfileByOrganizationIdInternal, { organizationId });
                await ctx.runAction(internal.emailRenderers.sendPaymentSavedEmail, {
                  to: email,
                  idempotencyKey: `payment-saved:${session.id}`,
                  bookingRef: session.metadata?.bookingId,
                  brand: extractBrandFromProfile(profile),
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
          if (
            setupIntent.metadata?.bookingId &&
            setupIntent.payment_method &&
            setupIntent.customer
          ) {
            await ctx.runAction(internal.stripeActions.applyCardSetupResult, {
              organizationId,
              setupIntentId: setupIntent.id,
              bookingId: setupIntent.metadata.bookingId as any,
              stripeCustomerId: setupIntent.customer as string,
              stripePaymentMethodId: setupIntent.payment_method as string,
            });
          } else {
            console.log("[Stripe Webhook] setup_intent.succeeded missing booking metadata", {
              setupIntentId: setupIntent.id,
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
            const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
              id: paymentIntent.metadata.bookingId as any,
            });
            if (!booking || booking.organizationId !== organizationId) {
              console.warn("[Stripe Webhook] Ignoring cross-org payment_intent.succeeded", {
                paymentIntentId: paymentIntent.id,
                organizationId,
                bookingOrganizationId: booking?.organizationId,
              });
              break;
            }
            await ctx.runMutation(internal.bookingDb.updatePaymentIntentStatus, {
              organizationId,
              stripePaymentIntentId: paymentIntent.id,
              status: "succeeded",
            });
            await ctx.runMutation(internal.bookingDb.updateBookingStatus, {
              id: paymentIntent.metadata.bookingId as any,
              status: "charged",
              source: "httpHandlers.stripeActions.webhook",
              reason: "payment_intent.succeeded",
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
            organizationId,
            stripePaymentIntentId: paymentIntent.id,
            status: "failed",
            errorMessage: errorMessage,
          });

          if (paymentIntent.metadata?.bookingId) {
            const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
              id: paymentIntent.metadata.bookingId as any,
            });
            if (!booking || booking.organizationId !== organizationId) {
              console.warn("[Stripe Webhook] Ignoring cross-org payment_intent.payment_failed", {
                paymentIntentId: paymentIntent.id,
                organizationId,
                bookingOrganizationId: booking?.organizationId,
              });
              break;
            }
            await ctx.runMutation(internal.bookingDb.updateBookingStatus, {
              id: paymentIntent.metadata.bookingId as any,
              status: "payment_failed",
              source: "httpHandlers.stripeActions.webhook",
              reason: "payment_intent.payment_failed",
            });
          }
          break;
        }

        case "payment_intent.requires_action": {
          const paymentIntent = evt.data.object as Stripe.PaymentIntent;
          console.log(
            `[Stripe Webhook] Payment requires action: ${paymentIntent.id}`,
          );

          await ctx.runMutation(internal.bookingDb.updatePaymentIntentStatus, {
            organizationId,
            stripePaymentIntentId: paymentIntent.id,
            status: "requires_action",
          });

          if (paymentIntent.metadata?.bookingId) {
            const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
              id: paymentIntent.metadata.bookingId as any,
            });
            if (!booking || booking.organizationId !== organizationId) {
              console.warn("[Stripe Webhook] Ignoring cross-org payment_intent.requires_action", {
                paymentIntentId: paymentIntent.id,
                organizationId,
                bookingOrganizationId: booking?.organizationId,
              });
              break;
            }
            await ctx.runMutation(internal.bookingDb.updateBookingStatus, {
              id: paymentIntent.metadata.bookingId as any,
              status: "payment_failed",
              source: "httpHandlers.stripeActions.webhook",
              reason: "payment_intent.requires_action",
            });
          }
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
      await ctx.runMutation(internal.payments.markWebhookEventProcessed, {
        organizationId,
        eventId: evt.id,
      });
      await logAttempt({
        organizationId,
        stripeEventId: evt.id,
        eventType: evt.type,
        httpStatus: 200,
        failureStage: "success",
      });
    } catch (err) {
      console.error(`Error processing Stripe event ${evt.type}:`, err);
      await ctx.runMutation(internal.payments.markWebhookEventFailed, {
        organizationId,
        eventId: evt.id,
        errorMessage: err instanceof Error ? err.message : "unknown_error",
      });
      await logAttempt({
        organizationId,
        stripeEventId: evt.id,
        eventType: evt.type,
        httpStatus: 500,
        failureStage: "event_processing",
        failureCode: "PROCESSING_ERROR",
        failureMessage: err instanceof Error ? err.message : "unknown_error",
      });
      return { error: "Error processing webhook", status: 500 };
    }

    return { success: true, status: 200 };
  },
});
