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
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.emailSender.sendTransactional, {
      to: args.to,
      subject: "Your quote is approved — confirm your booking",
      template: "confirmation-link",
      idempotencyKey: args.idempotencyKey,
      templateProps: {
        firstName: args.firstName,
        service: args.service,
        frequency: args.frequency,
        confirmUrl: args.confirmUrl,
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
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.emailSender.sendTransactional, {
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
      },
    });
  },
});
