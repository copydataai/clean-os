import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================================
// Internal Queries
// ============================================================================

export const getCleanerById = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db.get(cleanerId);
  },
});

export const getCleanerByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("cleaners")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
  },
});

export const getCleanerByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query("cleaners")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();
  },
});

export const getCleanersByOrganization = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    return await ctx.db
      .query("cleaners")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
  },
});

export const getCleanersByStatus = internalQuery({
  args: { status: v.string() },
  handler: async (ctx, { status }) => {
    return await ctx.db
      .query("cleaners")
      .withIndex("by_status", (q) => q.eq("status", status))
      .collect();
  },
});

export const getCleanersByStatusAndOrg = internalQuery({
  args: {
    status: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, { status, organizationId }) => {
    return await ctx.db
      .query("cleaners")
      .withIndex("by_status_and_org", (q) =>
        q.eq("status", status).eq("organizationId", organizationId)
      )
      .collect();
  },
});

export const getActivePayRate = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerPayRates")
      .withIndex("by_cleaner_active", (q) =>
        q.eq("cleanerId", cleanerId).eq("isActive", true)
      )
      .first();
  },
});

export const getPayRatesByCleanerAndService = internalQuery({
  args: {
    cleanerId: v.id("cleaners"),
    serviceType: v.string(),
  },
  handler: async (ctx, { cleanerId, serviceType }) => {
    return await ctx.db
      .query("cleanerPayRates")
      .withIndex("by_cleaner_service", (q) =>
        q.eq("cleanerId", cleanerId).eq("serviceType", serviceType)
      )
      .collect();
  },
});

export const getCleanerSkills = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerSkills")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getCleanersBySkillType = internalQuery({
  args: { skillType: v.string() },
  handler: async (ctx, { skillType }) => {
    return await ctx.db
      .query("cleanerSkills")
      .withIndex("by_skill_type", (q) => q.eq("skillType", skillType))
      .collect();
  },
});

export const getCleanerCertifications = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerCertifications")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getExpiringCertifications = internalQuery({
  args: { beforeTimestamp: v.number() },
  handler: async (ctx, { beforeTimestamp }) => {
    return await ctx.db
      .query("cleanerCertifications")
      .withIndex("by_expiration")
      .filter((q) =>
        q.and(
          q.neq(q.field("expiresAt"), undefined),
          q.lt(q.field("expiresAt"), beforeTimestamp)
        )
      )
      .collect();
  },
});

export const getCleanerServiceTypes = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerServiceTypes")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getCleanersQualifiedForService = internalQuery({
  args: { serviceType: v.string() },
  handler: async (ctx, { serviceType }) => {
    return await ctx.db
      .query("cleanerServiceTypes")
      .withIndex("by_service_type", (q) => q.eq("serviceType", serviceType))
      .filter((q) => q.eq(q.field("isQualified"), true))
      .collect();
  },
});

export const getCleanerAvailability = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerAvailability")
      .withIndex("by_cleaner_active", (q) =>
        q.eq("cleanerId", cleanerId).eq("isActive", true)
      )
      .collect();
  },
});

export const getCleanerAvailabilityByDay = internalQuery({
  args: {
    cleanerId: v.id("cleaners"),
    dayOfWeek: v.number(),
  },
  handler: async (ctx, { cleanerId, dayOfWeek }) => {
    return await ctx.db
      .query("cleanerAvailability")
      .withIndex("by_cleaner_day", (q) =>
        q.eq("cleanerId", cleanerId).eq("dayOfWeek", dayOfWeek)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getCleanerTimeOff = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerTimeOff")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getPendingTimeOffRequests = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("cleanerTimeOff")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const getCrewById = internalQuery({
  args: { crewId: v.id("crews") },
  handler: async (ctx, { crewId }) => {
    return await ctx.db.get(crewId);
  },
});

export const getCrewsByOrganization = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    return await ctx.db
      .query("crews")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
  },
});

export const getActiveCrewMembers = internalQuery({
  args: { crewId: v.id("crews") },
  handler: async (ctx, { crewId }) => {
    return await ctx.db
      .query("crewMembers")
      .withIndex("by_crew_active", (q) => q.eq("crewId", crewId).eq("isActive", true))
      .collect();
  },
});

export const getCleanerCrewMemberships = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("crewMembers")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getBookingAssignments = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    return await ctx.db
      .query("bookingAssignments")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .collect();
  },
});

export const getCleanerAssignments = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("bookingAssignments")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getCleanerAssignmentsByStatus = internalQuery({
  args: {
    cleanerId: v.id("cleaners"),
    status: v.string(),
  },
  handler: async (ctx, { cleanerId, status }) => {
    return await ctx.db
      .query("bookingAssignments")
      .withIndex("by_cleaner_status", (q) =>
        q.eq("cleanerId", cleanerId).eq("status", status)
      )
      .collect();
  },
});

export const getCleanerRatings = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerRatings")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getCleanerReliabilityEvents = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerReliabilityEvents")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getCleanerDocuments = internalQuery({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerDocuments")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getCleanerDocumentsByType = internalQuery({
  args: {
    cleanerId: v.id("cleaners"),
    documentType: v.string(),
  },
  handler: async (ctx, { cleanerId, documentType }) => {
    return await ctx.db
      .query("cleanerDocuments")
      .withIndex("by_cleaner_type", (q) =>
        q.eq("cleanerId", cleanerId).eq("documentType", documentType)
      )
      .collect();
  },
});

// ============================================================================
// Internal Mutations
// ============================================================================

export const createCleaner = internalMutation({
  args: {
    clerkId: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    status: v.string(),
    employmentType: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleaners", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCleaner = internalMutation({
  args: {
    cleanerId: v.id("cleaners"),
    updates: v.object({
      clerkId: v.optional(v.string()),
      organizationId: v.optional(v.id("organizations")),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      alternatePhone: v.optional(v.string()),
      profileImageUrl: v.optional(v.string()),
      bio: v.optional(v.string()),
      contactPreferences: v.optional(
        v.object({
          email: v.boolean(),
          sms: v.boolean(),
          push: v.boolean(),
          preferredMethod: v.optional(v.string()),
        })
      ),
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
      languages: v.optional(v.array(v.string())),
      status: v.optional(v.string()),
      employmentType: v.optional(v.string()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      probationEndDate: v.optional(v.string()),
      terminationReason: v.optional(v.string()),
      backgroundCheckStatus: v.optional(v.string()),
      backgroundCheckDate: v.optional(v.number()),
      backgroundCheckExpiresAt: v.optional(v.number()),
      backgroundCheckProvider: v.optional(v.string()),
      backgroundCheckReferenceId: v.optional(v.string()),
      maxHoursPerDay: v.optional(v.number()),
      maxHoursPerWeek: v.optional(v.number()),
      preferredZones: v.optional(v.array(v.string())),
      willingToTravel: v.optional(v.boolean()),
      maxTravelDistanceMiles: v.optional(v.number()),
      hasOwnTransportation: v.optional(v.boolean()),
      hasOwnEquipment: v.optional(v.boolean()),
      totalJobsCompleted: v.optional(v.number()),
      averageRating: v.optional(v.number()),
      totalRatingsCount: v.optional(v.number()),
      reliabilityScore: v.optional(v.number()),
      internalNotes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { cleanerId, updates }) => {
    const cleaner = await ctx.db.get(cleanerId);
    if (!cleaner) {
      throw new Error("Cleaner not found");
    }
    await ctx.db.patch(cleanerId, {
      ...updates,
      updatedAt: Date.now(),
    });
    return cleanerId;
  },
});

export const createPayRate = internalMutation({
  args: {
    cleanerId: v.id("cleaners"),
    payType: v.string(),
    baseRate: v.number(),
    currency: v.optional(v.string()),
    overtimeRate: v.optional(v.number()),
    weekendRate: v.optional(v.number()),
    holidayRate: v.optional(v.number()),
    serviceType: v.optional(v.string()),
    bonusEligible: v.optional(v.boolean()),
    effectiveFrom: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleanerPayRates", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deactivatePayRate = internalMutation({
  args: {
    payRateId: v.id("cleanerPayRates"),
    effectiveUntil: v.number(),
  },
  handler: async (ctx, { payRateId, effectiveUntil }) => {
    await ctx.db.patch(payRateId, {
      isActive: false,
      effectiveUntil,
      updatedAt: Date.now(),
    });
    return payRateId;
  },
});

export const createSkill = internalMutation({
  args: {
    cleanerId: v.id("cleaners"),
    skillType: v.string(),
    proficiencyLevel: v.string(),
    isVerified: v.optional(v.boolean()),
    trainingCompletedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleanerSkills", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSkill = internalMutation({
  args: {
    skillId: v.id("cleanerSkills"),
    updates: v.object({
      proficiencyLevel: v.optional(v.string()),
      isVerified: v.optional(v.boolean()),
      verifiedBy: v.optional(v.id("users")),
      verifiedAt: v.optional(v.number()),
      lastAssessedAt: v.optional(v.number()),
      notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { skillId, updates }) => {
    await ctx.db.patch(skillId, {
      ...updates,
      updatedAt: Date.now(),
    });
    return skillId;
  },
});

export const createCertification = internalMutation({
  args: {
    cleanerId: v.id("cleaners"),
    certificationType: v.string(),
    certificationName: v.string(),
    issuingOrganization: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
    issuedAt: v.number(),
    expiresAt: v.optional(v.number()),
    status: v.string(),
    documentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleanerCertifications", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCertificationStatus = internalMutation({
  args: {
    certificationId: v.id("cleanerCertifications"),
    status: v.string(),
    isVerified: v.optional(v.boolean()),
    verifiedBy: v.optional(v.id("users")),
    verifiedAt: v.optional(v.number()),
  },
  handler: async (ctx, { certificationId, ...updates }) => {
    await ctx.db.patch(certificationId, {
      ...updates,
      updatedAt: Date.now(),
    });
    return certificationId;
  },
});

export const addServiceTypeQualification = internalMutation({
  args: {
    cleanerId: v.id("cleaners"),
    serviceType: v.string(),
    isQualified: v.boolean(),
    qualifiedAt: v.optional(v.number()),
    qualifiedBy: v.optional(v.id("users")),
    isPreferred: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleanerServiceTypes", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addEquipment = internalMutation({
  args: {
    cleanerId: v.id("cleaners"),
    equipmentType: v.string(),
    equipmentName: v.optional(v.string()),
    ownsEquipment: v.optional(v.boolean()),
    canOperate: v.boolean(),
    trainedAt: v.optional(v.number()),
    trainedBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleanerEquipment", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const setAvailability = internalMutation({
  args: {
    cleanerId: v.id("cleaners"),
    dayOfWeek: v.number(),
    startTime: v.string(),
    endTime: v.string(),
    timezone: v.optional(v.string()),
    effectiveFrom: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleanerAvailability", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAvailability = internalMutation({
  args: {
    availabilityId: v.id("cleanerAvailability"),
    updates: v.object({
      startTime: v.optional(v.string()),
      endTime: v.optional(v.string()),
      timezone: v.optional(v.string()),
      effectiveUntil: v.optional(v.number()),
      isActive: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { availabilityId, updates }) => {
    await ctx.db.patch(availabilityId, {
      ...updates,
      updatedAt: Date.now(),
    });
    return availabilityId;
  },
});

export const requestTimeOff = internalMutation({
  args: {
    cleanerId: v.id("cleaners"),
    startDate: v.string(),
    endDate: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    isAllDay: v.boolean(),
    timeOffType: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleanerTimeOff", {
      ...args,
      status: "pending",
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTimeOffStatus = internalMutation({
  args: {
    timeOffId: v.id("cleanerTimeOff"),
    status: v.string(),
    approvedBy: v.optional(v.id("users")),
    denialReason: v.optional(v.string()),
  },
  handler: async (ctx, { timeOffId, status, approvedBy, denialReason }) => {
    const now = Date.now();
    const updates: Record<string, unknown> = {
      status,
      updatedAt: now,
    };
    if (status === "approved" && approvedBy) {
      updates.approvedBy = approvedBy;
      updates.approvedAt = now;
    }
    if (status === "denied" && denialReason) {
      updates.denialReason = denialReason;
    }
    await ctx.db.patch(timeOffId, updates);
    return timeOffId;
  },
});

export const createCrew = internalMutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    leadCleanerId: v.optional(v.id("cleaners")),
    maxMembers: v.optional(v.number()),
    specializedServiceTypes: v.optional(v.array(v.string())),
    preferredZones: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("crews", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCrew = internalMutation({
  args: {
    crewId: v.id("crews"),
    updates: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      status: v.optional(v.string()),
      leadCleanerId: v.optional(v.id("cleaners")),
      maxMembers: v.optional(v.number()),
      specializedServiceTypes: v.optional(v.array(v.string())),
      preferredZones: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, { crewId, updates }) => {
    await ctx.db.patch(crewId, {
      ...updates,
      updatedAt: Date.now(),
    });
    return crewId;
  },
});

export const addCrewMember = internalMutation({
  args: {
    crewId: v.id("crews"),
    cleanerId: v.id("cleaners"),
    role: v.string(),
  },
  handler: async (ctx, { crewId, cleanerId, role }) => {
    const now = Date.now();
    return await ctx.db.insert("crewMembers", {
      crewId,
      cleanerId,
      role,
      joinedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeCrewMember = internalMutation({
  args: {
    crewMemberId: v.id("crewMembers"),
  },
  handler: async (ctx, { crewMemberId }) => {
    const now = Date.now();
    await ctx.db.patch(crewMemberId, {
      isActive: false,
      leftAt: now,
      updatedAt: now,
    });
    return crewMemberId;
  },
});

export const createBookingAssignment = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    cleanerId: v.optional(v.id("cleaners")),
    crewId: v.optional(v.id("crews")),
    role: v.string(),
    assignedBy: v.optional(v.id("users")),
    payRateSnapshot: v.optional(
      v.object({
        payType: v.string(),
        rate: v.number(),
        currency: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("bookingAssignments", {
      ...args,
      status: "pending",
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAssignmentStatus = internalMutation({
  args: {
    assignmentId: v.id("bookingAssignments"),
    status: v.string(),
    cleanerNotes: v.optional(v.string()),
    supervisorNotes: v.optional(v.string()),
  },
  handler: async (ctx, { assignmentId, status, cleanerNotes, supervisorNotes }) => {
    const now = Date.now();
    const updates: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (status === "accepted" || status === "declined") {
      updates.respondedAt = now;
    }
    if (status === "confirmed") {
      updates.confirmedAt = now;
    }
    if (cleanerNotes !== undefined) {
      updates.cleanerNotes = cleanerNotes;
    }
    if (supervisorNotes !== undefined) {
      updates.supervisorNotes = supervisorNotes;
    }

    await ctx.db.patch(assignmentId, updates);
    return assignmentId;
  },
});

export const clockIn = internalMutation({
  args: {
    assignmentId: v.id("bookingAssignments"),
  },
  handler: async (ctx, { assignmentId }) => {
    const now = Date.now();
    await ctx.db.patch(assignmentId, {
      status: "in_progress",
      clockedInAt: now,
      updatedAt: now,
    });
    return assignmentId;
  },
});

export const clockOut = internalMutation({
  args: {
    assignmentId: v.id("bookingAssignments"),
    totalPayCents: v.optional(v.number()),
    bonusPayCents: v.optional(v.number()),
  },
  handler: async (ctx, { assignmentId, totalPayCents, bonusPayCents }) => {
    const now = Date.now();
    const assignment = await ctx.db.get(assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    let actualDurationMinutes: number | undefined;
    if (assignment.clockedInAt) {
      actualDurationMinutes = Math.round((now - assignment.clockedInAt) / 60000);
    }

    await ctx.db.patch(assignmentId, {
      status: "completed",
      clockedOutAt: now,
      actualDurationMinutes,
      totalPayCents,
      bonusPayCents,
      updatedAt: now,
    });
    return assignmentId;
  },
});

export const cancelAssignment = internalMutation({
  args: {
    assignmentId: v.id("bookingAssignments"),
    cancelledBy: v.optional(v.id("users")),
    cancellationReason: v.optional(v.string()),
  },
  handler: async (ctx, { assignmentId, cancelledBy, cancellationReason }) => {
    const now = Date.now();
    await ctx.db.patch(assignmentId, {
      status: "cancelled",
      cancelledAt: now,
      cancelledBy,
      cancellationReason,
      updatedAt: now,
    });
    return assignmentId;
  },
});

export const createRating = internalMutation({
  args: {
    cleanerId: v.id("cleaners"),
    bookingId: v.id("bookings"),
    bookingAssignmentId: v.optional(v.id("bookingAssignments")),
    overallRating: v.number(),
    qualityRating: v.optional(v.number()),
    punctualityRating: v.optional(v.number()),
    professionalismRating: v.optional(v.number()),
    communicationRating: v.optional(v.number()),
    customerComment: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    ratingSource: v.string(),
    ratedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleanerRatings", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addCleanerResponse = internalMutation({
  args: {
    ratingId: v.id("cleanerRatings"),
    cleanerResponse: v.string(),
  },
  handler: async (ctx, { ratingId, cleanerResponse }) => {
    const now = Date.now();
    await ctx.db.patch(ratingId, {
      cleanerResponse,
      respondedAt: now,
      updatedAt: now,
    });
    return ratingId;
  },
});

export const recordReliabilityEvent = internalMutation({
  args: {
    cleanerId: v.id("cleaners"),
    bookingId: v.optional(v.id("bookings")),
    eventType: v.string(),
    scheduledTime: v.optional(v.number()),
    actualTime: v.optional(v.number()),
    differenceMinutes: v.optional(v.number()),
    reliabilityImpact: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("cleanerReliabilityEvents", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const excuseReliabilityEvent = internalMutation({
  args: {
    eventId: v.id("cleanerReliabilityEvents"),
    excusedBy: v.id("users"),
  },
  handler: async (ctx, { eventId, excusedBy }) => {
    await ctx.db.patch(eventId, {
      wasExcused: true,
      excusedBy,
    });
    return eventId;
  },
});

export const uploadDocument = internalMutation({
  args: {
    cleanerId: v.id("cleaners"),
    documentType: v.string(),
    documentName: v.optional(v.string()),
    storageId: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
    taxYear: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleanerDocuments", {
      ...args,
      uploadedAt: now,
      status: "pending_review",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const reviewDocument = internalMutation({
  args: {
    documentId: v.id("cleanerDocuments"),
    status: v.string(),
    reviewedBy: v.id("users"),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, { documentId, status, reviewedBy, rejectionReason }) => {
    const now = Date.now();
    const updates: Record<string, unknown> = {
      status,
      reviewedBy,
      reviewedAt: now,
      updatedAt: now,
    };
    if (status === "rejected" && rejectionReason) {
      updates.rejectionReason = rejectionReason;
    }
    await ctx.db.patch(documentId, updates);
    return documentId;
  },
});

// ============================================================================
// Utility: Recalculate Cleaner Performance Metrics
// ============================================================================

export const recalculateCleanerMetrics = internalMutation({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    // Get all ratings
    const ratings = await ctx.db
      .query("cleanerRatings")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();

    // Get completed assignments
    const completedAssignments = await ctx.db
      .query("bookingAssignments")
      .withIndex("by_cleaner_status", (q) =>
        q.eq("cleanerId", cleanerId).eq("status", "completed")
      )
      .collect();

    // Get reliability events (non-excused)
    const reliabilityEvents = await ctx.db
      .query("cleanerReliabilityEvents")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .filter((q) => q.neq(q.field("wasExcused"), true))
      .collect();

    // Calculate average rating
    let averageRating: number | undefined;
    if (ratings.length > 0) {
      const sum = ratings.reduce((acc, r) => acc + r.overallRating, 0);
      averageRating = sum / ratings.length;
    }

    // Calculate reliability score (simple formula: 100 - penalties)
    let reliabilityScore = 100;
    for (const event of reliabilityEvents) {
      if (event.reliabilityImpact) {
        reliabilityScore -= event.reliabilityImpact;
      }
    }
    reliabilityScore = Math.max(0, Math.min(100, reliabilityScore));

    // Update cleaner record
    await ctx.db.patch(cleanerId, {
      totalJobsCompleted: completedAssignments.length,
      averageRating,
      totalRatingsCount: ratings.length,
      reliabilityScore,
      updatedAt: Date.now(),
    });

    return {
      totalJobsCompleted: completedAssignments.length,
      averageRating,
      totalRatingsCount: ratings.length,
      reliabilityScore,
    };
  },
});
