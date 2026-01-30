import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const users = defineTable({
  clerkId: v.string(),
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
})
  .index("by_clerk_id", ["clerkId"]);

const organizations = defineTable({
  clerkId: v.string(),
  name: v.string(),
  slug: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
})
  .index("by_clerk_id", ["clerkId"]);

const organizationMemberships = defineTable({
  clerkId: v.string(), // membership ID from Clerk
  userId: v.id("users"),
  organizationId: v.id("organizations"),
  role: v.string(), // "admin", "member", etc.
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_user", ["userId"])
  .index("by_organization", ["organizationId"])
  .index("by_user_and_org", ["userId", "organizationId"]);

const stripeCustomers = defineTable({
  clerkId: v.string(),
  stripeCustomerId: v.string(),
  email: v.string(),
  createdAt: v.number(),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_stripe_id", ["stripeCustomerId"]);

const setupIntents = defineTable({
  clerkId: v.string(),
  setupIntentId: v.string(),
  clientSecret: v.string(),
  status: v.string(),
  customerId: v.string(),
  createdAt: v.number(),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_setup_intent_id", ["setupIntentId"]);

const paymentMethods = defineTable({
  clerkId: v.string(),
  stripePaymentMethodId: v.string(),
  stripeCustomerId: v.string(),
  type: v.string(),
  card: v.optional(
    v.object({
      brand: v.string(),
      last4: v.string(),
      expMonth: v.number(),
      expYear: v.number(),
    })
  ),
  createdAt: v.number(),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_stripe_id", ["stripePaymentMethodId"]);

const bookings = defineTable({
  email: v.string(),
  customerName: v.optional(v.string()),
  stripeCustomerId: v.optional(v.string()),
  stripeCheckoutSessionId: v.optional(v.string()),
  status: v.string(), // "pending_card", "card_saved", "scheduled", "completed", "charged", "failed"
  serviceType: v.optional(v.string()),
  serviceDate: v.optional(v.string()),
  amount: v.optional(v.number()), // Amount in cents
  notes: v.optional(v.string()),
  tallyResponseId: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_email", ["email"])
  .index("by_checkout_session", ["stripeCheckoutSessionId"])
  .index("by_status", ["status"]);

const paymentIntents = defineTable({
  bookingId: v.id("bookings"),
  stripePaymentIntentId: v.string(),
  stripeCustomerId: v.string(),
  amount: v.number(), // Amount in cents
  currency: v.string(),
  status: v.string(), // "requires_payment_method", "requires_confirmation", "requires_action", "processing", "succeeded", "canceled"
  paymentMethodId: v.optional(v.string()),
  paymentLinkUrl: v.optional(v.string()), // For 3DS authentication
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_booking", ["bookingId"])
  .index("by_stripe_id", ["stripePaymentIntentId"])
  .index("by_status", ["status"]);

export default defineSchema({
  users,
  organizations,
  organizationMemberships,
  stripeCustomers,
  setupIntents,
  paymentMethods,
  bookings,
  paymentIntents,
});