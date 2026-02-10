import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  assertRecordInActiveOrg,
  requireActiveOrganization,
  requireOrganizationAdmin,
} from "./lib/orgContext";

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

export const createBookingFromTally = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
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
    const customerId = await ctx.runMutation(internal.customers.ensureLifecycleCustomer, {
      organizationId: args.organizationId,
      email: args.email,
      fullName: args.customerName,
      source: "booking",
      activateOnLink: true,
    });

    const request = args.bookingRequestId
      ? await ctx.runQuery(internal.bookingRequests.getRequestById, {
          id: args.bookingRequestId,
        })
      : null;

    const now = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      organizationId: args.organizationId,
      email: args.email,
      customerName: args.customerName,
      customerId,
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

    await ctx.runMutation(internal.customers.linkLifecycleRecordsToCustomer, {
      customerId,
      bookingId,
      bookingRequestId: args.bookingRequestId,
      quoteRequestId: request?.quoteRequestId,
    });

    await ctx.runMutation(internal.customers.recomputeStatsInternal, {
      customerId,
    });

    return bookingId;
  },
});

export const createBookingFromRequest = mutation({
  args: {
    requestId: v.id("bookingRequests"),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args): Promise<Id<"bookings">> => {
    const { organization } = await requireActiveOrganization(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Booking request not found");
    }
    assertRecordInActiveOrg(request.organizationId, organization._id);

    if (request.bookingId) {
      if (request.customerId) {
        await ctx.runMutation(internal.customers.linkLifecycleRecordsToCustomer, {
          customerId: request.customerId,
          bookingId: request.bookingId,
          bookingRequestId: request._id,
          quoteRequestId: request.quoteRequestId,
        });
      }
      return request.bookingId;
    }

    if (!request.email) {
      throw new Error("Booking request is missing email");
    }

    const resolvedOrganizationId = request.organizationId ?? args.organizationId ?? organization._id;
    if (request.organizationId && args.organizationId && request.organizationId !== args.organizationId) {
      throw new Error("ORG_MISMATCH");
    }
    assertRecordInActiveOrg(resolvedOrganizationId, organization._id);

    const customerId = await ctx.runMutation(internal.customers.ensureLifecycleCustomer, {
      organizationId: resolvedOrganizationId,
      email: request.email,
      fullName: request.contactDetails,
      contactDetails: request.contactDetails,
      phone: request.phoneNumber,
      source: "booking",
      activateOnLink: true,
    });

    const now = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      organizationId: resolvedOrganizationId,
      email: request.email,
      customerName: request.contactDetails,
      customerId,
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

    await ctx.runMutation(internal.customers.linkLifecycleRecordsToCustomer, {
      customerId,
      bookingId,
      bookingRequestId: request._id,
      quoteRequestId: request.quoteRequestId,
    });

    await ctx.runMutation(internal.customers.recomputeStatsInternal, {
      customerId,
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
    const { organization } = await requireActiveOrganization(ctx);
    const booking = await ctx.db.get(args.id);
    if (!booking) {
      return null;
    }
    assertRecordInActiveOrg(booking.organizationId, organization._id);
    return booking;
  },
});

export const getBookingsByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    return await ctx.db
      .query("bookings")
      .withIndex("by_org_email", (q) =>
        q.eq("organizationId", organization._id).eq("email", args.email)
      )
      .collect();
  },
});

export const listPendingBookings = query({
  args: {},
  handler: async (ctx) => {
    const { organization } = await requireActiveOrganization(ctx);
    return await ctx.db
      .query("bookings")
      .withIndex("by_org_status", (q) =>
        q.eq("organizationId", organization._id).eq("status", "card_saved")
      )
      .collect();
  },
});

export const listCompletedBookings = query({
  args: {},
  handler: async (ctx) => {
    const { organization } = await requireActiveOrganization(ctx);
    return await ctx.db
      .query("bookings")
      .withIndex("by_org_status", (q) =>
        q.eq("organizationId", organization._id).eq("status", "completed")
      )
      .collect();
  },
});

export const markJobCompleted = mutation({
  args: {
    bookingId: v.id("bookings"),
    finalAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    assertRecordInActiveOrg(booking.organizationId, organization._id);
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
    const { organization } = await requireActiveOrganization(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    assertRecordInActiveOrg(booking.organizationId, organization._id);

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
    const { organization } = await requireActiveOrganization(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    assertRecordInActiveOrg(booking.organizationId, organization._id);

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
    const { organization } = await requireActiveOrganization(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    assertRecordInActiveOrg(booking.organizationId, organization._id);

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
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    const { user } = await requireOrganizationAdmin(ctx, booking.organizationId);
    const actorUserId = user._id as Id<"users">;

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
    const { organization } = await requireActiveOrganization(ctx);
    const booking = await ctx.runQuery(internal.bookingDb.getBookingById, {
      id: args.bookingId,
    });
    if (!booking) {
      throw new Error("Booking not found");
    }
    assertRecordInActiveOrg(booking.organizationId, organization._id);

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
    const { organization } = await requireActiveOrganization(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      return [];
    }
    assertRecordInActiveOrg(booking.organizationId, organization._id);

    return await ctx.db
      .query("paymentIntents")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();
  },
});

export const listBookings = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const limit = args.limit ?? 50;
    const resolvedOrganizationId = args.organizationId ?? organization._id;
    assertRecordInActiveOrg(resolvedOrganizationId, organization._id);

    if (args.status) {
      return await ctx.db
        .query("bookings")
        .withIndex("by_org_status", (q) =>
          q.eq("organizationId", resolvedOrganizationId).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("bookings")
      .withIndex("by_organization", (q) => q.eq("organizationId", resolvedOrganizationId))
      .order("desc")
      .take(limit);
  },
});
