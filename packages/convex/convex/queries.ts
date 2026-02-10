import { query } from "./_generated/server";
import { v } from "convex/values";
import {
  getUserMemberships,
  requireActiveOrganization,
  requireAuthenticatedUser,
} from "./lib/orgContext";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    try {
      const { user } = await requireAuthenticatedUser(ctx);
      return user;
    } catch {
      return null;
    }
  },
});

export const getUserOrganizations = query({
  args: {},
  handler: async (ctx) => {
    try {
      const { user } = await requireAuthenticatedUser(ctx);
      const memberships = await getUserMemberships(ctx, user._id);

      return memberships.map((membership) => ({
        ...membership.organization,
        role: membership.role,
      }));
    } catch {
      return [];
    }
  },
});

export const getActiveOrganization = query({
  args: {},
  handler: async (ctx) => {
    try {
      const { organization, membership } = await requireActiveOrganization(ctx);
      return {
        ...organization,
        role: membership.role,
      };
    } catch {
      return null;
    }
  },
});

export const getOrganizationById = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getOrganizationMembers = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return {
          ...user,
          role: membership.role,
        };
      })
    );

    return members;
  },
});
