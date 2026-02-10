import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover" as any,
  });
}

export const saveCardFromSetupIntent = internalAction({
  args: {
    setupIntentId: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const stripe = getStripeClient();
    const setupIntent = await stripe.setupIntents.retrieve(args.setupIntentId);

    if (setupIntent.status !== "succeeded") {
      throw new Error(`SetupIntent status: ${setupIntent.status}`);
    }

    if (!setupIntent.payment_method) {
      throw new Error("No payment method attached to SetupIntent");
    }

    const customerRecord = await ctx.runQuery(internal.cardDb.getCustomerByClerkId, {
      clerkId: args.clerkId,
    });

    if (!customerRecord) {
      throw new Error("Customer not found");
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(
      setupIntent.payment_method as string
    );

    const cardDetails = paymentMethod.card
      ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
          fingerprint: paymentMethod.card.fingerprint ?? undefined,
        }
      : undefined;

    await ctx.runMutation(internal.cardDb.savePaymentMethodToDb, {
      clerkId: args.clerkId,
      stripePaymentMethodId: paymentMethod.id,
      stripeCustomerId: customerRecord.stripeCustomerId,
      type: paymentMethod.type,
      source: "stripe",
      card: cardDetails,
    });

    await ctx.runMutation(internal.cardDb.updateSetupIntentStatus, {
      setupIntentId: args.setupIntentId,
      status: "succeeded",
    });

    return paymentMethod.id;
  },
});
