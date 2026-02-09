import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";

const CUSTOMER_SPEND_STATUSES = new Set(["completed", "charged"]);

const ADDRESS_VALIDATOR = v.object({
  street: v.optional(v.string()),
  addressLine2: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  postalCode: v.optional(v.string()),
});

type AddressInput = {
  street?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

type LifecycleCustomerArgs = {
  organizationId?: Id<"organizations">;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  contactDetails?: string;
  phone?: string;
  alternatePhone?: string;
  address?: AddressInput;
  squareFootage?: number;
  source?: string;
  activateOnLink?: boolean;
};

function trimToUndefined(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

function toTitleWord(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function normalizeAddress(address?: AddressInput | null): AddressInput | undefined {
  if (!address) return undefined;
  const normalized: AddressInput = {
    street: trimToUndefined(address.street),
    addressLine2: trimToUndefined(address.addressLine2),
    city: trimToUndefined(address.city),
    state: trimToUndefined(address.state),
    postalCode: trimToUndefined(address.postalCode),
  };

  const hasAnyValue = Object.values(normalized).some(Boolean);
  return hasAnyValue ? normalized : undefined;
}

function splitNameFromText(value?: string): { firstName: string; lastName: string } | null {
  const normalized = trimToUndefined(value);
  if (!normalized) {
    return null;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  const firstName = toTitleWord(tokens[0]);
  const lastName = tokens.length > 1
    ? tokens.slice(1).map(toTitleWord).join(" ")
    : "Customer";

  return { firstName, lastName };
}

function deriveNameFromEmail(email: string): { firstName: string; lastName: string } {
  const localPart = normalizeEmailAddress(email).split("@")[0] ?? "";
  const tokens = localPart.split(/[._+-]+/).filter(Boolean);

  if (tokens.length === 0) {
    return {
      firstName: "Unknown",
      lastName: "Customer",
    };
  }

  const firstName = toTitleWord(tokens[0]);
  const lastName =
    tokens.length > 1
      ? tokens.slice(1).map(toTitleWord).join(" ")
      : "Customer";

  return { firstName, lastName };
}

function resolveLifecycleName(args: {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  contactDetails?: string;
}): { firstName: string; lastName: string } {
  const explicitFirst = trimToUndefined(args.firstName);
  const explicitLast = trimToUndefined(args.lastName);
  if (explicitFirst && explicitLast) {
    return {
      firstName: explicitFirst,
      lastName: explicitLast,
    };
  }

  if (explicitFirst || explicitLast) {
    return {
      firstName: explicitFirst ?? "Unknown",
      lastName: explicitLast ?? "Customer",
    };
  }

  const parsed =
    splitNameFromText(args.fullName) ??
    splitNameFromText(args.contactDetails);
  if (parsed) {
    return parsed;
  }

  return deriveNameFromEmail(args.email);
}

function isPlaceholderName(firstName: string, lastName: string): boolean {
  const first = firstName.trim().toLowerCase();
  const last = lastName.trim().toLowerCase();
  return first === "unknown" && last === "customer";
}

function chooseCanonicalCustomer(customers: Doc<"customers">[]): Doc<"customers"> {
  if (customers.length === 1) {
    return customers[0];
  }

  return [...customers].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    if (a._creationTime !== b._creationTime) {
      return a._creationTime - b._creationTime;
    }
    return String(a._id).localeCompare(String(b._id));
  })[0];
}

async function getCustomersByNormalizedEmail(
  ctx: any,
  normalizedEmail: string
): Promise<Doc<"customers">[]> {
  const indexed = await ctx.db
    .query("customers")
    .withIndex("by_email_normalized", (q: any) => q.eq("emailNormalized", normalizedEmail))
    .collect();

  const byId = new Map<string, Doc<"customers">>();
  for (const customer of indexed) {
    byId.set(String(customer._id), customer);
  }

  const exact = await ctx.db
    .query("customers")
    .withIndex("by_email", (q: any) => q.eq("email", normalizedEmail))
    .collect();
  for (const customer of exact) {
    byId.set(String(customer._id), customer);
  }

  if (byId.size === 0) {
    const all = await ctx.db.query("customers").collect();
    for (const customer of all) {
      if (normalizeEmailAddress(customer.email) === normalizedEmail) {
        byId.set(String(customer._id), customer);
      }
    }
  }

  return Array.from(byId.values());
}

function applyCustomerEnrichment(args: {
  customer: Doc<"customers">;
  normalizedEmail: string;
  incoming: LifecycleCustomerArgs;
}): Partial<Doc<"customers">> {
  const { customer, normalizedEmail, incoming } = args;
  const patch: Partial<Doc<"customers">> = {};

  if (!customer.emailNormalized) {
    patch.emailNormalized = normalizedEmail;
  }

  const resolvedName = resolveLifecycleName({
    email: incoming.email,
    firstName: incoming.firstName,
    lastName: incoming.lastName,
    fullName: incoming.fullName,
    contactDetails: incoming.contactDetails,
  });

  if (isPlaceholderName(customer.firstName, customer.lastName)) {
    patch.firstName = resolvedName.firstName;
    patch.lastName = resolvedName.lastName;
  }

  const phone = trimToUndefined(incoming.phone);
  if (phone && !customer.phone) {
    patch.phone = phone;
  }

  const alternatePhone = trimToUndefined(incoming.alternatePhone);
  if (alternatePhone && !customer.alternatePhone) {
    patch.alternatePhone = alternatePhone;
  }

  const source = trimToUndefined(incoming.source);
  if (source && !customer.source) {
    patch.source = source;
  }

  if (incoming.squareFootage !== undefined && customer.squareFootage === undefined) {
    patch.squareFootage = incoming.squareFootage;
  }

  const incomingAddress = normalizeAddress(incoming.address);
  if (incomingAddress) {
    const existingAddress = normalizeAddress(customer.address as AddressInput | undefined) ?? {};
    const mergedAddress: AddressInput = {
      street: existingAddress.street ?? incomingAddress.street,
      addressLine2: existingAddress.addressLine2 ?? incomingAddress.addressLine2,
      city: existingAddress.city ?? incomingAddress.city,
      state: existingAddress.state ?? incomingAddress.state,
      postalCode: existingAddress.postalCode ?? incomingAddress.postalCode,
    };

    const changed =
      mergedAddress.street !== existingAddress.street ||
      mergedAddress.addressLine2 !== existingAddress.addressLine2 ||
      mergedAddress.city !== existingAddress.city ||
      mergedAddress.state !== existingAddress.state ||
      mergedAddress.postalCode !== existingAddress.postalCode;

    if (changed) {
      patch.address = mergedAddress;
    }
  }

  if (incoming.activateOnLink && customer.status === "lead") {
    patch.status = "active";
  }

  return patch;
}

async function ensureLifecycleCustomerRecord(
  ctx: any,
  args: LifecycleCustomerArgs
): Promise<Id<"customers">> {
  const normalizedEmail = normalizeEmailAddress(args.email);
  const candidates = await getCustomersByNormalizedEmail(ctx, normalizedEmail);

  if (candidates.length === 0) {
    const now = Date.now();
    const resolvedName = resolveLifecycleName({
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      fullName: args.fullName,
      contactDetails: args.contactDetails,
    });

    return await ctx.db.insert("customers", {
      organizationId: args.organizationId,
      firstName: resolvedName.firstName,
      lastName: resolvedName.lastName,
      email: args.email.trim(),
      emailNormalized: normalizedEmail,
      phone: trimToUndefined(args.phone),
      alternatePhone: trimToUndefined(args.alternatePhone),
      address: normalizeAddress(args.address),
      squareFootage: args.squareFootage,
      status: args.activateOnLink ? "active" : "lead",
      source: trimToUndefined(args.source),
      totalBookings: 0,
      totalSpent: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  const canonical = chooseCanonicalCustomer(candidates);
  const patch = applyCustomerEnrichment({
    customer: canonical,
    normalizedEmail,
    incoming: args,
  });

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(canonical._id, {
      ...patch,
      updatedAt: Date.now(),
    });
  }

  return canonical._id;
}

async function recomputeCustomerStatsForId(
  ctx: any,
  customerId: Id<"customers">,
  options?: { dryRun?: boolean }
) {
  const customer = await ctx.db.get(customerId);
  if (!customer) {
    throw new Error("Customer not found");
  }

  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_customer", (q: any) => q.eq("customerId", customerId))
    .collect();

  const totalBookings = bookings.length;
  const totalSpent = bookings.reduce((sum: number, booking: any) => {
    if (!CUSTOMER_SPEND_STATUSES.has(booking.status)) {
      return sum;
    }
    return sum + (booking.amount ?? 0);
  }, 0);

  let lastBookingDate: number | undefined;
  for (const booking of bookings) {
    if (!booking.serviceDate) {
      continue;
    }
    const parsed = Date.parse(booking.serviceDate);
    if (!Number.isFinite(parsed)) {
      continue;
    }
    if (!lastBookingDate || parsed > lastBookingDate) {
      lastBookingDate = parsed;
    }
  }

  if (!options?.dryRun) {
    await ctx.db.patch(customerId, {
      totalBookings,
      totalSpent,
      lastBookingDate,
      updatedAt: Date.now(),
    });
  }

  return {
    customerId,
    totalBookings,
    totalSpent,
    lastBookingDate,
  };
}

async function requireAdminActorUserId(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required for customer backfill");
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
    throw new Error("Admin role required for customer backfill");
  }

  return user._id as Id<"users">;
}

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
    const candidates = await getCustomersByNormalizedEmail(
      ctx,
      normalizeEmailAddress(email)
    );
    if (candidates.length === 0) {
      return null;
    }
    return chooseCanonicalCustomer(candidates);
  },
});

export const list = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { organizationId, status }) => {
    const tableQuery = ctx.db.query("customers");

    if (organizationId) {
      const customers = await tableQuery
        .withIndex("by_organization", (q: any) => q.eq("organizationId", organizationId))
        .collect();
      if (status) {
        return customers.filter((customer: any) => customer.status === status);
      }
      return customers;
    }

    if (status) {
      return await tableQuery
        .withIndex("by_status", (q: any) => q.eq("status", status))
        .collect();
    }

    return await tableQuery.collect();
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
        .withIndex("by_customer", (q: any) => q.eq("customerId", customerId))
        .collect(),
      ctx.db
        .query("quoteRequests")
        .withIndex("by_customer", (q: any) => q.eq("customerId", customerId))
        .collect(),
      ctx.db
        .query("bookingRequests")
        .withIndex("by_customer", (q: any) => q.eq("customerId", customerId))
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
      .withIndex("by_customer", (q: any) => q.eq("customerId", customerId))
      .collect();
  },
});

export const getQuoteRequests = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    return await ctx.db
      .query("quoteRequests")
      .withIndex("by_customer", (q: any) => q.eq("customerId", customerId))
      .collect();
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, { query: searchQuery }) => {
    const normalizedQuery = searchQuery.toLowerCase().trim();
    if (!normalizedQuery) return [];

    const customers = await ctx.db.query("customers").collect();

    return customers.filter((customer: any) => {
      const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
      const email = customer.email.toLowerCase();
      return fullName.includes(normalizedQuery) || email.includes(normalizedQuery);
    });
  },
});

export const getCustomerLinkingHealth = query({
  args: {},
  handler: async (ctx) => {
    const [customers, quoteRequests, bookingRequests, bookings] = await Promise.all([
      ctx.db.query("customers").collect(),
      ctx.db.query("quoteRequests").collect(),
      ctx.db.query("bookingRequests").collect(),
      ctx.db.query("bookings").collect(),
    ]);

    const duplicateTracker = new Map<string, number>();
    for (const customer of customers) {
      const normalized = customer.emailNormalized ?? normalizeEmailAddress(customer.email);
      duplicateTracker.set(normalized, (duplicateTracker.get(normalized) ?? 0) + 1);
    }

    return {
      customersMissingEmailNormalized: customers.filter((customer) => !customer.emailNormalized)
        .length,
      quoteRequestsMissingCustomerWithEmail: quoteRequests.filter(
        (request) => Boolean(request.email) && !request.customerId
      ).length,
      bookingRequestsMissingCustomerWithEmail: bookingRequests.filter(
        (request) => Boolean(request.email) && !request.customerId
      ).length,
      bookingsMissingCustomerWithEmail: bookings.filter(
        (booking) => Boolean(booking.email) && !booking.customerId
      ).length,
      duplicateNormalizedEmailGroups: Array.from(duplicateTracker.values()).filter(
        (count) => count > 1
      ).length,
    };
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
    address: v.optional(ADDRESS_VALIDATOR),
    squareFootage: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    status: v.optional(v.string()),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmailAddress(args.email);
    const existing = await getCustomersByNormalizedEmail(ctx, normalizedEmail);
    if (existing.length > 0) {
      throw new Error("A customer with this email already exists");
    }

    const now = Date.now();
    return await ctx.db.insert("customers", {
      ...args,
      email: args.email.trim(),
      emailNormalized: normalizedEmail,
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
    address: v.optional(ADDRESS_VALIDATOR),
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

    if (updates.email && updates.email !== customer.email) {
      const normalizedEmail = normalizeEmailAddress(updates.email);
      const existing = await getCustomersByNormalizedEmail(ctx, normalizedEmail);
      if (existing.some((candidate) => candidate._id !== customerId)) {
        throw new Error("A customer with this email already exists");
      }
    }

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Record<string, unknown>;

    if (filteredUpdates.email) {
      filteredUpdates.email = String(filteredUpdates.email).trim();
      filteredUpdates.emailNormalized = normalizeEmailAddress(String(filteredUpdates.email));
    }

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(customerId, {
        ...filteredUpdates,
        updatedAt: Date.now(),
      });
    }

    return customerId;
  },
});

export const ensureLifecycleCustomer = internalMutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    fullName: v.optional(v.string()),
    contactDetails: v.optional(v.string()),
    phone: v.optional(v.string()),
    alternatePhone: v.optional(v.string()),
    address: v.optional(ADDRESS_VALIDATOR),
    squareFootage: v.optional(v.number()),
    source: v.optional(v.string()),
    activateOnLink: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ensureLifecycleCustomerRecord(ctx, args);
  },
});

export const linkLifecycleRecordsToCustomer = internalMutation({
  args: {
    customerId: v.id("customers"),
    quoteRequestId: v.optional(v.id("quoteRequests")),
    bookingRequestId: v.optional(v.id("bookingRequests")),
    bookingId: v.optional(v.id("bookings")),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const now = Date.now();
    let quoteRequestsPatched = 0;
    let bookingRequestsPatched = 0;
    let bookingsPatched = 0;

    if (args.quoteRequestId) {
      const quoteRequest = await ctx.db.get(args.quoteRequestId);
      if (quoteRequest && quoteRequest.customerId !== args.customerId) {
        await ctx.db.patch(args.quoteRequestId, {
          customerId: args.customerId,
          updatedAt: now,
        });
        quoteRequestsPatched += 1;
      }
    }

    if (args.bookingRequestId) {
      const bookingRequest = await ctx.db.get(args.bookingRequestId);
      if (bookingRequest && bookingRequest.customerId !== args.customerId) {
        await ctx.db.patch(args.bookingRequestId, {
          customerId: args.customerId,
          updatedAt: now,
        });
        bookingRequestsPatched += 1;
      }
    }

    if (args.bookingId) {
      const booking = await ctx.db.get(args.bookingId);
      if (booking && booking.customerId !== args.customerId) {
        await ctx.db.patch(args.bookingId, {
          customerId: args.customerId,
          updatedAt: now,
        });
        bookingsPatched += 1;
      }
    }

    return {
      customerId: args.customerId,
      quoteRequestsPatched,
      bookingRequestsPatched,
      bookingsPatched,
    };
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
      .withIndex("by_stripe_id", (q: any) =>
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

export const recomputeStatsInternal = internalMutation({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    return await recomputeCustomerStatsForId(ctx, customerId);
  },
});

export const recalculateStats = mutation({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    await ctx.runMutation(internal.customers.recomputeStatsInternal, {
      customerId,
    });
    return customerId;
  },
});

export const backfillCustomerLinking = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    recomputeAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const recomputeAll = args.recomputeAll ?? true;

    const summary = {
      dryRun,
      recomputeAll,
      customersScanned: 0,
      customersNormalizedPatched: 0,
      duplicateNormalizedEmailGroups: 0,
      customersCreated: 0,
      quoteRequestsScanned: 0,
      bookingRequestsScanned: 0,
      bookingsScanned: 0,
      quoteRequestsLinked: 0,
      bookingRequestsLinked: 0,
      bookingsLinked: 0,
      relationshipFixes: 0,
      statsRecomputed: 0,
      unresolvedRowsWithoutCanonical: 0,
    };

    const affectedCustomerIds = new Set<Id<"customers">>();

    const customers = await ctx.db.query("customers").collect();
    summary.customersScanned = customers.length;

    const grouped = new Map<string, Doc<"customers">[]>();
    for (const customer of customers) {
      const normalized = customer.emailNormalized ?? normalizeEmailAddress(customer.email);
      const list = grouped.get(normalized) ?? [];
      list.push(customer);
      grouped.set(normalized, list);

      if (!customer.emailNormalized || customer.emailNormalized !== normalized) {
        summary.customersNormalizedPatched += 1;
        if (!dryRun) {
          await ctx.db.patch(customer._id, {
            emailNormalized: normalized,
            updatedAt: Date.now(),
          });
        }
      }
    }

    const canonicalByNormalized = new Map<string, Id<"customers">>();
    for (const [normalized, entries] of grouped.entries()) {
      if (entries.length > 1) {
        summary.duplicateNormalizedEmailGroups += 1;
      }
      canonicalByNormalized.set(normalized, chooseCanonicalCustomer(entries)._id);
    }

    const resolveCanonicalCustomerId = async (seed: {
      email?: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
      contactDetails?: string;
      phone?: string;
      address?: AddressInput;
      source?: string;
      activateOnLink?: boolean;
    }): Promise<Id<"customers"> | null> => {
      if (!seed.email) {
        return null;
      }

      const normalized = normalizeEmailAddress(seed.email);
      const existing = canonicalByNormalized.get(normalized);
      if (existing) {
        return existing;
      }

      if (dryRun) {
        summary.unresolvedRowsWithoutCanonical += 1;
        return null;
      }

      const customerId = await ensureLifecycleCustomerRecord(ctx, {
        email: seed.email,
        firstName: seed.firstName,
        lastName: seed.lastName,
        fullName: seed.fullName,
        contactDetails: seed.contactDetails,
        phone: seed.phone,
        address: seed.address,
        source: seed.source,
        activateOnLink: seed.activateOnLink,
      });

      canonicalByNormalized.set(normalized, customerId);
      summary.customersCreated += 1;
      return customerId;
    };

    const quoteRequests = await ctx.db.query("quoteRequests").collect();
    summary.quoteRequestsScanned = quoteRequests.length;
    for (const quoteRequest of quoteRequests) {
      if (!quoteRequest.email) {
        continue;
      }
      const canonicalCustomerId = await resolveCanonicalCustomerId({
        email: quoteRequest.email,
        firstName: quoteRequest.firstName,
        lastName: quoteRequest.lastName,
        phone: quoteRequest.phone,
        address: normalizeAddress({
          street: quoteRequest.address,
          addressLine2: quoteRequest.addressLine2,
          city: quoteRequest.city,
          state: quoteRequest.state,
          postalCode: quoteRequest.postalCode,
        }),
        source: "quote_request",
      });
      if (!canonicalCustomerId) {
        continue;
      }
      if (quoteRequest.customerId !== canonicalCustomerId) {
        summary.quoteRequestsLinked += 1;
        affectedCustomerIds.add(canonicalCustomerId);
        if (!dryRun) {
          await ctx.db.patch(quoteRequest._id, {
            customerId: canonicalCustomerId,
            updatedAt: Date.now(),
          });
        }
      }
    }

    const bookingRequests = await ctx.db.query("bookingRequests").collect();
    summary.bookingRequestsScanned = bookingRequests.length;
    for (const bookingRequest of bookingRequests) {
      if (!bookingRequest.email) {
        continue;
      }
      const canonicalCustomerId = await resolveCanonicalCustomerId({
        email: bookingRequest.email,
        contactDetails: bookingRequest.contactDetails,
        phone: bookingRequest.phoneNumber,
        source: "booking_request",
      });
      if (!canonicalCustomerId) {
        continue;
      }
      if (bookingRequest.customerId !== canonicalCustomerId) {
        summary.bookingRequestsLinked += 1;
        affectedCustomerIds.add(canonicalCustomerId);
        if (!dryRun) {
          await ctx.db.patch(bookingRequest._id, {
            customerId: canonicalCustomerId,
            updatedAt: Date.now(),
          });
        }
      }
    }

    const bookings = await ctx.db.query("bookings").collect();
    summary.bookingsScanned = bookings.length;
    for (const booking of bookings) {
      const canonicalCustomerId = await resolveCanonicalCustomerId({
        email: booking.email,
        fullName: booking.customerName,
        source: "booking",
        activateOnLink: true,
      });
      if (!canonicalCustomerId) {
        continue;
      }
      if (booking.customerId !== canonicalCustomerId) {
        summary.bookingsLinked += 1;
        affectedCustomerIds.add(canonicalCustomerId);
        if (!dryRun) {
          await ctx.db.patch(booking._id, {
            customerId: canonicalCustomerId,
            updatedAt: Date.now(),
          });
        }
      }
    }

    const [quoteRequestsAfter, bookingRequestsAfter, bookingsAfter] = dryRun
      ? [quoteRequests, bookingRequests, bookings]
      : await Promise.all([
          ctx.db.query("quoteRequests").collect(),
          ctx.db.query("bookingRequests").collect(),
          ctx.db.query("bookings").collect(),
        ]);

    const quoteById = new Map(quoteRequestsAfter.map((row) => [row._id, row]));
    const bookingRequestById = new Map(bookingRequestsAfter.map((row) => [row._id, row]));

    for (const booking of bookingsAfter) {
      if (!booking.bookingRequestId) {
        continue;
      }
      const bookingRequest = bookingRequestById.get(booking.bookingRequestId);
      if (!bookingRequest) {
        continue;
      }

      const targetCustomerId =
        booking.customerId ??
        bookingRequest.customerId ??
        (booking.email
          ? await resolveCanonicalCustomerId({
              email: booking.email,
              fullName: booking.customerName,
              source: "booking",
              activateOnLink: true,
            })
          : null);

      if (!targetCustomerId) {
        continue;
      }

      const quoteRequest = bookingRequest.quoteRequestId
        ? quoteById.get(bookingRequest.quoteRequestId)
        : null;

      if (booking.customerId !== targetCustomerId) {
        summary.relationshipFixes += 1;
        affectedCustomerIds.add(targetCustomerId);
        if (!dryRun) {
          await ctx.db.patch(booking._id, {
            customerId: targetCustomerId,
            updatedAt: Date.now(),
          });
        }
      }

      if (bookingRequest.customerId !== targetCustomerId) {
        summary.relationshipFixes += 1;
        affectedCustomerIds.add(targetCustomerId);
        if (!dryRun) {
          await ctx.db.patch(bookingRequest._id, {
            customerId: targetCustomerId,
            updatedAt: Date.now(),
          });
        }
      }

      if (quoteRequest && quoteRequest.customerId !== targetCustomerId) {
        summary.relationshipFixes += 1;
        affectedCustomerIds.add(targetCustomerId);
        if (!dryRun) {
          await ctx.db.patch(quoteRequest._id, {
            customerId: targetCustomerId,
            updatedAt: Date.now(),
          });
        }
      }
    }

    const customersForStats = recomputeAll
      ? await ctx.db.query("customers").collect()
      : await Promise.all(
          Array.from(affectedCustomerIds).map((customerId) => ctx.db.get(customerId))
        );

    for (const customer of customersForStats) {
      if (!customer) {
        continue;
      }
      await recomputeCustomerStatsForId(ctx, customer._id, {
        dryRun,
      });
      summary.statsRecomputed += 1;
    }

    return summary;
  },
});

export const runCustomerLinkingBackfill: any = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    recomputeAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<any> => {
    await requireAdminActorUserId(ctx);
    return await ctx.runMutation(internal.customers.backfillCustomerLinking, {
      dryRun: args.dryRun,
      recomputeAll: args.recomputeAll,
    });
  },
});
