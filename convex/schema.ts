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
  customerId: v.optional(v.id("customers")),
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
  .index("by_status", ["status"])
  .index("by_customer", ["customerId"]);

const bookingRequests = defineTable({
  status: v.string(), // "requested" | "confirmed"
  requestResponseId: v.optional(v.string()),
  confirmationResponseId: v.optional(v.string()),
  requestFormId: v.optional(v.string()),
  confirmationFormId: v.optional(v.string()),
  quoteRequestId: v.optional(v.id("quoteRequests")),
  customerId: v.optional(v.id("customers")),
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
  linkSentAt: v.optional(v.number()),
  confirmLinkSentAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  confirmedAt: v.optional(v.number()),
})
  .index("by_email", ["email"])
  .index("by_status", ["status"])
  .index("by_request_response_id", ["requestResponseId"])
  .index("by_confirmation_response_id", ["confirmationResponseId"])
  .index("by_customer", ["customerId"]);

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
  customerId: v.optional(v.id("customers")),
  bookingRequestId: v.optional(v.id("bookingRequests")),
  rawRequestPayload: v.optional(v.any()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_email", ["email"])
  .index("by_customer", ["customerId"])

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

// ============================================================================
// Customer Management
// ============================================================================

const customers = defineTable({
  // Identity
  organizationId: v.optional(v.id("organizations")),

  // Basic Info
  firstName: v.string(),
  lastName: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  alternatePhone: v.optional(v.string()),

  // Address
  address: v.optional(
    v.object({
      street: v.optional(v.string()),
      addressLine2: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      postalCode: v.optional(v.string()),
    })
  ),

  // Property
  squareFootage: v.optional(v.number()),

  // Payment
  stripeCustomerId: v.optional(v.string()),

  // Status
  status: v.string(), // "lead" | "active" | "inactive" | "churned"
  source: v.optional(v.string()), // "quote_request" | "booking" | "manual"

  // Notes
  notes: v.optional(v.string()),
  internalNotes: v.optional(v.string()),

  // Denormalized Stats
  totalBookings: v.optional(v.number()),
  totalSpent: v.optional(v.number()),
  lastBookingDate: v.optional(v.number()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_email", ["email"])
  .index("by_organization", ["organizationId"])
  .index("by_status", ["status"])
  .index("by_stripe_id", ["stripeCustomerId"]);

// ============================================================================
// Cleaner/Worker Management Tables
// ============================================================================

const cleaners = defineTable({
  // Identity
  clerkId: v.optional(v.string()),
  organizationId: v.optional(v.id("organizations")),

  // Basic Info
  firstName: v.string(),
  lastName: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  alternatePhone: v.optional(v.string()),
  profileImageUrl: v.optional(v.string()),
  bio: v.optional(v.string()),

  // Contact Preferences
  contactPreferences: v.optional(
    v.object({
      email: v.boolean(),
      sms: v.boolean(),
      push: v.boolean(),
      preferredMethod: v.optional(v.string()),
    })
  ),

  // Address (for dispatching)
  address: v.optional(
    v.object({
      street: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
    })
  ),

  // Languages
  languages: v.optional(v.array(v.string())),

  // Employment
  status: v.string(), // applicant|onboarding|active|inactive|terminated
  employmentType: v.string(), // w2|1099
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  probationEndDate: v.optional(v.string()),
  terminationReason: v.optional(v.string()),

  // Background Check
  backgroundCheckStatus: v.optional(v.string()),
  backgroundCheckDate: v.optional(v.number()),
  backgroundCheckExpiresAt: v.optional(v.number()),
  backgroundCheckProvider: v.optional(v.string()),
  backgroundCheckReferenceId: v.optional(v.string()),

  // Work Preferences
  maxHoursPerDay: v.optional(v.number()),
  maxHoursPerWeek: v.optional(v.number()),
  preferredZones: v.optional(v.array(v.string())),
  willingToTravel: v.optional(v.boolean()),
  maxTravelDistanceMiles: v.optional(v.number()),
  hasOwnTransportation: v.optional(v.boolean()),
  hasOwnEquipment: v.optional(v.boolean()),

  // Performance (denormalized)
  totalJobsCompleted: v.optional(v.number()),
  averageRating: v.optional(v.number()),
  totalRatingsCount: v.optional(v.number()),
  reliabilityScore: v.optional(v.number()),

  // Internal
  internalNotes: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_organization", ["organizationId"])
  .index("by_email", ["email"])
  .index("by_status", ["status"])
  .index("by_employment_type", ["employmentType"])
  .index("by_status_and_org", ["status", "organizationId"]);

const cleanerPayRates = defineTable({
  cleanerId: v.id("cleaners"),
  payType: v.string(), // hourly|per_job|commission|salary
  baseRate: v.number(), // cents or percentage
  currency: v.optional(v.string()),
  overtimeRate: v.optional(v.number()),
  weekendRate: v.optional(v.number()),
  holidayRate: v.optional(v.number()),
  serviceType: v.optional(v.string()),
  bonusEligible: v.optional(v.boolean()),
  referralBonusAmount: v.optional(v.number()),
  performanceBonusPercentage: v.optional(v.number()),
  effectiveFrom: v.number(),
  effectiveUntil: v.optional(v.number()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_cleaner", ["cleanerId"])
  .index("by_cleaner_active", ["cleanerId", "isActive"])
  .index("by_cleaner_service", ["cleanerId", "serviceType"]);

const cleanerSkills = defineTable({
  cleanerId: v.id("cleaners"),
  skillType: v.string(), // deep_cleaning|window|carpet|hardwood|appliances|organizing|laundry|pet_safe
  proficiencyLevel: v.string(), // beginner|intermediate|advanced|expert
  isVerified: v.optional(v.boolean()),
  verifiedBy: v.optional(v.id("users")),
  verifiedAt: v.optional(v.number()),
  trainingCompletedAt: v.optional(v.number()),
  lastAssessedAt: v.optional(v.number()),
  notes: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_cleaner", ["cleanerId"])
  .index("by_skill_type", ["skillType"])
  .index("by_cleaner_skill", ["cleanerId", "skillType"]);

const cleanerCertifications = defineTable({
  cleanerId: v.id("cleaners"),
  certificationType: v.string(), // osha_safety|hazmat|green_cleaning|first_aid|cpr|insured|bonded
  certificationName: v.string(),
  issuingOrganization: v.optional(v.string()),
  certificateNumber: v.optional(v.string()),
  issuedAt: v.number(),
  expiresAt: v.optional(v.number()),
  status: v.string(), // active|expired|revoked|pending_renewal
  documentUrl: v.optional(v.string()),
  isVerified: v.optional(v.boolean()),
  verifiedBy: v.optional(v.id("users")),
  verifiedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_cleaner", ["cleanerId"])
  .index("by_certification_type", ["certificationType"])
  .index("by_status", ["status"])
  .index("by_expiration", ["expiresAt"]);

const cleanerServiceTypes = defineTable({
  cleanerId: v.id("cleaners"),
  serviceType: v.string(), // standard|deep|move_in|move_out|post_construction|airbnb
  isQualified: v.boolean(),
  qualifiedAt: v.optional(v.number()),
  qualifiedBy: v.optional(v.id("users")),
  isPreferred: v.optional(v.boolean()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_cleaner", ["cleanerId"])
  .index("by_service_type", ["serviceType"])
  .index("by_cleaner_service", ["cleanerId", "serviceType"]);

const cleanerEquipment = defineTable({
  cleanerId: v.id("cleaners"),
  equipmentType: v.string(), // vacuum_commercial|carpet_cleaner|pressure_washer|floor_buffer|steam_cleaner
  equipmentName: v.optional(v.string()),
  ownsEquipment: v.optional(v.boolean()),
  canOperate: v.boolean(),
  trainedAt: v.optional(v.number()),
  trainedBy: v.optional(v.id("users")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_cleaner", ["cleanerId"])
  .index("by_equipment_type", ["equipmentType"]);

const cleanerAvailability = defineTable({
  cleanerId: v.id("cleaners"),
  dayOfWeek: v.number(), // 0=Sunday...6=Saturday
  startTime: v.string(), // "08:00"
  endTime: v.string(), // "17:00"
  timezone: v.optional(v.string()),
  effectiveFrom: v.optional(v.number()),
  effectiveUntil: v.optional(v.number()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_cleaner", ["cleanerId"])
  .index("by_cleaner_day", ["cleanerId", "dayOfWeek"])
  .index("by_cleaner_active", ["cleanerId", "isActive"]);

const cleanerTimeOff = defineTable({
  cleanerId: v.id("cleaners"),
  startDate: v.string(), // ISO date
  endDate: v.string(),
  startTime: v.optional(v.string()),
  endTime: v.optional(v.string()),
  isAllDay: v.boolean(),
  timeOffType: v.string(), // vacation|sick|personal|training|blocked|other
  status: v.string(), // pending|approved|denied|cancelled
  requestedAt: v.number(),
  approvedBy: v.optional(v.id("users")),
  approvedAt: v.optional(v.number()),
  denialReason: v.optional(v.string()),
  reason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_cleaner", ["cleanerId"])
  .index("by_cleaner_dates", ["cleanerId", "startDate", "endDate"])
  .index("by_status", ["status"])
  .index("by_cleaner_status", ["cleanerId", "status"]);

const crews = defineTable({
  organizationId: v.optional(v.id("organizations")),
  name: v.string(),
  description: v.optional(v.string()),
  status: v.string(), // active|inactive|disbanded
  leadCleanerId: v.optional(v.id("cleaners")),
  maxMembers: v.optional(v.number()),
  specializedServiceTypes: v.optional(v.array(v.string())),
  preferredZones: v.optional(v.array(v.string())),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_lead", ["leadCleanerId"])
  .index("by_status", ["status"]);

const crewMembers = defineTable({
  crewId: v.id("crews"),
  cleanerId: v.id("cleaners"),
  role: v.string(), // lead|member|trainee
  joinedAt: v.number(),
  leftAt: v.optional(v.number()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_crew", ["crewId"])
  .index("by_cleaner", ["cleanerId"])
  .index("by_crew_active", ["crewId", "isActive"])
  .index("by_crew_cleaner", ["crewId", "cleanerId"]);

const bookingAssignments = defineTable({
  bookingId: v.id("bookings"),
  cleanerId: v.optional(v.id("cleaners")),
  crewId: v.optional(v.id("crews")),
  role: v.string(), // primary|secondary|lead|trainee
  status: v.string(), // pending|accepted|declined|confirmed|in_progress|completed|no_show|cancelled
  assignedAt: v.number(),
  assignedBy: v.optional(v.id("users")),
  respondedAt: v.optional(v.number()),
  confirmedAt: v.optional(v.number()),
  clockedInAt: v.optional(v.number()),
  clockedOutAt: v.optional(v.number()),
  actualDurationMinutes: v.optional(v.number()),
  payRateSnapshot: v.optional(
    v.object({
      payType: v.string(),
      rate: v.number(),
      currency: v.string(),
    })
  ),
  totalPayCents: v.optional(v.number()),
  bonusPayCents: v.optional(v.number()),
  cleanerNotes: v.optional(v.string()),
  supervisorNotes: v.optional(v.string()),
  cancelledAt: v.optional(v.number()),
  cancelledBy: v.optional(v.id("users")),
  cancellationReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_booking", ["bookingId"])
  .index("by_cleaner", ["cleanerId"])
  .index("by_crew", ["crewId"])
  .index("by_status", ["status"])
  .index("by_cleaner_status", ["cleanerId", "status"])
  .index("by_cleaner_date", ["cleanerId", "assignedAt"]);

const cleanerRatings = defineTable({
  cleanerId: v.id("cleaners"),
  bookingId: v.id("bookings"),
  bookingAssignmentId: v.optional(v.id("bookingAssignments")),
  overallRating: v.number(), // 1-5
  qualityRating: v.optional(v.number()),
  punctualityRating: v.optional(v.number()),
  professionalismRating: v.optional(v.number()),
  communicationRating: v.optional(v.number()),
  customerComment: v.optional(v.string()),
  isPublic: v.optional(v.boolean()),
  ratingSource: v.string(), // customer|supervisor|self
  ratedBy: v.optional(v.string()),
  cleanerResponse: v.optional(v.string()),
  respondedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_cleaner", ["cleanerId"])
  .index("by_booking", ["bookingId"])
  .index("by_cleaner_rating", ["cleanerId", "overallRating"]);

const cleanerReliabilityEvents = defineTable({
  cleanerId: v.id("cleaners"),
  bookingId: v.optional(v.id("bookings")),
  eventType: v.string(), // on_time|late|early|no_show|cancelled_late|cancelled_advance|completed_early|completed_late
  scheduledTime: v.optional(v.number()),
  actualTime: v.optional(v.number()),
  differenceMinutes: v.optional(v.number()),
  reliabilityImpact: v.optional(v.number()),
  notes: v.optional(v.string()),
  wasExcused: v.optional(v.boolean()),
  excusedBy: v.optional(v.id("users")),
  createdAt: v.number(),
})
  .index("by_cleaner", ["cleanerId"])
  .index("by_booking", ["bookingId"])
  .index("by_event_type", ["eventType"])
  .index("by_cleaner_date", ["cleanerId", "createdAt"]);

const cleanerDocuments = defineTable({
  cleanerId: v.id("cleaners"),
  documentType: v.string(), // w9|w4|i9|id_front|id_back|ssn_card|drivers_license|insurance_certificate|contract|nda|handbook_acknowledgment
  documentName: v.optional(v.string()),
  storageId: v.optional(v.string()),
  fileUrl: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  fileSizeBytes: v.optional(v.number()),
  taxYear: v.optional(v.number()),
  uploadedAt: v.number(),
  expiresAt: v.optional(v.number()),
  status: v.string(), // pending_review|approved|rejected|expired
  reviewedBy: v.optional(v.id("users")),
  reviewedAt: v.optional(v.number()),
  rejectionReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_cleaner", ["cleanerId"])
  .index("by_document_type", ["documentType"])
  .index("by_cleaner_type", ["cleanerId", "documentType"])
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
  // Customer Management
  customers,
  // Cleaner/Worker Management
  cleaners,
  cleanerPayRates,
  cleanerSkills,
  cleanerCertifications,
  cleanerServiceTypes,
  cleanerEquipment,
  cleanerAvailability,
  cleanerTimeOff,
  crews,
  crewMembers,
  bookingAssignments,
  cleanerRatings,
  cleanerReliabilityEvents,
  cleanerDocuments,
});
