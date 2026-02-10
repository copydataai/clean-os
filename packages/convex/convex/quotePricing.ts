import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  assertRecordInActiveOrg,
  requireActiveOrganization,
} from "./lib/orgContext";

const DEFAULT_RULES = [
  {
    serviceType: "Deep Cleaning",
    frequency: "One-time",
    minSqft: 0,
    maxSqft: 1200,
    priceCents: 22000,
    sortOrder: 1,
  },
  {
    serviceType: "Deep Cleaning",
    frequency: "One-time",
    minSqft: 1201,
    maxSqft: 2200,
    priceCents: 32000,
    sortOrder: 2,
  },
  {
    serviceType: "Move Out Cleaning",
    frequency: "One-time",
    minSqft: 0,
    maxSqft: 1500,
    priceCents: 26000,
    sortOrder: 3,
  },
  {
    serviceType: "Move Out Cleaning",
    frequency: "One-time",
    minSqft: 1501,
    maxSqft: 2500,
    priceCents: 36000,
    sortOrder: 4,
  },
  {
    serviceType: "Bi-Weekly Cleaning",
    frequency: "Bi-weekly",
    minSqft: 0,
    maxSqft: 1200,
    priceCents: 12500,
    sortOrder: 5,
  },
  {
    serviceType: "Bi-Weekly Cleaning",
    frequency: "Bi-weekly",
    minSqft: 1201,
    maxSqft: 2200,
    priceCents: 17500,
    sortOrder: 6,
  },
  {
    serviceType: "Weekly Cleaning",
    frequency: "Weekly",
    minSqft: 0,
    maxSqft: 1200,
    priceCents: 11500,
    sortOrder: 7,
  },
  {
    serviceType: "Monthly Cleaning",
    frequency: "Monthly",
    minSqft: 0,
    maxSqft: 1200,
    priceCents: 14500,
    sortOrder: 8,
  },
] as const;

function normalize(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .trim();
}

export const ensureDefaultRules = internalMutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const existing = args.organizationId
      ? await ctx.db
          .query("quotePricingRules")
          .withIndex("by_org_active", (q) =>
            q.eq("organizationId", args.organizationId).eq("isActive", true)
          )
          .first()
      : await ctx.db
          .query("quotePricingRules")
          .withIndex("by_active", (q) => q.eq("isActive", true))
          .first();

    if (existing) {
      return;
    }

    const now = Date.now();
    for (const rule of DEFAULT_RULES) {
      await ctx.db.insert("quotePricingRules", {
        organizationId: args.organizationId,
        ...rule,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const { organization } = await requireActiveOrganization(ctx);
    const existing = await ctx.db
      .query("quotePricingRules")
      .withIndex("by_org_active", (q) =>
        q.eq("organizationId", organization._id).eq("isActive", true)
      )
      .first();

    if (existing) {
      return { seeded: false };
    }

    const now = Date.now();
    for (const rule of DEFAULT_RULES) {
      await ctx.db.insert("quotePricingRules", {
        organizationId: organization._id,
        ...rule,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { seeded: true };
  },
});

export const listRules = query({
  args: {},
  handler: async (ctx) => {
    const { organization } = await requireActiveOrganization(ctx);

    const rules = await ctx.db
      .query("quotePricingRules")
      .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
      .collect();

    return rules.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.minSqft - b.minSqft;
    });
  },
});

export const createRule = mutation({
  args: {
    serviceType: v.string(),
    frequency: v.string(),
    minSqft: v.number(),
    maxSqft: v.number(),
    priceCents: v.number(),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("quotePricingRules", {
      organizationId: organization._id,
      serviceType: args.serviceType,
      frequency: args.frequency,
      minSqft: args.minSqft,
      maxSqft: args.maxSqft,
      priceCents: args.priceCents,
      isActive: args.isActive ?? true,
      sortOrder: args.sortOrder ?? now,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const updateRule = mutation({
  args: {
    ruleId: v.id("quotePricingRules"),
    serviceType: v.optional(v.string()),
    frequency: v.optional(v.string()),
    minSqft: v.optional(v.number()),
    maxSqft: v.optional(v.number()),
    priceCents: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const { ruleId, ...updates } = args;
    const rule = await ctx.db.get(ruleId);
    if (!rule) {
      throw new Error("Pricing rule not found");
    }
    assertRecordInActiveOrg(rule.organizationId, organization._id);

    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    await ctx.db.patch(ruleId, {
      ...filtered,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(ruleId);
  },
});

export const deleteRule = mutation({
  args: { ruleId: v.id("quotePricingRules") },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      return { success: true };
    }
    assertRecordInActiveOrg(rule.organizationId, organization._id);
    await ctx.db.delete(args.ruleId);
    return { success: true };
  },
});

type SuggestedPrice = {
  priceCents: number | null;
  ruleId: Id<"quotePricingRules"> | null;
  serviceType: string | null;
  frequency: string | null;
};

export const getSuggestedPrice = query({
  args: {
    serviceType: v.optional(v.string()),
    frequency: v.optional(v.string()),
    squareFootage: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SuggestedPrice> => {
    const { organization } = await requireActiveOrganization(ctx);
    const sqft = args.squareFootage ?? 0;
    const serviceTypeNorm = normalize(args.serviceType);
    const frequencyNorm = normalize(args.frequency);

    const activeRules = await ctx.db
      .query("quotePricingRules")
      .withIndex("by_org_active", (q) =>
        q.eq("organizationId", organization._id).eq("isActive", true)
      )
      .collect();

    const matches = activeRules
      .filter((rule) => {
        const serviceMatch =
          !serviceTypeNorm || normalize(rule.serviceType) === serviceTypeNorm;
        const frequencyMatch =
          !frequencyNorm || normalize(rule.frequency) === frequencyNorm;
        const sqftMatch = sqft >= rule.minSqft && sqft <= rule.maxSqft;
        return serviceMatch && frequencyMatch && sqftMatch;
      })
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.minSqft - b.minSqft;
      });

    const best = matches[0] ?? null;
    return {
      priceCents: best?.priceCents ?? null,
      ruleId: best?._id ?? null,
      serviceType: best?.serviceType ?? null,
      frequency: best?.frequency ?? null,
    };
  },
});
