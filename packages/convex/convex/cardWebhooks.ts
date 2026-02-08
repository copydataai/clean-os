import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover" as any,
  });
}

// ============ ACTIONS (call Stripe API) ============

export const createStripeCustomer = internalAction({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const stripe = getStripeClient();

    const resolved = await ctx.runAction(internal.stripeActions.resolveStripeCustomerForEmail, {
      clerkId: args.clerkId,
    });

    if (resolved?.stripeCustomerId) {
      return resolved.stripeCustomerId;
    }

    const idempotencyKey = `stripe_customer:${args.email}`;
    const customer = await stripe.customers.create(
      {
        email: args.email,
        name: args.name,
        metadata: {
          clerkId: args.clerkId,
        },
      },
      { idempotencyKey }
    );

    const saved = await ctx.runMutation(internal.cardDb.saveStripeCustomerIfAbsent, {
      clerkId: args.clerkId,
      stripeCustomerId: customer.id,
      email: args.email,
    });

    return saved?.stripeCustomerId ?? customer.id;
  },
});

export const createSetupIntent = internalAction({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args): Promise<{ clientSecret: string; setupIntentId: string }> => {
    const stripe = getStripeClient();
    const customerRecord = await ctx.runQuery(internal.cardDb.getCustomerByClerkId, {
      clerkId: args.clerkId,
    });;

    if (!customerRecord) {
      throw new Error("Customer not found. Create customer first.");
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerRecord.stripeCustomerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        clerkId: args.clerkId,
      },
    });

    await ctx.runMutation(internal.cardDb.saveSetupIntentToDb, {
      clerkId: args.clerkId,
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret ?? "",
      status: setupIntent.status,
      customerId: customerRecord.stripeCustomerId,
    });

    return {
      clientSecret: setupIntent.client_secret ?? "",
      setupIntentId: setupIntent.id,
    };
  },
});

export const attachPaymentMethod = internalAction({
  args: {
    clerkId: v.string(),
    paymentMethodId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const stripe = getStripeClient();
    const customerRecord = await ctx.runQuery(internal.cardDb.getCustomerByClerkId, {
      clerkId: args.clerkId,
    });;

    if (!customerRecord) {
      throw new Error("Customer not found");
    }

    const paymentMethod = await stripe.paymentMethods.attach(
      args.paymentMethodId,
      {
        customer: customerRecord.stripeCustomerId,
      }
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

    return paymentMethod.id;
  },
});

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
    });;

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

export const deletePaymentMethod = internalAction({
  args: { clerkId: v.string(), paymentMethodId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const stripe = getStripeClient();
    const pm = await ctx.runQuery(internal.cardDb.getPaymentMethodByStripeId, {
      stripePaymentMethodId: args.paymentMethodId,
    });

    if (pm) {
      await stripe.paymentMethods.detach(args.paymentMethodId);
      await ctx.runMutation(internal.cardDb.deletePaymentMethodFromDb, {
        id: pm._id,
      });
    }
  },
});
