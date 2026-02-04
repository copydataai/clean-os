import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Get bookings within a date range
 * Since there's no index on serviceDate, we fetch all bookings and filter client-side
 */
export const getBookingsByDateRange = query({
  args: {
    startDate: v.string(), // ISO date string "YYYY-MM-DD"
    endDate: v.string(),
    status: v.optional(v.string()),
    cleanerId: v.optional(v.id("cleaners")),
  },
  handler: async (ctx, { startDate, endDate, status, cleanerId }) => {
    // If filtering by cleaner, get their assignments first
    if (cleanerId) {
      const assignments = await ctx.db
        .query("bookingAssignments")
        .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
        .collect();

      const bookingIds = assignments.map((a) => a.bookingId);
      const bookings = await Promise.all(
        bookingIds.map((id) => ctx.db.get(id))
      );

      return bookings
        .filter((b): b is NonNullable<typeof b> => {
          if (!b || !b.serviceDate) return false;
          if (status && b.status !== status) return false;
          return b.serviceDate >= startDate && b.serviceDate <= endDate;
        })
        .map((b) => ({
          ...b,
          assignmentId: assignments.find((a) => a.bookingId === b._id)?._id,
        }));
    }

    // Otherwise fetch all bookings and filter by date range
    let allBookings;
    if (status) {
      allBookings = await ctx.db
        .query("bookings")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    } else {
      allBookings = await ctx.db.query("bookings").collect();
    }

    return allBookings.filter((b) => {
      if (!b.serviceDate) return false;
      return b.serviceDate >= startDate && b.serviceDate <= endDate;
    });
  },
});

/**
 * Get available cleaners for a specific date
 * Checks weekly availability and excludes cleaners with approved time off
 */
export const getAvailableCleanersForDate = query({
  args: {
    date: v.string(), // ISO date string "YYYY-MM-DD"
  },
  handler: async (ctx, { date }) => {
    // Calculate day of week (0 = Sunday, 6 = Saturday)
    const dateObj = new Date(date + "T00:00:00");
    const dayOfWeek = dateObj.getDay();

    // Get all active cleaners
    const cleaners = await ctx.db
      .query("cleaners")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Get approved time off that overlaps with this date
    const approvedTimeOff = await ctx.db
      .query("cleanerTimeOff")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    // Filter to time off that includes this date
    const timeOffOnDate = approvedTimeOff.filter((to) => {
      return to.startDate <= date && to.endDate >= date;
    });

    const cleanersOnTimeOff = new Set(timeOffOnDate.map((to) => to.cleanerId));

    // Get availability for this day of week for all cleaners
    const availabilities = await Promise.all(
      cleaners.map(async (cleaner) => {
        const availability = await ctx.db
          .query("cleanerAvailability")
          .withIndex("by_cleaner_day", (q) =>
            q.eq("cleanerId", cleaner._id).eq("dayOfWeek", dayOfWeek)
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();

        return { cleaner, availability };
      })
    );

    // Get assignment counts for the date
    const bookingsOnDate = await ctx.db.query("bookings").collect();
    const bookingsForDate = bookingsOnDate.filter((b) => b.serviceDate === date);
    const bookingIds = bookingsForDate.map((b) => b._id);

    const allAssignments = await Promise.all(
      bookingIds.map((bookingId) =>
        ctx.db
          .query("bookingAssignments")
          .withIndex("by_booking", (q) => q.eq("bookingId", bookingId))
          .collect()
      )
    );

    const assignmentsFlat = allAssignments.flat();
    const assignmentCounts = new Map<string, number>();
    for (const assignment of assignmentsFlat) {
      if (assignment.cleanerId) {
        const current = assignmentCounts.get(assignment.cleanerId) ?? 0;
        assignmentCounts.set(assignment.cleanerId, current + 1);
      }
    }

    // Build result - only cleaners available on this day who aren't on time off
    return availabilities
      .filter(({ cleaner, availability }) => {
        // Must have availability for this day
        if (!availability) return false;
        // Must not be on time off
        if (cleanersOnTimeOff.has(cleaner._id)) return false;
        return true;
      })
      .map(({ cleaner, availability }) => ({
        cleaner,
        availability: {
          startTime: availability!.startTime,
          endTime: availability!.endTime,
          timezone: availability!.timezone,
        },
        assignmentCount: assignmentCounts.get(cleaner._id) ?? 0,
      }));
  },
});

/**
 * Get a cleaner's schedule for a date range
 */
export const getCleanerScheduleRange = query({
  args: {
    cleanerId: v.id("cleaners"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { cleanerId, startDate, endDate }) => {
    // Get all assignments for this cleaner
    const assignments = await ctx.db
      .query("bookingAssignments")
      .withIndex("by_cleaner", (q) => q.eq("cleanerId", cleanerId))
      .collect();

    // Get bookings for these assignments
    const bookingIds = assignments.map((a) => a.bookingId);
    const bookings = await Promise.all(
      bookingIds.map((id) => ctx.db.get(id))
    );

    // Filter to date range and combine with assignment data
    return bookings
      .filter((b): b is NonNullable<typeof b> => {
        if (!b || !b.serviceDate) return false;
        return b.serviceDate >= startDate && b.serviceDate <= endDate;
      })
      .map((booking) => {
        const assignment = assignments.find((a) => a.bookingId === booking._id);
        return {
          booking,
          assignment,
        };
      });
  },
});
