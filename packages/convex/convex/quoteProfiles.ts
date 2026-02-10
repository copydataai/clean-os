import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireActiveOrganization } from "./lib/orgContext";

const DEFAULT_PROFILE_KEY = "kathy_clean_default";

const DEFAULT_PROFILE = {
  key: DEFAULT_PROFILE_KEY,
  displayName: "Kathy Clean",
  legalName: "Kathy Clean",
  phone: "303-681-2559",
  email: "commercial@kathyclean.com",
  website: "https://kathyclean.com/",
  addressLine1: "7500 East Arapahoe Road",
  addressLine2: "Suite 200",
  city: "Centennial",
  state: "Colorado",
  postalCode: "80112",
  country: "USA",
  defaultCurrency: "usd",
  defaultTaxName: "Colorado",
  defaultTaxRateBps: 0,
  quoteValidityDays: 30,
} as const;

export const ensureDefaultProfile = internalMutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const existing = args.organizationId
      ? await ctx.db
          .query("quoteProfiles")
          .withIndex("by_org_key", (q) =>
            q.eq("organizationId", args.organizationId).eq("key", DEFAULT_PROFILE_KEY)
          )
          .first()
      : await ctx.db
          .query("quoteProfiles")
          .withIndex("by_key", (q) => q.eq("key", DEFAULT_PROFILE_KEY))
          .first();

    const now = Date.now();
    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("quoteProfiles", {
      organizationId: args.organizationId,
      ...DEFAULT_PROFILE,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getActiveProfile = query({
  args: {},
  handler: async (ctx) => {
    const { organization } = await requireActiveOrganization(ctx);

    const byKey = await ctx.db
      .query("quoteProfiles")
      .withIndex("by_org_key", (q) =>
        q.eq("organizationId", organization._id).eq("key", DEFAULT_PROFILE_KEY)
      )
      .first();

    if (byKey) {
      return byKey;
    }

    return await ctx.db
      .query("quoteProfiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
      .first();
  },
});

export const updateProfile = mutation({
  args: {
    key: v.optional(v.string()),
    displayName: v.optional(v.string()),
    legalName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    defaultCurrency: v.optional(v.string()),
    defaultTaxName: v.optional(v.string()),
    defaultTaxRateBps: v.optional(v.number()),
    quoteValidityDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);

    let profile =
      (args.key
        ? await ctx.db
            .query("quoteProfiles")
            .withIndex("by_org_key", (q) =>
              q.eq("organizationId", organization._id).eq("key", args.key!)
            )
            .first()
        : null) ??
      (await ctx.db
        .query("quoteProfiles")
        .withIndex("by_org_key", (q) =>
          q.eq("organizationId", organization._id).eq("key", DEFAULT_PROFILE_KEY)
        )
        .first()) ??
      (await ctx.db
        .query("quoteProfiles")
        .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
        .first());

    const now = Date.now();
    if (!profile) {
      const key = args.key ?? DEFAULT_PROFILE_KEY;
      const id = await ctx.db.insert("quoteProfiles", {
        organizationId: organization._id,
        key,
        displayName: args.displayName ?? DEFAULT_PROFILE.displayName,
        legalName: args.legalName ?? DEFAULT_PROFILE.legalName,
        phone: args.phone ?? DEFAULT_PROFILE.phone,
        email: args.email ?? DEFAULT_PROFILE.email,
        website: args.website ?? DEFAULT_PROFILE.website,
        addressLine1: args.addressLine1 ?? DEFAULT_PROFILE.addressLine1,
        addressLine2: args.addressLine2 ?? DEFAULT_PROFILE.addressLine2,
        city: args.city ?? DEFAULT_PROFILE.city,
        state: args.state ?? DEFAULT_PROFILE.state,
        postalCode: args.postalCode ?? DEFAULT_PROFILE.postalCode,
        country: args.country ?? DEFAULT_PROFILE.country,
        defaultCurrency: args.defaultCurrency ?? DEFAULT_PROFILE.defaultCurrency,
        defaultTaxName: args.defaultTaxName ?? DEFAULT_PROFILE.defaultTaxName,
        defaultTaxRateBps: args.defaultTaxRateBps ?? DEFAULT_PROFILE.defaultTaxRateBps,
        quoteValidityDays: args.quoteValidityDays ?? DEFAULT_PROFILE.quoteValidityDays,
        createdAt: now,
        updatedAt: now,
      });
      return await ctx.db.get(id);
    }

    const patch = Object.fromEntries(
      Object.entries(args).filter(([, value]) => value !== undefined)
    );
    await ctx.db.patch(profile._id, {
      ...patch,
      updatedAt: now,
    });
    profile = await ctx.db.get(profile._id);
    return profile;
  },
});
