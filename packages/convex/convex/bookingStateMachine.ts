import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const BOOKING_OPERATIONAL_STATUSES = [
  "pending_card",
  "card_saved",
  "scheduled",
  "in_progress",
  "completed",
  "payment_failed",
  "charged",
  "cancelled",
] as const;

const LEGACY_BOOKING_OPERATIONAL_STATUSES = ["failed"] as const;

type BookingOperationalStatus = (typeof BOOKING_OPERATIONAL_STATUSES)[number];
type BookingOperationalStatusWithLegacy =
  | BookingOperationalStatus
  | (typeof LEGACY_BOOKING_OPERATIONAL_STATUSES)[number];

export const BOOKING_FUNNEL_STAGES = [
  "requested",
  "quoted",
  "confirmed",
  "card_saved",
  "scheduled",
  "in_progress",
  "service_completed",
  "payment_failed",
  "charged",
  "cancelled",
] as const;

export type BookingFunnelStage = (typeof BOOKING_FUNNEL_STAGES)[number];

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

const ALLOWED_TRANSITIONS: Record<BookingOperationalStatus, BookingOperationalStatus[]> = {
  pending_card: ["card_saved", "cancelled"],
  card_saved: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "card_saved", "cancelled"],
  in_progress: ["completed"],
  completed: ["charged", "payment_failed"],
  payment_failed: ["charged"],
  charged: [],
  cancelled: [],
};

const SCHEDULE_BLOCKING_ASSIGNMENT_STATUSES = new Set(["declined", "cancelled", "no_show"]);
const INACTIVE_ASSIGNMENT_STATUSES = new Set(["declined", "cancelled", "no_show"]);
const OVERRIDE_ALLOWED_SOURCES = new Set([
  "bookings.adminOverrideBookingStatus",
  "backfill_and_validate",
]);

function isStrictModeEnabled(): boolean {
  return process.env.BOOKING_STATE_MACHINE_STRICT === "true";
}

function isKnownBookingStatus(status: string): status is BookingOperationalStatusWithLegacy {
  return (
    (BOOKING_OPERATIONAL_STATUSES as readonly string[]).includes(status) ||
    (LEGACY_BOOKING_OPERATIONAL_STATUSES as readonly string[]).includes(status)
  );
}

function canTransition(
  fromStatus: string,
  toStatus: BookingOperationalStatus
): boolean {
  if (fromStatus === "failed" && toStatus === "payment_failed") {
    return true;
  }

  if (!(BOOKING_OPERATIONAL_STATUSES as readonly string[]).includes(fromStatus)) {
    return false;
  }

  const allowed = ALLOWED_TRANSITIONS[fromStatus as BookingOperationalStatus] ?? [];
  return allowed.includes(toStatus);
}

export function mapOperationalStatusToFunnel(status: string): BookingFunnelStage | null {
  switch (status) {
    case "pending_card":
      return "confirmed";
    case "card_saved":
      return "card_saved";
    case "scheduled":
      return "scheduled";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "service_completed";
    case "payment_failed":
    case "failed":
      return "payment_failed";
    case "charged":
      return "charged";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

export const getBookingFunnelStage = internalQuery({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) {
      return null;
    }

    return {
      bookingId,
      operationalStatus: booking.status,
      funnelStage: mapOperationalStatusToFunnel(booking.status),
    };
  },
});

export const appendLifecycleEvent = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    eventType: v.string(),
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    reason: v.optional(v.string()),
    source: v.string(),
    actorUserId: v.optional(v.id("users")),
    fromServiceDate: v.optional(v.string()),
    toServiceDate: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bookingLifecycleEvents", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const transitionBookingStatus = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    toStatus: BOOKING_STATUS_VALIDATOR,
    source: v.string(),
    reason: v.optional(v.string()),
    actorUserId: v.optional(v.id("users")),
    metadata: v.optional(v.any()),
    allowOverride: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    const fromStatus = booking.status;
    const toStatus = args.toStatus;

    if (fromStatus === toStatus) {
      return {
        bookingId: args.bookingId,
        fromStatus,
        toStatus,
        changed: false,
      };
    }

    const strictMode = isStrictModeEnabled();
    const allowOverride = args.allowOverride === true;

    if (allowOverride && !args.reason) {
      throw new Error("Override transitions require a reason");
    }

    if (allowOverride && !OVERRIDE_ALLOWED_SOURCES.has(args.source)) {
      throw new Error(`Override transition source is not allowed: ${args.source}`);
    }

    if (allowOverride && args.source !== "backfill_and_validate" && !args.actorUserId) {
      throw new Error("Override transitions require actorUserId");
    }

    const validTransition = canTransition(fromStatus, toStatus);
    const knownStatus = isKnownBookingStatus(fromStatus);

    if ((!knownStatus || !validTransition) && !allowOverride && strictMode) {
      throw new Error(
        `Invalid booking transition from ${fromStatus} to ${toStatus} (source: ${args.source})`
      );
    }

    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: toStatus,
      updatedAt: now,
    };

    if (toStatus === "cancelled") {
      patch.cancelledAt = now;
      patch.cancelledBy = args.actorUserId;
      patch.cancellationReason = args.reason;
    }

    if (toStatus !== "cancelled") {
      patch.cancelledAt = undefined;
      patch.cancelledBy = undefined;
      patch.cancellationReason = undefined;
    }

    await ctx.db.patch(args.bookingId, patch);

    const eventType = allowOverride
      ? "override_transition"
      : knownStatus && validTransition
        ? "transition"
        : "legacy_transition";

    await ctx.db.insert("bookingLifecycleEvents", {
      bookingId: args.bookingId,
      eventType,
      fromStatus,
      toStatus,
      reason: args.reason,
      source: args.source,
      actorUserId: args.actorUserId,
      fromServiceDate: booking.serviceDate,
      toServiceDate: booking.serviceDate,
      metadata: {
        ...(args.metadata ?? {}),
        strictMode,
        validTransition,
        knownStatus,
      },
      createdAt: now,
    });

    const affectsCustomerStats =
      (fromStatus === "completed" ||
        fromStatus === "charged" ||
        toStatus === "completed" ||
        toStatus === "charged") &&
      Boolean(booking.customerId);

    if (affectsCustomerStats && booking.customerId) {
      await ctx.runMutation(internal.customers.recomputeStatsInternal, {
        customerId: booking.customerId,
      });
    }

    return {
      bookingId: args.bookingId,
      fromStatus,
      toStatus,
      changed: true,
      strictMode,
      validTransition,
    };
  },
});

export const getScheduleGateState = internalQuery({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) {
      return null;
    }

    const assignments = await ctx.db
      .query("bookingAssignments")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .collect();

    const hasServiceDate = Boolean(booking.serviceDate);
    const hasServiceWindow = Boolean(booking.serviceWindowStart || booking.serviceWindowEnd);
    const hasQualifyingAssignment = assignments.some(
      (assignment) => !SCHEDULE_BLOCKING_ASSIGNMENT_STATUSES.has(assignment.status)
    );

    return {
      bookingId,
      hasServiceDate,
      hasServiceWindow,
      hasQualifyingAssignment,
      eligible: hasServiceDate && hasServiceWindow && hasQualifyingAssignment,
      assignmentCount: assignments.length,
      status: booking.status,
    };
  },
});

export const recomputeScheduledState = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    source: v.optional(v.string()),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<any> => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      return {
        changed: false,
        reason: "booking_not_found",
      };
    }

    if (
      booking.status === "cancelled" ||
      booking.status === "in_progress" ||
      booking.status === "completed" ||
      booking.status === "payment_failed" ||
      booking.status === "charged"
    ) {
      return {
        changed: false,
        reason: "status_locked",
        status: booking.status,
      };
    }

    const gate = await ctx.runQuery(internal.bookingStateMachine.getScheduleGateState, {
      bookingId: args.bookingId,
    });

    if (!gate) {
      return {
        changed: false,
        reason: "booking_not_found",
      };
    }

    const source = args.source ?? "schedule_gate_recompute";

    if (booking.status === "card_saved" && gate.eligible) {
      const result: any = await ctx.runMutation(
        internal.bookingStateMachine.transitionBookingStatus,
        {
          bookingId: args.bookingId,
          toStatus: "scheduled",
          source,
          reason: "schedule_gate_satisfied",
          actorUserId: args.actorUserId,
        }
      );

      return {
        changed: Boolean(result.changed),
        reason: "promoted_to_scheduled",
        status: "scheduled",
        gate,
      };
    }

    if (booking.status === "scheduled" && !gate.eligible) {
      const result: any = await ctx.runMutation(
        internal.bookingStateMachine.transitionBookingStatus,
        {
          bookingId: args.bookingId,
          toStatus: "card_saved",
          source,
          reason: "schedule_gate_unsatisfied",
          actorUserId: args.actorUserId,
        }
      );

      return {
        changed: Boolean(result.changed),
        reason: "demoted_to_card_saved",
        status: "card_saved",
        gate,
      };
    }

    return {
      changed: false,
      reason: "no_transition",
      status: booking.status,
      gate,
    };
  },
});

export const syncBookingStatusFromAssignments = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    source: v.optional(v.string()),
    actorUserId: v.optional(v.id("users")),
    triggerAssignmentId: v.optional(v.id("bookingAssignments")),
  },
  handler: async (ctx, args): Promise<any> => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      return { changed: false, reason: "booking_not_found" };
    }

    if (
      booking.status === "cancelled" ||
      booking.status === "completed" ||
      booking.status === "payment_failed" ||
      booking.status === "charged"
    ) {
      return {
        changed: false,
        reason: "status_locked",
        status: booking.status,
      };
    }

    const assignments = await ctx.db
      .query("bookingAssignments")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();

    const activeAssignments = assignments.filter(
      (assignment) => !INACTIVE_ASSIGNMENT_STATUSES.has(assignment.status)
    );
    const anyInProgress = activeAssignments.some(
      (assignment) => assignment.status === "in_progress"
    );
    const allActiveCompleted =
      activeAssignments.length > 0 &&
      activeAssignments.every((assignment) => assignment.status === "completed");

    let currentStatus = booking.status;
    let changed = false;
    const source = args.source ?? "bookingStateMachine.syncBookingStatusFromAssignments";

    const metadata = {
      assignmentCount: assignments.length,
      activeAssignmentCount: activeAssignments.length,
      anyInProgress,
      allActiveCompleted,
      triggerAssignmentId: args.triggerAssignmentId,
    };

    if (currentStatus === "scheduled" && (anyInProgress || allActiveCompleted)) {
      const result: any = await ctx.runMutation(
        internal.bookingStateMachine.transitionBookingStatus,
        {
          bookingId: args.bookingId,
          toStatus: "in_progress",
          source,
          reason: anyInProgress
            ? "assignment_started"
            : "assignment_completion_rollup",
          actorUserId: args.actorUserId,
          metadata,
        }
      );
      changed = changed || Boolean(result.changed);
      currentStatus = "in_progress";
    }

    if (currentStatus === "in_progress" && allActiveCompleted) {
      const result: any = await ctx.runMutation(
        internal.bookingStateMachine.transitionBookingStatus,
        {
          bookingId: args.bookingId,
          toStatus: "completed",
          source,
          reason: "all_active_assignments_completed",
          actorUserId: args.actorUserId,
          metadata,
        }
      );
      changed = changed || Boolean(result.changed);
      currentStatus = "completed";
    }

    return {
      changed,
      status: currentStatus,
      reason: changed ? "assignment_rollup_transitioned" : "no_transition",
      assignmentCount: assignments.length,
      activeAssignmentCount: activeAssignments.length,
      anyInProgress,
      allActiveCompleted,
    };
  },
});

export const listBookingsForBackfill = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit }) => {
    const capped = Math.min(Math.max(limit ?? 5000, 1), 20000);
    return await ctx.db.query("bookings").order("desc").take(capped);
  },
});

export const getLifecycleEventsByBooking = internalQuery({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, { bookingId }) => {
    return await ctx.db
      .query("bookingLifecycleEvents")
      .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
      .collect();
  },
});

export const backfillAndValidate = internalAction({
  args: {
    dryRun: v.optional(v.boolean()),
    appendBaselineEvents: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    const dryRun = args.dryRun ?? true;
    const appendBaselineEvents = args.appendBaselineEvents ?? false;
    const strictMode = isStrictModeEnabled();

    const bookings: any[] = await ctx.runQuery(internal.bookingStateMachine.listBookingsForBackfill, {
      limit: args.limit,
    });

    const invalidStatuses: Array<{ bookingId: Id<"bookings">; status: string }> = [];
    const unresolvedLegacyFailed: Array<Id<"bookings">> = [];
    const scheduleGateViolations: Array<Id<"bookings">> = [];

    let convertedLegacyFailed = 0;
    let baselineEventsCreated = 0;

    for (const booking of bookings) {
      const status = booking.status;

      if (!isKnownBookingStatus(status)) {
        invalidStatuses.push({ bookingId: booking._id, status });
      }

      if (status === "failed") {
        const paymentIntents = await ctx.runQuery(internal.bookingDb.getPaymentIntentsByBooking, {
          bookingId: booking._id,
        });

        const hasFailureEvidence = paymentIntents.some((pi: any) =>
          ["failed", "requires_action", "canceled", "requires_payment_method"].includes(
            pi.status
          )
        );

        if (!hasFailureEvidence) {
          unresolvedLegacyFailed.push(booking._id);
        } else {
          convertedLegacyFailed += 1;
          if (!dryRun) {
            await ctx.runMutation(internal.bookingStateMachine.transitionBookingStatus, {
              bookingId: booking._id,
              toStatus: "payment_failed",
              source: "backfill_and_validate",
              reason: "migrate_legacy_failed_status",
              allowOverride: true,
              metadata: {
                previousStatus: "failed",
              },
            });
          }
        }
      }

      if (status === "scheduled") {
        const gate = await ctx.runQuery(internal.bookingStateMachine.getScheduleGateState, {
          bookingId: booking._id,
        });
        if (gate && !gate.eligible) {
          scheduleGateViolations.push(booking._id);
        }
      }

      if (appendBaselineEvents && !dryRun) {
        const existingEvents = await ctx.runQuery(
          internal.bookingStateMachine.getLifecycleEventsByBooking,
          {
            bookingId: booking._id,
          }
        );
        if (existingEvents.length === 0) {
          await ctx.runMutation(internal.bookingStateMachine.appendLifecycleEvent, {
            bookingId: booking._id,
            eventType: "baseline",
            fromStatus: booking.status,
            toStatus: booking.status,
            source: "backfill_and_validate",
            reason: "baseline_event_seed",
            fromServiceDate: booking.serviceDate,
            toServiceDate: booking.serviceDate,
            metadata: {
              backfill: true,
            },
          });
          baselineEventsCreated += 1;
        }
      }
    }

    return {
      dryRun,
      strictMode,
      scanned: bookings.length,
      convertedLegacyFailed,
      unresolvedLegacyFailedCount: unresolvedLegacyFailed.length,
      invalidStatusCount: invalidStatuses.length,
      scheduleGateViolationCount: scheduleGateViolations.length,
      baselineEventsCreated,
      unresolvedLegacyFailed,
      invalidStatuses,
      scheduleGateViolations,
      readyForStrictMode:
        invalidStatuses.length === 0 &&
        unresolvedLegacyFailed.length === 0 &&
        scheduleGateViolations.length === 0,
    };
  },
});
