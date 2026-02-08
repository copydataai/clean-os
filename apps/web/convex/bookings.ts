import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const BOOKING_STATUS_VALIDATOR = v.union(
  v.literal("pending_card"),
  v.literal("card_saved"),
  v.literal("scheduled"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("payment_failed"),
  v.literal("charged"),
  v.literal("cancelled")
);

async function requireAdminActorUserId(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required for admin override");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) {
    throw new Error("Authenticated user record not found");
  }

  const memberships = await ctx.db
    .query("organizationMemberships")
    .withIndex("by_user", (q: any) => q.eq("userId", user._id))
    .collect();

  const isAdmin = memberships.some((membership: { role?: string }) => {
    const role = (membership.role ?? "").toLowerCase();
    return (
      role === "admin" ||
      role === "owner" ||
      role.endsWith(":admin") ||
      role.endsWith(":owner") ||
      role.includes("admin")
    );
  });

  if (!isAdmin) {
    throw new Error("Admin role required for override transitions");
  }

  return user._id as Id<"users">;
}

export const createBookingFromTally = mutation({
  args: {
    email: v.string(),
    customerName: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    serviceDate: v.optional(v.string()),
    amount: v.optional(v.number()),
    notes: v.optional(v.string()),
    tallyResponseId: v.optional(v.string()),
    bookingRequestId: v.optional(v.id("bookingRequests")),
  },
  handler: async (ctx, args): Promise<Id<"bookings">> => {
    const now = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      email: args.email,
      customerName: args.customerName,
      status: "pending_card",
      serviceType: args.serviceType,
      serviceDate: args.serviceDate,
      amount: args.amount,
      notes: args.notes,
      tallyResponseId: args.tallyResponseId,
      bookingRequestId: args.bookingRequestId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.bookingStateMachine.appendLifecycleEvent, {
      bookingId,
      eventType: "created",
      toStatus: "pending_card",
      source: "bookings.createBookingFromTally",
    });

    return bookingId;
  },
});

export const createBookingFromRequest = mutation({
  args: {
    requestId: v.id("bookingRequests"),
  },
  handler: async (ctx, args): Promise<Id<"bookings">> => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Booking request not found");
    }

    if (request.bookingId) {
      return request.bookingId;
    }

    if (!request.email) {
      throw new Error("Booking request is missing email");
    }

    const now = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      email: request.email,
      customerName: request.contactDetails,
      status: "pending_card",
      notes: request.additionalNotes ?? request.attentionAreas,
      bookingRequestId: request._id,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.bookingStateMachine.appendLifecycleEvent, {
      bookingId,
      eventType: "created",
      toStatus: "pending_card",
      source: "bookings.createBookingFromRequest",
    });

    await ctx.runMutation(internal.bookingRequests.linkBookingToRequest, {
      requestId: request._id,
      bookingId,
    });

    return bookingId;
  },
});

export const markCardOnFile = mutation({
  args: {
    bookingId: v.id("bookings"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"bookings">> => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    await ctx.db.patch(args.bookingId, {
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.bookingStateMachine.transitionBookingStatus, {
      bookingId: args.bookingId,
      toStatus: "card_saved",
      source: "bookings.markCardOnFile",
    });

    await ctx.runMutation(internal.bookingStateMachine.recomputeScheduledState, {
      bookingId: args.bookingId,
      source: "bookings.markCardOnFile",
    });

    return args.bookingId;
  },
});

export const getBooking = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBookingsByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
  },
});

export const listPendingBookings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) => q.eq("status", "card_saved"))
      .collect();
  },
});

export const listCompletedBookings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();
  },
});

export const markJobCompleted = mutation({
  args: {
    bookingId: v.id("bookings"),
    finalAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    if (booking.status !== "in_progress") {
      throw new Error(
        `Booking must be in_progress before completion (current: ${booking.status})`
      );
    }

    await ctx.db.patch(args.bookingId, {
      amount: args.finalAmount ?? booking.amount,
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.bookingStateMachine.transitionBookingStatus, {
      bookingId: args.bookingId,
      toStatus: "completed",
      source: "bookings.markJobCompleted",
    });
  },
});

export const updateSchedule = mutation({
  args: {
    bookingId: v.id("bookings"),
    serviceDate: v.optional(v.string()),
    serviceWindowStart: v.optional(v.string()),
    serviceWindowEnd: v.optional(v.string()),
    estimatedDurationMinutes: v.optional(v.number()),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    await ctx.runMutation(internal.bookingDb.updateBookingScheduleFields, {
      id: args.bookingId,
      serviceDate: args.serviceDate,
      serviceWindowStart: args.serviceWindowStart,
      serviceWindowEnd: args.serviceWindowEnd,
      estimatedDurationMinutes: args.estimatedDurationMinutes,
    });

    await ctx.runMutation(internal.bookingStateMachine.recomputeScheduledState, {
      bookingId: args.bookingId,
      source: "bookings.updateSchedule",
      actorUserId: args.actorUserId,
    });

    return args.bookingId;
  },
});

export const rescheduleBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    newServiceDate: v.string(),
    newWindowStart: v.optional(v.string()),
    newWindowEnd: v.optional(v.string()),
    reason: v.string(),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    await ctx.runMutation(internal.bookingDb.updateBookingScheduleFields, {
      id: args.bookingId,
      serviceDate: args.newServiceDate,
      serviceWindowStart: args.newWindowStart,
      serviceWindowEnd: args.newWindowEnd,
    });

    await ctx.runMutation(internal.bookingStateMachine.appendLifecycleEvent, {
      bookingId: args.bookingId,
      eventType: "rescheduled",
      fromStatus: booking.status,
      toStatus: booking.status,
      reason: args.reason,
      source: "bookings.rescheduleBooking",
      actorUserId: args.actorUserId,
      fromServiceDate: booking.serviceDate,
      toServiceDate: args.newServiceDate,
      metadata: {
        fromWindowStart: booking.serviceWindowStart,
        fromWindowEnd: booking.serviceWindowEnd,
        toWindowStart: args.newWindowStart,
        toWindowEnd: args.newWindowEnd,
      },
    });

    await ctx.runMutation(internal.bookingStateMachine.recomputeScheduledState, {
      bookingId: args.bookingId,
      source: "bookings.rescheduleBooking",
      actorUserId: args.actorUserId,
    });

    return args.bookingId;
  },
});

export const cancelBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    reason: v.string(),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<any> => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (!["pending_card", "card_saved", "scheduled"].includes(booking.status)) {
      throw new Error(
        `Cancellation is only allowed from pending_card, card_saved, or scheduled (current: ${booking.status})`
      );
    }

    const transition: any = await ctx.runMutation(internal.bookingStateMachine.transitionBookingStatus, {
      bookingId: args.bookingId,
      toStatus: "cancelled",
      source: "bookings.cancelBooking",
      reason: args.reason,
      actorUserId: args.actorUserId,
    });

    return transition;
  },
});

export const adminOverrideBookingStatus = mutation({
  args: {
    bookingId: v.id("bookings"),
    toStatus: BOOKING_STATUS_VALIDATOR,
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    const actorUserId = await requireAdminActorUserId(ctx);

    return await ctx.runMutation(internal.bookingStateMachine.transitionBookingStatus, {
      bookingId: args.bookingId,
      toStatus: args.toStatus,
      source: "bookings.adminOverrideBookingStatus",
      reason: args.reason,
      actorUserId,
      allowOverride: true,
    });
  },
});

export const chargeCompletedJob = action({
  args: {
    bookingId: v.id("bookings"),
    amount: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    paymentIntentId?: string;
    requiresAction?: boolean;
    paymentLinkUrl?: string;
    error?: string;
  }> => {
    return await ctx.runAction(internal.stripeActions.chargeBooking, {
      bookingId: args.bookingId,
      amount: args.amount,
      description: args.description,
    });
  },
});

export const getPaymentIntentsForBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentIntents")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();
  },
});

export const listBookings = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.status) {
      const status = args.status;
      return await ctx.db
        .query("bookings")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("bookings").order("desc").take(limit);
  },
});
