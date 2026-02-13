"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const sendQuoteReceivedEmail = internalAction({
  args: {
    to: v.string(),
    idempotencyKey: v.string(),
    firstName: v.optional(v.string()),
    service: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    frequency: v.optional(v.string()),
    squareFootage: v.optional(v.number()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    brand: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.emailSender.sendTransactional, {
      to: args.to,
      subject: "We received your quote request",
      template: "quote-received",
      idempotencyKey: args.idempotencyKey,
      templateProps: {
        firstName: args.firstName,
        service: args.service,
        serviceType: args.serviceType,
        frequency: args.frequency,
        squareFootage: args.squareFootage,
        address: args.address,
        city: args.city,
        state: args.state,
        brand: args.brand,
      },
    });
  },
});

export const sendConfirmationLinkEmail = internalAction({
  args: {
    to: v.string(),
    idempotencyKey: v.string(),
    firstName: v.optional(v.string()),
    service: v.optional(v.string()),
    frequency: v.optional(v.string()),
    confirmUrl: v.string(),
    brand: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runAction(internal.emailSender.sendTransactional, {
      to: args.to,
      subject: "Your quote is approved — confirm your booking",
      template: "confirmation-link",
      idempotencyKey: args.idempotencyKey,
      templateProps: {
        firstName: args.firstName,
        service: args.service,
        frequency: args.frequency,
        confirmUrl: args.confirmUrl,
        brand: args.brand,
      },
    });
  },
});

export const sendBookingConfirmedEmail = internalAction({
  args: {
    to: v.string(),
    idempotencyKey: v.string(),
    firstName: v.optional(v.string()),
    service: v.optional(v.string()),
    frequency: v.optional(v.string()),
    address: v.optional(v.string()),
    accessMethod: v.optional(v.array(v.string())),
    pets: v.optional(v.array(v.string())),
    bookingLink: v.string(),
    brand: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runAction(internal.emailSender.sendTransactional, {
      to: args.to,
      subject: "Booking confirmed — save your payment method",
      template: "booking-confirmed",
      idempotencyKey: args.idempotencyKey,
      templateProps: {
        firstName: args.firstName,
        service: args.service,
        frequency: args.frequency,
        address: args.address,
        accessMethod: args.accessMethod,
        pets: args.pets,
        bookingLink: args.bookingLink,
        brand: args.brand,
      },
    });
  },
});

export const sendPaymentSavedEmail = internalAction({
  args: {
    to: v.string(),
    idempotencyKey: v.string(),
    firstName: v.optional(v.string()),
    service: v.optional(v.string()),
    cardBrand: v.optional(v.string()),
    cardLast4: v.optional(v.string()),
    bookingRef: v.optional(v.string()),
    brand: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.emailSender.sendTransactional, {
      to: args.to,
      subject: "You're all set — payment method saved",
      template: "payment-saved",
      idempotencyKey: args.idempotencyKey,
      templateProps: {
        firstName: args.firstName,
        service: args.service,
        cardBrand: args.cardBrand,
        cardLast4: args.cardLast4,
        bookingRef: args.bookingRef,
        brand: args.brand,
      },
    });
  },
});

export const sendQuoteReadyEmail = internalAction({
  args: {
    to: v.string(),
    idempotencyKey: v.string(),
    firstName: v.optional(v.string()),
    quoteNumber: v.number(),
    totalCents: v.number(),
    currency: v.optional(v.string()),
    validUntilTimestamp: v.number(),
    confirmUrl: v.string(),
    downloadUrl: v.optional(v.string()),
    serviceLabel: v.optional(v.string()),
    brand: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<any> => {
    const brandName = args.brand?.displayName || "JoluAI";
    return await ctx.runAction(internal.emailSender.sendTransactional, {
      to: args.to,
      subject: `Your ${brandName} Quote`,
      template: "quote-ready",
      idempotencyKey: args.idempotencyKey,
      templateProps: {
        firstName: args.firstName,
        quoteNumber: args.quoteNumber,
        totalCents: args.totalCents,
        currency: args.currency,
        validUntilTimestamp: args.validUntilTimestamp,
        confirmUrl: args.confirmUrl,
        downloadUrl: args.downloadUrl,
        serviceLabel: args.serviceLabel,
        brand: args.brand,
      },
    });
  },
});

export const sendQuoteReminderEmail = internalAction({
  args: {
    to: v.string(),
    idempotencyKey: v.string(),
    firstName: v.optional(v.string()),
    quoteNumber: v.number(),
    totalCents: v.number(),
    currency: v.optional(v.string()),
    validUntilTimestamp: v.number(),
    confirmUrl: v.string(),
    downloadUrl: v.optional(v.string()),
    serviceLabel: v.optional(v.string()),
    reminderStage: v.union(
      v.literal("r1_24h"),
      v.literal("r2_72h"),
      v.literal("r3_pre_expiry"),
      v.literal("manual")
    ),
    brand: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<any> => {
    const brandName = args.brand?.displayName || "JoluAI";
    const subject =
      args.reminderStage === "r3_pre_expiry"
        ? `Final Reminder: Your ${brandName} Quote Expires Soon`
        : args.reminderStage === "r2_72h"
          ? `Reminder: Please Confirm Your ${brandName} Quote`
          : args.reminderStage === "manual"
            ? `Reminder: Please Confirm Your ${brandName} Quote`
          : `Reminder: Your ${brandName} Quote Is Ready`;

    return await ctx.runAction(internal.emailSender.sendTransactional, {
      to: args.to,
      subject,
      template: "quote-reminder",
      idempotencyKey: args.idempotencyKey,
      templateProps: {
        firstName: args.firstName,
        quoteNumber: args.quoteNumber,
        totalCents: args.totalCents,
        currency: args.currency,
        validUntilTimestamp: args.validUntilTimestamp,
        confirmUrl: args.confirmUrl,
        downloadUrl: args.downloadUrl,
        serviceLabel: args.serviceLabel,
        reminderStage: args.reminderStage,
        brand: args.brand,
      },
    });
  },
});
