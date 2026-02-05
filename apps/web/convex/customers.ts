import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

// ============================================================================
// Queries
// ============================================================================

export const getById = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    return await ctx.db.get(customerId);
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
  },
});

export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { organizationId, status }) => {
    let query = ctx.db.query("customers");

    if (organizationId) {
      const customers = await query
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();
      if (status) {
        return customers.filter((c) => c.status === status);
      }
      return customers;
    }

    if (status) {
      return await query
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    }

    return await query.collect();
  },
});

export const getWithDetails = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const customer = await ctx.db.get(customerId);
    if (!customer) return null;

    const [bookings, quoteRequests, bookingRequests] = await Promise.all([
      ctx.db
        .query("bookings")
        .withIndex("by_customer", (q) => q.eq("customerId", customerId))
        .collect(),
      ctx.db
        .query("quoteRequests")
        .withIndex("by_customer", (q) => q.eq("customerId", customerId))
        .collect(),
      ctx.db
        .query("bookingRequests")
        .withIndex("by_customer", (q) => q.eq("customerId", customerId))
        .collect(),
    ]);

    return {
      ...customer,
      bookings,
      quoteRequests,
      bookingRequests,
    };
  },
});

export const getBookings = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .collect();
  },
});

export const getQuoteRequests = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    return await ctx.db
      .query("quoteRequests")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .collect();
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, { query: searchQuery }) => {
    const normalizedQuery = searchQuery.toLowerCase().trim();
    if (!normalizedQuery) return [];

    const customers = await ctx.db.query("customers").collect();

    return customers.filter((customer) => {
      const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
      const email = customer.email.toLowerCase();
      return (
        fullName.includes(normalizedQuery) || email.includes(normalizedQuery)
      );
    });
  },
});

// ============================================================================
// Mutations
// ============================================================================

export const create = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    alternatePhone: v.optional(v.string()),
    address: v.optional(
      v.object({
        street: v.optional(v.string()),
        addressLine2: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        postalCode: v.optional(v.string()),
      })
    ),
    squareFootage: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    status: v.optional(v.string()),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate email
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      throw new Error("A customer with this email already exists");
    }

    const now = Date.now();
    return await ctx.db.insert("customers", {
      ...args,
      status: args.status ?? "lead",
      totalBookings: 0,
      totalSpent: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    customerId: v.id("customers"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    alternatePhone: v.optional(v.string()),
    address: v.optional(
      v.object({
        street: v.optional(v.string()),
        addressLine2: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        postalCode: v.optional(v.string()),
      })
    ),
    squareFootage: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    status: v.optional(v.string()),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
  },
  handler: async (ctx, { customerId, ...updates }) => {
    const customer = await ctx.db.get(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    // If email is being changed, check for duplicates
    if (updates.email && updates.email !== customer.email) {
      const existing = await ctx.db
        .query("customers")
        .withIndex("by_email", (q) => q.eq("email", updates.email!))
        .first();

      if (existing) {
        throw new Error("A customer with this email already exists");
      }
    }

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(customerId, {
        ...filteredUpdates,
        updatedAt: Date.now(),
      });
    }

    return customerId;
  },
});

export const reassignStripeCustomerId = internalMutation({
  args: {
    fromStripeCustomerId: v.string(),
    toStripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_stripe_id", (q) =>
        q.eq("stripeCustomerId", args.fromStripeCustomerId)
      )
      .collect();

    for (const customer of customers) {
      await ctx.db.patch(customer._id, {
        stripeCustomerId: args.toStripeCustomerId,
        updatedAt: Date.now(),
      });
    }
  },
});

export const recalculateStats = mutation({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const customer = await ctx.db.get(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .collect();

    const totalBookings = bookings.length;
    const totalSpent = bookings.reduce((sum, booking) => {
      return sum + (booking.amount ?? 0);
    }, 0);

    // Find the most recent booking date
    let lastBookingDate: number | undefined;
    for (const booking of bookings) {
      if (booking.serviceDate) {
        const date = new Date(booking.serviceDate).getTime();
        if (!lastBookingDate || date > lastBookingDate) {
          lastBookingDate = date;
        }
      }
    }

    await ctx.db.patch(customerId, {
      totalBookings,
      totalSpent,
      lastBookingDate,
      updatedAt: Date.now(),
    });

    return customerId;
  },
});
