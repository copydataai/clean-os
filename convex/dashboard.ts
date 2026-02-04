import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get dashboard statistics for the current user
 * Returns revenue, job counts, active clients, and pending bookings
 */
export const getStats = query({
  args: {},
  returns: v.object({
    revenueThisMonthCents: v.number(),
    jobsCompletedThisMonth: v.number(),
    activeClients: v.number(),
    pendingBookings: v.number(),
    jobsScheduledToday: v.number(),
    pendingRequests: v.number(),
    confirmedRequests: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthTs = startOfMonth.getTime();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    // Get all bookings
    const allBookings = await ctx.db.query("bookings").collect();

    // Revenue: sum of completed/charged bookings this month
    const completedThisMonth = allBookings.filter(
      (b) =>
        (b.status === "completed" || b.status === "charged") &&
        b.updatedAt >= startOfMonthTs
    );
    const revenueThisMonthCents = completedThisMonth.reduce(
      (sum, b) => sum + (b.amount ?? 0),
      0
    );

    // Jobs completed this month
    const jobsCompletedThisMonth = completedThisMonth.length;

    // Active clients: distinct emails ever seen
    const uniqueEmails = new Set(allBookings.map((b) => b.email));
    const activeClients = uniqueEmails.size;

    // Pending bookings: status is "pending_card"
    const pendingBookings = allBookings.filter(
      (b) => b.status === "pending_card"
    ).length;

    const allRequests = await ctx.db.query("bookingRequests").collect();
    const pendingRequests = allRequests.filter((r) => r.status === "requested").length;
    const confirmedRequests = allRequests.filter((r) => r.status === "confirmed").length;

    // Jobs scheduled today (by serviceDate if available)
    const todayStr = new Date().toISOString().split("T")[0];
    const jobsScheduledToday = allBookings.filter(
      (b) => b.serviceDate && b.serviceDate.startsWith(todayStr)
    ).length;

    return {
      revenueThisMonthCents,
      jobsCompletedThisMonth,
      activeClients,
      pendingBookings,
      jobsScheduledToday,
      pendingRequests,
      confirmedRequests,
    };
  },
});

/**
 * Get recent bookings for the dashboard
 */
export const getRecentBookings = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("bookings"),
      _creationTime: v.number(),
      customerName: v.optional(v.string()),
      email: v.string(),
      serviceType: v.optional(v.string()),
      serviceDate: v.optional(v.string()),
      status: v.string(),
      amount: v.optional(v.number()),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;

    const bookings = await ctx.db
      .query("bookings")
      .order("desc")
      .take(limit);

    return bookings.map((b) => ({
      _id: b._id,
      _creationTime: b._creationTime,
      customerName: b.customerName,
      email: b.email,
      serviceType: b.serviceType,
      serviceDate: b.serviceDate,
      status: b.status,
      amount: b.amount,
      updatedAt: b.updatedAt,
    }));
  },
});

/**
 * Get today's schedule - bookings scheduled for today
 */
export const getTodaysSchedule = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("bookings"),
      customerName: v.optional(v.string()),
      email: v.string(),
      serviceType: v.optional(v.string()),
      serviceDate: v.optional(v.string()),
      status: v.string(),
      amount: v.optional(v.number()),
      notes: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const todayStr = new Date().toISOString().split("T")[0];

    // Get bookings scheduled for today (by serviceDate)
    const bookings = await ctx.db
      .query("bookings")
      .filter((q) => q.eq(q.field("serviceDate"), todayStr))
      .collect();

    return bookings.map((b) => ({
      _id: b._id,
      customerName: b.customerName,
      email: b.email,
      serviceType: b.serviceType,
      serviceDate: b.serviceDate,
      status: b.status,
      amount: b.amount,
      notes: b.notes,
    }));
  },
});
