import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  getUserMemberships,
  requireActiveOrganization,
  requireAuthenticatedUser,
} from "./lib/orgContext";

type MembershipWithOrganization = Doc<"organizationMemberships"> & {
  organization: Doc<"organizations">;
};

function normalizeOrgClaim(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function compareMemberships(
  left: MembershipWithOrganization,
  right: MembershipWithOrganization
): number {
  return (
    left.organization.name.localeCompare(right.organization.name) ||
    String(left.organization._id).localeCompare(String(right.organization._id))
  );
}

export const resolveOrgContextForAction = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        user: null,
        memberships: [] as MembershipWithOrganization[],
        activeOrganization: null,
        activeMembership: null,
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return {
        user: null,
        memberships: [] as MembershipWithOrganization[],
        activeOrganization: null,
        activeMembership: null,
      };
    }

    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const membershipsWithOrganizations = (
      await Promise.all(
        memberships.map(async (membership) => {
          const organization = await ctx.db.get(membership.organizationId);
          if (!organization) {
            return null;
          }
          return {
            ...membership,
            organization,
          };
        })
      )
    )
      .filter((membership): membership is MembershipWithOrganization => Boolean(membership))
      .sort(compareMemberships);

    const orgClerkId =
      normalizeOrgClaim(identity.orgId) ??
      normalizeOrgClaim(identity.org_id);

    const activeOrganization = orgClerkId
      ? await ctx.db
          .query("organizations")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", orgClerkId))
          .unique()
      : null;

    const activeMembership = activeOrganization
      ? membershipsWithOrganizations.find(
          (membership) => membership.organizationId === activeOrganization._id
        ) ?? null
      : null;

    return {
      user,
      memberships: membershipsWithOrganizations,
      activeOrganization,
      activeMembership,
    };
  },
});

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
