import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";
import { Id } from "./_generated/dataModel";

function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover" as any,
  });
}

export const createCheckoutSession = action({
  args: {
    bookingId: v.id("bookings"),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string }> => {
    const stripe = getStripeClient();

    const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
      id: args.bookingId,
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Check if customer already exists
    let customerId: string | undefined;
    const existingCustomer = await ctx.runQuery(internal.cardDb.getCustomerByClerkId, {
      clerkId: booking.email,
    });

    if (existingCustomer) {
      customerId = existingCustomer.stripeCustomerId;
    } else {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: booking.email,
        name: booking.customerName,
        metadata: {
          clerkId: booking.email,
          bookingId: args.bookingId,
        },
      });
      customerId = customer.id;

      await ctx.runMutation(internal.cardDb.saveStripeCustomerToDb, {
        clerkId: booking.email,
        stripeCustomerId: customer.id,
        email: booking.email,
      });
    }

    // Create Checkout Session in setup mode (save card for later)
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      payment_method_types: ["card"],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: {
        bookingId: args.bookingId,
        email: booking.email,
      },
    });

    // Update booking with checkout session ID
    await ctx.runMutation(internal.bookingDb.updateBookingCheckoutSession, {
      id: args.bookingId,
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: customerId,
    });

    return { checkoutUrl: session.url! };
  },
});

export const chargeBooking = internalAction({
  args: {
    bookingId: v.id("bookings"),
    amount: v.number(), // Amount in cents
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    paymentIntentId?: string;
    requiresAction?: boolean;
    paymentLinkUrl?: string;
    error?: string;
  }> => {
    const stripe = getStripeClient();

    const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
      id: args.bookingId,
    });

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    if (!booking.stripeCustomerId) {
      return { success: false, error: "No Stripe customer linked to booking" };
    }

    // Get the customer's default payment method
    const paymentMethods = await stripe.paymentMethods.list({
      customer: booking.stripeCustomerId,
      type: "card",
      limit: 1,
    });

    if (paymentMethods.data.length === 0) {
      return { success: false, error: "No payment method on file" };
    }

    const paymentMethodId = paymentMethods.data[0].id;

    try {
      // Create PaymentIntent with the saved payment method
      const paymentIntent = await stripe.paymentIntents.create({
        amount: args.amount,
        currency: "usd",
        customer: booking.stripeCustomerId,
        payment_method: paymentMethodId,
        off_session: true, // Indicates customer is not present
        confirm: true, // Immediately attempt to confirm
        description: args.description ?? `Cleaning service for booking ${args.bookingId}`,
        metadata: {
          bookingId: args.bookingId,
          email: booking.email,
        },
      });

      // Save payment intent to database
      await ctx.runMutation(internal.bookingDb.createPaymentIntent, {
        bookingId: args.bookingId,
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: booking.stripeCustomerId,
        amount: args.amount,
        currency: "usd",
        status: paymentIntent.status,
        paymentMethodId: paymentMethodId,
      });

      if (paymentIntent.status === "succeeded") {
        await ctx.runMutation(internal.bookingDb.updateBookingStatus, {
          id: args.bookingId,
          status: "charged",
        });
        return { success: true, paymentIntentId: paymentIntent.id };
      }

      if (paymentIntent.status === "requires_action") {
        // 3DS authentication required - generate payment link
        const paymentLink = await createPaymentLinkForIntent(stripe, paymentIntent.id, booking.email);
        
        await ctx.runMutation(internal.bookingDb.updatePaymentIntentStatus, {
          stripePaymentIntentId: paymentIntent.id,
          status: "requires_action",
          paymentLinkUrl: paymentLink,
        });

        return {
          success: false,
          paymentIntentId: paymentIntent.id,
          requiresAction: true,
          paymentLinkUrl: paymentLink,
        };
      }

      return {
        success: false,
        paymentIntentId: paymentIntent.id,
        error: `Unexpected payment status: ${paymentIntent.status}`,
      };
    } catch (err: any) {
      // Handle card errors (e.g., card declined, insufficient funds)
      if (err.type === "StripeCardError") {
        // Attempt to recover by requesting customer authentication
        const paymentIntentId = err.raw?.payment_intent?.id;
        
        if (paymentIntentId && err.code === "authentication_required") {
          const paymentLink = await createPaymentLinkForIntent(stripe, paymentIntentId, booking.email);
          
          await ctx.runMutation(internal.bookingDb.createPaymentIntent, {
            bookingId: args.bookingId,
            stripePaymentIntentId: paymentIntentId,
            stripeCustomerId: booking.stripeCustomerId,
            amount: args.amount,
            currency: "usd",
            status: "requires_action",
            paymentMethodId: paymentMethodId,
          });

          await ctx.runMutation(internal.bookingDb.updatePaymentIntentStatus, {
            stripePaymentIntentId: paymentIntentId,
            status: "requires_action",
            paymentLinkUrl: paymentLink,
          });

          return {
            success: false,
            paymentIntentId: paymentIntentId,
            requiresAction: true,
            paymentLinkUrl: paymentLink,
          };
        }

        await ctx.runMutation(internal.bookingDb.updateBookingStatus, {
          id: args.bookingId,
          status: "failed",
        });

        return {
          success: false,
          error: err.message,
        };
      }

      throw err;
    }
  },
});

async function createPaymentLinkForIntent(
  stripe: Stripe,
  paymentIntentId: string,
  email: string
): Promise<string> {
  // Retrieve the payment intent to get the client secret
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  
  // For 3DS, we need to create a hosted payment page
  // Using Stripe's hosted invoice page as a workaround
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  
  // Create a URL that directs customer to complete payment
  // This points to our custom payment completion page
  return `${baseUrl}/complete-payment?payment_intent=${paymentIntentId}&payment_intent_client_secret=${paymentIntent.client_secret}`;
}

export const getBookingPaymentStatus = internalAction({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args): Promise<{
    booking: any;
    paymentIntents: any[];
  } | null> => {
    const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
      id: args.bookingId,
    });

    if (!booking) {
      return null;
    }

    const paymentIntents = await ctx.runQuery(internal.bookingDb.getPaymentIntentsByBooking, {
      bookingId: args.bookingId,
    });

    return {
      booking,
      paymentIntents,
    };
  },
});

export const handleCheckoutCompleted = internalAction({
  args: {
    checkoutSessionId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const stripe = getStripeClient();

    // Retrieve the checkout session with setup intent expanded
    const session = await stripe.checkout.sessions.retrieve(args.checkoutSessionId, {
      expand: ["setup_intent"],
    });

    const bookingId = session.metadata?.bookingId as Id<"bookings"> | undefined;
    
    if (!bookingId) {
      console.error("No bookingId in checkout session metadata");
      return;
    }

    const setupIntent = session.setup_intent as Stripe.SetupIntent;
    
    if (!setupIntent || !setupIntent.payment_method) {
      console.error("No payment method from setup intent");
      return;
    }

    // Save the payment method
    const paymentMethod = await stripe.paymentMethods.retrieve(
      setupIntent.payment_method as string
    );

    const cardDetails = paymentMethod.card
      ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
        }
      : undefined;

    // Get booking to find email/clerkId
    const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
      id: bookingId,
    });

    if (!booking) {
      console.error("Booking not found:", bookingId);
      return;
    }

    await ctx.runMutation(internal.cardDb.savePaymentMethodToDb, {
      clerkId: booking.email,
      stripePaymentMethodId: paymentMethod.id,
      stripeCustomerId: session.customer as string,
      type: paymentMethod.type,
      card: cardDetails,
    });

    // Update booking status
    await ctx.runMutation(internal.bookingDb.updateBookingStatus, {
      id: bookingId,
      status: "card_saved",
    });

    console.log(`Checkout completed for booking ${bookingId}, card saved`);
  },
});
