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
  source: v.optional(v.string()), // "stripe" | "tally"
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
  bookingRequestId: v.optional(v.id("bookingRequests")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_email", ["email"])
  .index("by_checkout_session", ["stripeCheckoutSessionId"])
  .index("by_status", ["status"]);

const bookingRequests = defineTable({
  status: v.string(), // "requested" | "confirmed"
  requestResponseId: v.optional(v.string()),
  confirmationResponseId: v.optional(v.string()),
  requestFormId: v.optional(v.string()),
  confirmationFormId: v.optional(v.string()),
  quoteRequestId: v.optional(v.id("quoteRequests")),
  email: v.optional(v.string()),
  contactDetails: v.optional(v.string()),
  phoneNumber: v.optional(v.string()),
  accessMethod: v.optional(v.array(v.string())),
  accessInstructions: v.optional(v.string()),
  parkingInstructions: v.optional(v.string()),
  floorTypes: v.optional(v.array(v.string())),
  finishedBasement: v.optional(v.string()),
  delicateSurfaces: v.optional(v.string()),
  attentionAreas: v.optional(v.string()),
  pets: v.optional(v.array(v.string())),
  homeDuringCleanings: v.optional(v.string()),
  scheduleAdjustmentWindows: v.optional(v.array(v.string())),
  timingShiftOk: v.optional(v.string()),
  additionalNotes: v.optional(v.string()),
  rawRequestPayload: v.optional(v.any()),
  rawConfirmationPayload: v.optional(v.any()),
  bookingId: v.optional(v.id("bookings")),
  createdAt: v.number(),
  updatedAt: v.number(),
  confirmedAt: v.optional(v.number()),
})
  .index("by_email", ["email"])
  .index("by_status", ["status"])
  .index("by_request_response_id", ["requestResponseId"])
  .index("by_confirmation_response_id", ["confirmationResponseId"]);

const quoteRequests = defineTable({
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  service: v.optional(v.string()),
  serviceType: v.optional(v.string()),
  frequency: v.optional(v.string()),
  squareFootage: v.optional(v.number()),
  address: v.optional(v.string()),
  addressLine2: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  additionalNotes: v.optional(v.string()),
  utm_source: v.optional(v.string()),
  utm_campaign: v.optional(v.string()),
  gad_campaignid: v.optional(v.string()),
  gclid: v.optional(v.string()),
  status: v.optional(v.string()),
  tallyFormId: v.optional(v.string()),
  requestStatus: v.string(), // "requested" | "quoted" | "confirmed"
  bookingRequestId: v.optional(v.id("bookingRequests")),
  rawRequestPayload: v.optional(v.any()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_email", ["email"])

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
  bookingRequests,
  quoteRequests,
  paymentIntents,
});
