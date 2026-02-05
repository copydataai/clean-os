import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================================================
// Public Queries
// ============================================================================

export const getById = query({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db.get(cleanerId);
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("cleaners")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
  },
});

export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    status: v.optional(v.string()),
    employmentType: v.optional(v.string()),
  },
  handler: async (ctx, { organizationId, status, employmentType }) => {
    let query = ctx.db.query("cleaners");

    if (organizationId && status) {
      return await query
        .withIndex("by_status_and_org", (q) =>
          q.eq("status", status).eq("organizationId", organizationId)
        )
        .collect();
    }

    if (organizationId) {
      return await query
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
    }

    if (status) {
      return await query
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    }

    if (employmentType) {
      return await query
        .withIndex("by_employment_type", (q) => q.eq("employmentType", employmentType))
        .collect();
    }

    return await query.collect();
  },
});

export const getWithDetails = query({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    const cleaner = await ctx.db.get(cleanerId);
    if (!cleaner) return null;

    const [skills, certifications, serviceTypes, availability, activePayRate] =
      await Promise.all([
        ctx.db
          .query("cleanerSkills")
          .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
          .collect(),
        ctx.db
          .query("cleanerCertifications")
          .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
          .collect(),
        ctx.db
          .query("cleanerServiceTypes")
          .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
          .collect(),
        ctx.db
          .query("cleanerAvailability")
          .withIndex("by_cleaner_active", (q) =>
            q.eq("cleanerId", cleanerId).eq("isActive", true)
          )
          .collect(),
        ctx.db
          .query("cleanerPayRates")
          .withIndex("by_cleaner_active", (q) =>
            q.eq("cleanerId", cleanerId).eq("isActive", true)
          )
          .first(),
      ]);

    return {
      ...cleaner,
      skills,
      certifications,
      serviceTypes,
      availability,
      activePayRate,
    };
  },
});

export const getSkills = query({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerSkills")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getCertifications = query({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerCertifications")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getAvailability = query({
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

export const getTimeOffRequests = query({
  args: {
    cleanerId: v.id("cleaners"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { cleanerId, status }) => {
    if (status) {
      return await ctx.db
        .query("cleanerTimeOff")
        .withIndex("by_cleaner_status", (q) =>
          q.eq("cleanerId", cleanerId).eq("status", status)
        )
        .collect();
    }
    return await ctx.db
      .query("cleanerTimeOff")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getAssignments = query({
  args: {
    cleanerId: v.id("cleaners"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { cleanerId, status }) => {
    if (status) {
      return await ctx.db
        .query("bookingAssignments")
        .withIndex("by_cleaner_status", (q) =>
          q.eq("cleanerId", cleanerId).eq("status", status)
        )
        .collect();
    }
    return await ctx.db
      .query("bookingAssignments")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getRatings = query({
  args: { cleanerId: v.id("cleaners") },
  handler: async (ctx, { cleanerId }) => {
    return await ctx.db
      .query("cleanerRatings")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

export const getDocuments = query({
  args: {
    cleanerId: v.id("cleaners"),
    documentType: v.optional(v.string()),
  },
  handler: async (ctx, { cleanerId, documentType }) => {
    if (documentType) {
      return await ctx.db
        .query("cleanerDocuments")
        .withIndex("by_cleaner_type", (q) =>
          q.eq("cleanerId", cleanerId).eq("documentType", documentType)
        )
        .collect();
    }
    return await ctx.db
      .query("cleanerDocuments")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();
  },
});

// ============================================================================
// Crew Queries
// ============================================================================

export const getCrew = query({
  args: { crewId: v.id("crews") },
  handler: async (ctx, { crewId }) => {
    return await ctx.db.get(crewId);
  },
});

export const listCrews = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { organizationId, status }) => {
    if (organizationId) {
      const crews = await ctx.db
        .query("crews")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      if (status) {
        return crews.filter((c) => c.status === status);
      }
      return crews;
    }
    if (status) {
      return await ctx.db
        .query("crews")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    }
    return await ctx.db.query("crews").collect();
  },
});

export const getCrewWithMembers = query({
  args: { crewId: v.id("crews") },
  handler: async (ctx, { crewId }) => {
    const crew = await ctx.db.get(crewId);
    if (!crew) return null;

    const memberships = await ctx.db
      .query("crewMembers")
      .withIndex("by_crew_active", (q) => q.eq("crewId", crewId).eq("isActive", true))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const cleaner = await ctx.db.get(m.cleanerId);
        return { ...m, cleaner };
      })
    );

    return { ...crew, members };
  },
});

// ============================================================================
// Booking Assignment Queries
// ============================================================================

export const getBookingAssignments = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const assignments = await ctx.db
      .query("bookingAssignments")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .collect();

    // Enrich with cleaner/crew details
    return await Promise.all(
      assignments.map(async (assignment) => {
        const cleaner = assignment.cleanerId
          ? await ctx.db.get(assignment.cleanerId)
          : null;
        const crew = assignment.crewId ? await ctx.db.get(assignment.crewId) : null;
        return { ...assignment, cleaner, crew };
      })
    );
  },
});

// ============================================================================
// Public Mutations
// ============================================================================

export const create = mutation({
  args: {
    clerkId: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    status: v.optional(v.string()),
    employmentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleaners", {
      ...args,
      status: args.status ?? "applicant",
      employmentType: args.employmentType ?? "1099",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    cleanerId: v.id("cleaners"),
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
    internalNotes: v.optional(v.string()),
  },
  handler: async (ctx, { cleanerId, ...updates }) => {
    const cleaner = await ctx.db.get(cleanerId);
    if (!cleaner) {
      throw new Error("Cleaner not found");
    }

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(cleanerId, {
        ...filteredUpdates,
        updatedAt: Date.now(),
      });
    }

    return cleanerId;
  },
});

export const addSkill = mutation({
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

export const updateSkill = mutation({
  args: {
    skillId: v.id("cleanerSkills"),
    proficiencyLevel: v.optional(v.string()),
    isVerified: v.optional(v.boolean()),
    verifiedBy: v.optional(v.id("users")),
    verifiedAt: v.optional(v.number()),
    lastAssessedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { skillId, ...updates }) => {
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(skillId, {
        ...filteredUpdates,
        updatedAt: Date.now(),
      });
    }

    return skillId;
  },
});

export const removeSkill = mutation({
  args: { skillId: v.id("cleanerSkills") },
  handler: async (ctx, { skillId }) => {
    await ctx.db.delete(skillId);
    return skillId;
  },
});

export const addCertification = mutation({
  args: {
    cleanerId: v.id("cleaners"),
    certificationType: v.string(),
    certificationName: v.string(),
    issuingOrganization: v.optional(v.string()),
    certificateNumber: v.optional(v.string()),
    issuedAt: v.number(),
    expiresAt: v.optional(v.number()),
    status: v.optional(v.string()),
    documentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleanerCertifications", {
      ...args,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCertification = mutation({
  args: {
    certificationId: v.id("cleanerCertifications"),
    status: v.optional(v.string()),
    isVerified: v.optional(v.boolean()),
    verifiedBy: v.optional(v.id("users")),
    verifiedAt: v.optional(v.number()),
    documentUrl: v.optional(v.string()),
  },
  handler: async (ctx, { certificationId, ...updates }) => {
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(certificationId, {
        ...filteredUpdates,
        updatedAt: Date.now(),
      });
    }

    return certificationId;
  },
});

export const addServiceTypeQualification = mutation({
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

export const addEquipment = mutation({
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

export const setAvailability = mutation({
  args: {
    cleanerId: v.id("cleaners"),
    dayOfWeek: v.number(),
    startTime: v.string(),
    endTime: v.string(),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for existing availability on this day
    const existing = await ctx.db
      .query("cleanerAvailability")
      .withIndex("by_cleaner_day", (q) =>
        q.eq("cleanerId", args.cleanerId).eq("dayOfWeek", args.dayOfWeek)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        startTime: args.startTime,
        endTime: args.endTime,
        timezone: args.timezone,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new
    return await ctx.db.insert("cleanerAvailability", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeAvailability = mutation({
  args: { availabilityId: v.id("cleanerAvailability") },
  handler: async (ctx, { availabilityId }) => {
    await ctx.db.patch(availabilityId, {
      isActive: false,
      updatedAt: Date.now(),
    });
    return availabilityId;
  },
});

export const requestTimeOff = mutation({
  args: {
    cleanerId: v.id("cleaners"),
    startDate: v.string(),
    endDate: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    isAllDay: v.optional(v.boolean()),
    timeOffType: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("cleanerTimeOff", {
      ...args,
      isAllDay: args.isAllDay ?? true,
      status: "pending",
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const approveTimeOff = mutation({
  args: {
    timeOffId: v.id("cleanerTimeOff"),
    approvedBy: v.id("users"),
  },
  handler: async (ctx, { timeOffId, approvedBy }) => {
    const now = Date.now();
    await ctx.db.patch(timeOffId, {
      status: "approved",
      approvedBy,
      approvedAt: now,
      updatedAt: now,
    });
    return timeOffId;
  },
});

export const denyTimeOff = mutation({
  args: {
    timeOffId: v.id("cleanerTimeOff"),
    denialReason: v.optional(v.string()),
  },
  handler: async (ctx, { timeOffId, denialReason }) => {
    await ctx.db.patch(timeOffId, {
      status: "denied",
      denialReason,
      updatedAt: Date.now(),
    });
    return timeOffId;
  },
});

export const cancelTimeOff = mutation({
  args: { timeOffId: v.id("cleanerTimeOff") },
  handler: async (ctx, { timeOffId }) => {
    await ctx.db.patch(timeOffId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    return timeOffId;
  },
});

// ============================================================================
// Crew Mutations
// ============================================================================

export const createCrew = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    description: v.optional(v.string()),
    leadCleanerId: v.optional(v.id("cleaners")),
    maxMembers: v.optional(v.number()),
    specializedServiceTypes: v.optional(v.array(v.string())),
    preferredZones: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("crews", {
      ...args,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCrew = mutation({
  args: {
    crewId: v.id("crews"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    leadCleanerId: v.optional(v.id("cleaners")),
    maxMembers: v.optional(v.number()),
    specializedServiceTypes: v.optional(v.array(v.string())),
    preferredZones: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { crewId, ...updates }) => {
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(crewId, {
        ...filteredUpdates,
        updatedAt: Date.now(),
      });
    }

    return crewId;
  },
});

export const addCrewMember = mutation({
  args: {
    crewId: v.id("crews"),
    cleanerId: v.id("cleaners"),
    role: v.optional(v.string()),
  },
  handler: async (ctx, { crewId, cleanerId, role }) => {
    // Check if already a member
    const existing = await ctx.db
      .query("crewMembers")
      .withIndex("by_crew_cleaner", (q) =>
        q.eq("crewId", crewId).eq("cleanerId", cleanerId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (existing) {
      throw new Error("Cleaner is already a member of this crew");
    }

    const now = Date.now();
    return await ctx.db.insert("crewMembers", {
      crewId,
      cleanerId,
      role: role ?? "member",
      joinedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeCrewMember = mutation({
  args: { crewMemberId: v.id("crewMembers") },
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

export const updateCrewMemberRole = mutation({
  args: {
    crewMemberId: v.id("crewMembers"),
    role: v.string(),
  },
  handler: async (ctx, { crewMemberId, role }) => {
    await ctx.db.patch(crewMemberId, {
      role,
      updatedAt: Date.now(),
    });
    return crewMemberId;
  },
});

// ============================================================================
// Booking Assignment Mutations
// ============================================================================

export const assignToBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    cleanerId: v.optional(v.id("cleaners")),
    crewId: v.optional(v.id("crews")),
    role: v.optional(v.string()),
    assignedBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.cleanerId && !args.crewId) {
      throw new Error("Must specify either cleanerId or crewId");
    }

    // Get pay rate snapshot if assigning a cleaner
    let payRateSnapshot: { payType: string; rate: number; currency: string } | undefined;
    if (args.cleanerId) {
      const activePayRate = await ctx.db
        .query("cleanerPayRates")
        .withIndex("by_cleaner_active", (q) =>
          q.eq("cleanerId", args.cleanerId!).eq("isActive", true)
        )
        .first();

      if (activePayRate) {
        payRateSnapshot = {
          payType: activePayRate.payType,
          rate: activePayRate.baseRate,
          currency: activePayRate.currency ?? "USD",
        };
      }
    }

    const now = Date.now();
    return await ctx.db.insert("bookingAssignments", {
      bookingId: args.bookingId,
      cleanerId: args.cleanerId,
      crewId: args.crewId,
      role: args.role ?? "primary",
      status: "pending",
      assignedAt: now,
      assignedBy: args.assignedBy,
      payRateSnapshot,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const respondToAssignment = mutation({
  args: {
    assignmentId: v.id("bookingAssignments"),
    response: v.union(v.literal("accepted"), v.literal("declined")),
    cleanerNotes: v.optional(v.string()),
  },
  handler: async (ctx, { assignmentId, response, cleanerNotes }) => {
    const now = Date.now();
    await ctx.db.patch(assignmentId, {
      status: response,
      respondedAt: now,
      cleanerNotes,
      updatedAt: now,
    });
    return assignmentId;
  },
});

export const confirmAssignment = mutation({
  args: { assignmentId: v.id("bookingAssignments") },
  handler: async (ctx, { assignmentId }) => {
    const now = Date.now();
    await ctx.db.patch(assignmentId, {
      status: "confirmed",
      confirmedAt: now,
      updatedAt: now,
    });
    return assignmentId;
  },
});

export const clockIn = mutation({
  args: { assignmentId: v.id("bookingAssignments") },
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

export const clockOut = mutation({
  args: {
    assignmentId: v.id("bookingAssignments"),
    cleanerNotes: v.optional(v.string()),
  },
  handler: async (ctx, { assignmentId, cleanerNotes }) => {
    const now = Date.now();
    const assignment = await ctx.db.get(assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    let actualDurationMinutes: number | undefined;
    let totalPayCents: number | undefined;

    if (assignment.clockedInAt) {
      actualDurationMinutes = Math.round((now - assignment.clockedInAt) / 60000);

      // Calculate pay if we have a rate snapshot
      if (assignment.payRateSnapshot) {
        const { payType, rate } = assignment.payRateSnapshot;
        if (payType === "hourly") {
          totalPayCents = Math.round((actualDurationMinutes / 60) * rate);
        } else if (payType === "per_job") {
          totalPayCents = rate;
        }
      }
    }

    await ctx.db.patch(assignmentId, {
      status: "completed",
      clockedOutAt: now,
      actualDurationMinutes,
      totalPayCents,
      cleanerNotes: cleanerNotes ?? assignment.cleanerNotes,
      updatedAt: now,
    });

    return assignmentId;
  },
});

export const cancelAssignment = mutation({
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

// ============================================================================
// Rating Mutations
// ============================================================================

export const createRating = mutation({
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
    ratingSource: v.optional(v.string()),
    ratedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ratingId = await ctx.db.insert("cleanerRatings", {
      ...args,
      ratingSource: args.ratingSource ?? "customer",
      createdAt: now,
      updatedAt: now,
    });

    // Update cleaner's average rating
    const allRatings = await ctx.db
      .query("cleanerRatings")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", args.cleanerId))
      .collect();

    const sum = allRatings.reduce((acc, r) => acc + r.overallRating, 0);
    const averageRating = sum / allRatings.length;

    await ctx.db.patch(args.cleanerId, {
      averageRating,
      totalRatingsCount: allRatings.length,
      updatedAt: now,
    });

    return ratingId;
  },
});

export const addCleanerResponseToRating = mutation({
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

// ============================================================================
// Pay Rate Mutations
// ============================================================================

export const setPayRate = mutation({
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
    referralBonusAmount: v.optional(v.number()),
    performanceBonusPercentage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Deactivate current active pay rate
    const currentActive = await ctx.db
      .query("cleanerPayRates")
      .withIndex("by_cleaner_active", (q) =>
        q.eq("cleanerId", args.cleanerId).eq("isActive", true)
      )
      .first();

    if (currentActive) {
      await ctx.db.patch(currentActive._id, {
        isActive: false,
        effectiveUntil: now,
        updatedAt: now,
      });
    }

    // Create new pay rate
    return await ctx.db.insert("cleanerPayRates", {
      ...args,
      effectiveFrom: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ============================================================================
// Document Mutations
// ============================================================================

export const uploadDocument = mutation({
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

export const reviewDocument = mutation({
  args: {
    documentId: v.id("cleanerDocuments"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
    reviewedBy: v.id("users"),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, { documentId, status, reviewedBy, rejectionReason }) => {
    const now = Date.now();
    await ctx.db.patch(documentId, {
      status,
      reviewedBy,
      reviewedAt: now,
      rejectionReason: status === "rejected" ? rejectionReason : undefined,
      updatedAt: now,
    });
    return documentId;
  },
});

// ============================================================================
// Reliability Event Mutations
// ============================================================================

export const recordReliabilityEvent = mutation({
  args: {
    cleanerId: v.id("cleaners"),
    bookingId: v.optional(v.id("bookings")),
    eventType: v.string(),
    scheduledTime: v.optional(v.number()),
    actualTime: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let differenceMinutes: number | undefined;
    let reliabilityImpact: number | undefined;

    if (args.scheduledTime && args.actualTime) {
      differenceMinutes = Math.round(
        (args.actualTime - args.scheduledTime) / 60000
      );
    }

    // Calculate reliability impact based on event type
    switch (args.eventType) {
      case "no_show":
        reliabilityImpact = 20;
        break;
      case "cancelled_late":
        reliabilityImpact = 10;
        break;
      case "late":
        reliabilityImpact = differenceMinutes
          ? Math.min(10, Math.floor(differenceMinutes / 5))
          : 5;
        break;
      case "on_time":
      case "early":
        reliabilityImpact = 0;
        break;
      default:
        reliabilityImpact = 0;
    }

    const eventId = await ctx.db.insert("cleanerReliabilityEvents", {
      ...args,
      differenceMinutes,
      reliabilityImpact,
      createdAt: Date.now(),
    });

    // Update cleaner's reliability score
    const events = await ctx.db
      .query("cleanerReliabilityEvents")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", args.cleanerId))
      .filter((q) => q.neq(q.field("wasExcused"), true))
      .collect();

    let reliabilityScore = 100;
    for (const event of events) {
      if (event.reliabilityImpact) {
        reliabilityScore -= event.reliabilityImpact;
      }
    }
    reliabilityScore = Math.max(0, Math.min(100, reliabilityScore));

    await ctx.db.patch(args.cleanerId, {
      reliabilityScore,
      updatedAt: Date.now(),
    });

    return eventId;
  },
});

export const excuseReliabilityEvent = mutation({
  args: {
    eventId: v.id("cleanerReliabilityEvents"),
    excusedBy: v.id("users"),
  },
  handler: async (ctx, { eventId, excusedBy }) => {
    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    await ctx.db.patch(eventId, {
      wasExcused: true,
      excusedBy,
    });

    // Recalculate reliability score
    const events = await ctx.db
      .query("cleanerReliabilityEvents")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", event.cleanerId))
      .filter((q) => q.neq(q.field("wasExcused"), true))
      .collect();

    let reliabilityScore = 100;
    for (const e of events) {
      if (e.reliabilityImpact) {
        reliabilityScore -= e.reliabilityImpact;
      }
    }
    reliabilityScore = Math.max(0, Math.min(100, reliabilityScore));

    await ctx.db.patch(event.cleanerId, {
      reliabilityScore,
      updatedAt: Date.now(),
    });

    return eventId;
  },
});
