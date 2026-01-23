import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// ===== USER MUTATIONS =====

export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("users", args);
  },
});

export const updateUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return await ctx.db.insert("users", args);
    }

    const { clerkId, ...updateData } = args;
    await ctx.db.patch(user._id, updateData);
    return user._id;
  },
});

export const deleteUser = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (user) {
      const memberships = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      for (const membership of memberships) {
        await ctx.db.delete(membership._id);
      }

      await ctx.db.delete(user._id);
    }
  },
});

// ===== ORGANIZATION MUTATIONS =====

export const createOrganization = internalMutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("organizations", args);
  },
});

export const updateOrganization = internalMutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!org) {
      return await ctx.db.insert("organizations", args);
    }

    const { clerkId, ...updateData } = args;
    await ctx.db.patch(org._id, updateData);
    return org._id;
  },
});

export const deleteOrganization = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (org) {
      const memberships = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .collect();

      for (const membership of memberships) {
        await ctx.db.delete(membership._id);
      }

      await ctx.db.delete(org._id);
    }
  },
});

// ===== MEMBERSHIP MUTATIONS =====

export const createMembership = internalMutation({
  args: {
    clerkId: v.string(),
    userClerkId: v.string(),
    organizationClerkId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      return existing._id;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userClerkId))
      .unique();

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.organizationClerkId))
      .unique();

    if (!user || !org) {
      console.error("User or organization not found for membership", args);
      throw new Error("User or organization not found");
    }

    return await ctx.db.insert("organizationMemberships", {
      clerkId: args.clerkId,
      userId: user._id,
      organizationId: org._id,
      role: args.role,
    });
  },
});

export const updateMembership = internalMutation({
  args: {
    clerkId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (membership) {
      await ctx.db.patch(membership._id, { role: args.role });
    }
  },
});

export const deleteMembership = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (membership) {
      await ctx.db.delete(membership._id);
    }
  },
});
