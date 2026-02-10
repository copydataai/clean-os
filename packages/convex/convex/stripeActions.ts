import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";
import { Id } from "./_generated/dataModel";

function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2025-12-15.clover" as any,
  });
}

async function getStripeClientForOrganization(
  ctx: any,
  organizationId: Id<"organizations">
): Promise<{ stripe: Stripe; orgSlug: string }> {
  const config = await ctx.runAction(internal.paymentsNode.getDecryptedStripeConfigForOrganization, {
    organizationId,
  });

  return {
    stripe: createStripeClient(config.secretKey),
    orgSlug: config.orgSlug,
  };
}

type StripeCustomerRecord = {
  _id: Id<"stripeCustomers">;
  stripeCustomerId: string;
  createdAt?: number;
  _creationTime?: number;
};

type CardSummary = {
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
};

function getRecordCreatedAt(record: StripeCustomerRecord): number {
  return record.createdAt ?? record._creationTime ?? 0;
}

function pickNewest(records: StripeCustomerRecord[]): StripeCustomerRecord {
  return records.reduce((latest, current) => {
    return getRecordCreatedAt(current) > getRecordCreatedAt(latest) ? current : latest;
  });
}

async function dedupeStripeCustomersForClerkIdInternal(
  ctx: any,
  stripe: Stripe,
  clerkId: string,
  organizationId: Id<"organizations">,
  records?: StripeCustomerRecord[]
): Promise<{ stripeCustomerId?: string; cleaned: boolean; skippedCleanup?: boolean }> {
  const customers =
    records ??
    (await ctx.runQuery(internal.cardDb.listStripeCustomersByClerkId, {
      clerkId,
      organizationId,
    }));

  if (!customers || customers.length === 0) {
    return { stripeCustomerId: undefined, cleaned: false };
  }

  if (customers.length === 1) {
    return { stripeCustomerId: customers[0].stripeCustomerId, cleaned: false };
  }

  type Candidate = {
    record: StripeCustomerRecord;
    hasCard: boolean;
    cardCreated: number;
  };

  const candidates: Candidate[] = [];

  try {
    for (const record of customers) {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: record.stripeCustomerId,
        type: "card",
        limit: 1,
      });
      const card = paymentMethods.data[0]?.card;
      const cardCreated = paymentMethods.data[0]?.created ?? 0;
      candidates.push({
        record,
        hasCard: Boolean(card),
        cardCreated,
      });
    }
  } catch (err) {
    console.error("[Stripe Dedupe] Failed to inspect payment methods", {
      clerkId,
      err,
    });
    const fallback = pickNewest(customers);
    return { stripeCustomerId: fallback.stripeCustomerId, cleaned: false, skippedCleanup: true };
  }

  const withCard = candidates.filter((candidate) => candidate.hasCard);
  const canonicalRecord =
    withCard.length > 0
      ? withCard.reduce((best, current) =>
          current.cardCreated > best.cardCreated ? current : best
        ).record
      : pickNewest(customers);

  const nonCanonical = customers.filter(
    (record: StripeCustomerRecord) => record.stripeCustomerId !== canonicalRecord.stripeCustomerId
  );

  if (nonCanonical.length === 0) {
    return { stripeCustomerId: canonicalRecord.stripeCustomerId, cleaned: false };
  }

  for (const record of nonCanonical) {
    await ctx.runMutation(internal.bookingDb.reassignStripeCustomerId, {
      fromStripeCustomerId: record.stripeCustomerId,
      toStripeCustomerId: canonicalRecord.stripeCustomerId,
    });

    await ctx.runMutation(internal.customers.reassignStripeCustomerId, {
      fromStripeCustomerId: record.stripeCustomerId,
      toStripeCustomerId: canonicalRecord.stripeCustomerId,
    });
  }

  await ctx.runMutation(internal.cardDb.deletePaymentMethodsByStripeCustomerIds, {
    stripeCustomerIds: nonCanonical.map((record: StripeCustomerRecord) => record.stripeCustomerId),
  });

  for (const record of nonCanonical) {
    await ctx.runMutation(internal.cardDb.deleteStripeCustomerById, {
      id: record._id,
    });
  }

  return { stripeCustomerId: canonicalRecord.stripeCustomerId, cleaned: true };
}

async function resolveStripeCustomerForClerkIdInternal(
  ctx: any,
  stripe: Stripe,
  clerkId: string,
  organizationId: Id<"organizations">
): Promise<{ stripeCustomerId?: string; cleaned?: boolean }> {
  const customers = await ctx.runQuery(internal.cardDb.listStripeCustomersByClerkId, {
    clerkId,
    organizationId,
  });

  if (!customers || customers.length === 0) {
    return { stripeCustomerId: undefined };
  }

  if (customers.length === 1) {
    return { stripeCustomerId: customers[0].stripeCustomerId };
  }

  return await dedupeStripeCustomersForClerkIdInternal(ctx, stripe, clerkId, organizationId, customers);
}

export const createCheckoutSession = action({
  args: {
    bookingId: v.id("bookings"),
    organizationId: v.optional(v.id("organizations")),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string }> => {
    const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
      id: args.bookingId,
    });

    if (!booking) {
      throw new Error("Booking not found");
    }
    if (!booking.organizationId && !args.organizationId) {
      throw new Error("ORG_NOT_FOUND");
    }
    if (booking.organizationId && args.organizationId && booking.organizationId !== args.organizationId) {
      throw new Error("ORG_MISMATCH");
    }

    const resolvedOrganizationId = booking.organizationId ?? args.organizationId!;
    if (!booking.organizationId) {
      await ctx.runMutation(internal.bookingDb.updateBookingOrganization, {
        id: booking._id,
        organizationId: resolvedOrganizationId,
      });
    }

    const { stripe, orgSlug } = await getStripeClientForOrganization(ctx, resolvedOrganizationId);

    let customerId: string | undefined;
    if (booking.stripeCustomerId) {
      customerId = booking.stripeCustomerId;
    } else {
      const resolved = await resolveStripeCustomerForClerkIdInternal(
        ctx,
        stripe,
        booking.email,
        resolvedOrganizationId
      );
      if (resolved.stripeCustomerId) {
        customerId = resolved.stripeCustomerId;
      } else {
        const idempotencyKey = `org:${resolvedOrganizationId}:stripe_customer:${booking.email}`;
        const customer = await stripe.customers.create(
          {
            email: booking.email,
            name: booking.customerName,
            metadata: {
              clerkId: booking.email,
              bookingId: args.bookingId,
              organizationId: resolvedOrganizationId,
              orgSlug,
            },
          },
          { idempotencyKey }
        );

        const saved = await ctx.runMutation(internal.cardDb.saveStripeCustomerIfAbsent, {
          organizationId: resolvedOrganizationId,
          clerkId: booking.email,
          stripeCustomerId: customer.id,
          email: booking.email,
        });

        customerId = saved?.stripeCustomerId ?? customer.id;
      }
    }

    // Create Checkout Session in setup mode (save card for later)
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      payment_method_types: ["card"],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      setup_intent_data: {
        metadata: {
          bookingId: args.bookingId,
          email: booking.email,
          organizationId: resolvedOrganizationId,
          orgSlug,
        },
      },
      metadata: {
        bookingId: args.bookingId,
        email: booking.email,
        organizationId: resolvedOrganizationId,
        orgSlug,
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

export const getCardOnFileStatus = action({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    hasCard: boolean;
    stripeCustomerId?: string;
    cardSummary?: CardSummary;
  }> => {
    const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
      id: args.bookingId,
    });

    if (!booking?.email || !booking.organizationId) {
      return { hasCard: false };
    }

    const { stripe } = await getStripeClientForOrganization(ctx, booking.organizationId);

    const resolved = await resolveStripeCustomerForClerkIdInternal(
      ctx,
      stripe,
      booking.email,
      booking.organizationId
    );
    if (!resolved.stripeCustomerId) {
      return { hasCard: false };
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: resolved.stripeCustomerId,
      type: "card",
      limit: 1,
    });

    if (paymentMethods.data.length === 0) {
      return { hasCard: false };
    }

    const card = paymentMethods.data[0].card;
    const cardSummary = card
      ? {
          brand: card.brand,
          last4: card.last4,
          expMonth: card.exp_month,
          expYear: card.exp_year,
        }
      : undefined;

    return {
      hasCard: true,
      stripeCustomerId: resolved.stripeCustomerId,
      cardSummary,
    };
  },
});

export const resolveStripeCustomerForEmail = internalAction({
  args: {
    clerkId: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<{ stripeCustomerId?: string; cleaned?: boolean }> => {
    const { stripe } = await getStripeClientForOrganization(ctx, args.organizationId);
    return await resolveStripeCustomerForClerkIdInternal(
      ctx,
      stripe,
      args.clerkId,
      args.organizationId
    );
  },
});

export const dedupeStripeCustomersForClerkId = internalAction({
  args: {
    clerkId: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ stripeCustomerId?: string; cleaned: boolean; skippedCleanup?: boolean }> => {
    const { stripe } = await getStripeClientForOrganization(ctx, args.organizationId);
    return await dedupeStripeCustomersForClerkIdInternal(
      ctx,
      stripe,
      args.clerkId,
      args.organizationId
    );
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
    const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
      id: args.bookingId,
    });

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    if (!booking.stripeCustomerId) {
      return { success: false, error: "No Stripe customer linked to booking" };
    }
    if (!booking.organizationId) {
      return { success: false, error: "ORG_NOT_FOUND" };
    }

    const { stripe, orgSlug } = await getStripeClientForOrganization(ctx, booking.organizationId);

    if (!["completed", "payment_failed"].includes(booking.status)) {
      return {
        success: false,
        error: `Booking must be completed before charging (current: ${booking.status})`,
      };
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
          organizationId: booking.organizationId,
          orgSlug,
        },
      });

      // Save payment intent to database
      await ctx.runMutation(internal.bookingDb.createPaymentIntent, {
        organizationId: booking.organizationId,
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
          source: "stripeActions.chargeBooking",
          reason: "payment_intent_succeeded",
        });
        return { success: true, paymentIntentId: paymentIntent.id };
      }

      if (paymentIntent.status === "requires_action") {
        // 3DS authentication required - generate payment link
        const paymentLink = await createPaymentLinkForIntent(
          ctx,
          stripe,
          paymentIntent.id,
          booking.organizationId,
          orgSlug
        );
        
        await ctx.runMutation(internal.bookingDb.updatePaymentIntentStatus, {
          organizationId: booking.organizationId,
          stripePaymentIntentId: paymentIntent.id,
          status: "requires_action",
          paymentLinkUrl: paymentLink,
          errorMessage: paymentLink ? undefined : "Publishable key missing for 3DS recovery",
        });

        await ctx.runMutation(internal.bookingDb.updateBookingStatus, {
          id: args.bookingId,
          status: "payment_failed",
          source: "stripeActions.chargeBooking",
          reason: "payment_intent_requires_action",
        });

        if (!paymentLink) {
          return {
            success: false,
            paymentIntentId: paymentIntent.id,
            error: "AUTHENTICATION_REQUIRED_MANUAL_RETRY",
          };
        }

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
          const paymentLink = await createPaymentLinkForIntent(
            ctx,
            stripe,
            paymentIntentId,
            booking.organizationId,
            orgSlug
          );
          
          await ctx.runMutation(internal.bookingDb.createPaymentIntent, {
            organizationId: booking.organizationId,
            bookingId: args.bookingId,
            stripePaymentIntentId: paymentIntentId,
            stripeCustomerId: booking.stripeCustomerId,
            amount: args.amount,
            currency: "usd",
            status: "requires_action",
            paymentMethodId: paymentMethodId,
          });

          await ctx.runMutation(internal.bookingDb.updatePaymentIntentStatus, {
            organizationId: booking.organizationId,
            stripePaymentIntentId: paymentIntentId,
            status: "requires_action",
            paymentLinkUrl: paymentLink,
            errorMessage: paymentLink ? undefined : "Publishable key missing for 3DS recovery",
          });

          await ctx.runMutation(internal.bookingDb.updateBookingStatus, {
            id: args.bookingId,
            status: "payment_failed",
            source: "stripeActions.chargeBooking",
            reason: "authentication_required",
          });

          if (!paymentLink) {
            return {
              success: false,
              paymentIntentId: paymentIntentId,
              error: "AUTHENTICATION_REQUIRED_MANUAL_RETRY",
            };
          }

          return {
            success: false,
            paymentIntentId: paymentIntentId,
            requiresAction: true,
            paymentLinkUrl: paymentLink,
          };
        }

        await ctx.runMutation(internal.bookingDb.updateBookingStatus, {
          id: args.bookingId,
          status: "payment_failed",
          source: "stripeActions.chargeBooking",
          reason: "stripe_card_error",
          metadata: {
            errorCode: err.code,
            errorType: err.type,
          },
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
  ctx: any,
  stripe: Stripe,
  paymentIntentId: string,
  organizationId: Id<"organizations">,
  orgSlug?: string
): Promise<string | undefined> {
  // Retrieve the payment intent to get the client secret
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const organizationConfig = await ctx.runQuery(
    internal.payments.getOrganizationStripeConfigByOrganizationId,
    {
      organizationId,
    }
  );

  if (!organizationConfig?.publishableKey) {
    return undefined;
  }
  
  // For 3DS, we need to create a hosted payment page
  // Using Stripe's hosted invoice page as a workaround
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  
  // Create a URL that directs customer to complete payment
  // This points to our custom payment completion page
  const orgParam = orgSlug ? `&org=${encodeURIComponent(orgSlug)}` : "";
  return `${baseUrl}/complete-payment?payment_intent=${paymentIntentId}&payment_intent_client_secret=${paymentIntent.client_secret}${orgParam}`;
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
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<void> => {
    const { stripe } = await getStripeClientForOrganization(ctx, args.organizationId);

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
    
    if (!setupIntent || !setupIntent.payment_method || !session.customer) {
      console.error("No payment method from setup intent");
      return;
    }

    await ctx.runAction(internal.stripeActions.applyCardSetupResult, {
      organizationId: args.organizationId,
      bookingId,
      setupIntentId: setupIntent.id,
      stripeCustomerId: session.customer as string,
      stripePaymentMethodId: setupIntent.payment_method as string,
    });

    const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
      id: bookingId,
    });

    if (!booking) {
      console.error("Booking not found:", bookingId);
      return;
    }

    console.log(`Checkout completed for booking ${bookingId}, card saved`);
  },
});

export const applyCardSetupResult = internalAction({
  args: {
    organizationId: v.id("organizations"),
    bookingId: v.id("bookings"),
    setupIntentId: v.string(),
    stripeCustomerId: v.string(),
    stripePaymentMethodId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
      id: args.bookingId,
    });

    if (!booking) {
      throw new Error("BOOKING_NOT_FOUND");
    }
    if (booking.organizationId !== args.organizationId) {
      throw new Error("ORG_MISMATCH");
    }

    const { stripe } = await getStripeClientForOrganization(ctx, args.organizationId);
    const paymentMethod = await stripe.paymentMethods.retrieve(args.stripePaymentMethodId);

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
      organizationId: booking.organizationId,
      clerkId: booking.email,
      stripePaymentMethodId: paymentMethod.id,
      stripeCustomerId: args.stripeCustomerId,
      type: paymentMethod.type,
      source: "stripe",
      card: cardDetails,
    });

    await ctx.runMutation(internal.cardDb.updateSetupIntentStatus, {
      setupIntentId: args.setupIntentId,
      status: "succeeded",
      failureCode: undefined,
      failureMessage: undefined,
      lastStripeStatus: "succeeded",
    });

    await ctx.runMutation(internal.bookingDb.updateBookingStatus, {
      id: args.bookingId,
      status: "card_saved",
      source: "stripeActions.applyCardSetupResult",
      reason: "setup_intent_succeeded",
    });

    await ctx.runMutation(internal.bookingStateMachine.recomputeScheduledState, {
      bookingId: args.bookingId,
      source: "stripeActions.applyCardSetupResult",
    });
  },
});
