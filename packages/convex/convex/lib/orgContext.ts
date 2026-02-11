import type { Doc, Id } from "../_generated/dataModel";
import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  compareMemberships,
  normalizeOrgClaim,
  type MembershipWithOrganization,
} from "./orgContextShared";

type DbCtx = QueryCtx | MutationCtx;
type AnyCtx = DbCtx | ActionCtx;

const ADMIN_ROLES = new Set(["admin", "owner"]);
const ADMIN_SUFFIXES = [":admin", ":owner"];

export type OrgAuthErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_USER_NOT_FOUND"
  | "ORG_MEMBERSHIP_REQUIRED"
  | "ORG_CLAIM_MISSING"
  | "ORG_UNAUTHORIZED"
  | "ORG_CONTEXT_REQUIRED"
  | "ORG_MISMATCH";

type AuthenticatedUser = Doc<"users">;
type AuthenticatedUserResult = {
  identity: UserIdentity;
  user: AuthenticatedUser;
};
type ActiveOrganizationResult = {
  identity: UserIdentity;
  user: AuthenticatedUser;
  organization: Doc<"organizations">;
  membership: MembershipWithOrganization;
  memberships: MembershipWithOrganization[];
};

type ActionOrgContextSnapshot = {
  user: Doc<"users"> | null;
  memberships: MembershipWithOrganization[];
  activeOrganization: Doc<"organizations"> | null;
  activeMembership: MembershipWithOrganization | null;
};

function throwOrgAuthError(code: OrgAuthErrorCode, details?: Record<string, unknown>): never {
  throw new ConvexError({
    code,
    ...(details ?? {}),
  });
}

function hasDatabaseAccess(ctx: AnyCtx): ctx is DbCtx {
  return "db" in ctx && Boolean((ctx as DbCtx).db);
}

async function resolveActionOrgContext(ctx: ActionCtx): Promise<ActionOrgContextSnapshot> {
  return (await ctx.runQuery(internal.queries.resolveOrgContextForAction, {})) as ActionOrgContextSnapshot;
}

export function isAdminRole(role?: string | null): boolean {
  const normalized = (role ?? "").toLowerCase();
  return (
    ADMIN_ROLES.has(normalized) ||
    ADMIN_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

export async function requireIdentity(ctx: AnyCtx): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throwOrgAuthError("AUTH_REQUIRED");
  }
  return identity as UserIdentity;
}

export async function requireAuthenticatedUser(ctx: AnyCtx): Promise<AuthenticatedUserResult> {
  const identity = (await ctx.auth.getUserIdentity()) as UserIdentity | null;
  if (!identity) {
    throwOrgAuthError("AUTH_REQUIRED");
  }

  if (!hasDatabaseAccess(ctx)) {
    const snapshot = await resolveActionOrgContext(ctx);
    if (!snapshot.user) {
      throwOrgAuthError("AUTH_USER_NOT_FOUND");
    }
    return { identity, user: snapshot.user };
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    throwOrgAuthError("AUTH_USER_NOT_FOUND");
  }

  return { identity, user };
}

export async function getUserMemberships(
  ctx: AnyCtx,
  userId: Id<"users">
): Promise<MembershipWithOrganization[]> {
  if (!hasDatabaseAccess(ctx)) {
    const snapshot = await resolveActionOrgContext(ctx);
    return snapshot.memberships
      .filter((membership) => membership.userId === userId)
      .sort(compareMemberships);
  }

  const memberships = await ctx.db
    .query("organizationMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const enriched = (
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
  ).filter((value): value is MembershipWithOrganization => Boolean(value));

  return enriched.sort(compareMemberships);
}

export async function resolveActiveOrganizationFromIdentity(
  ctx: AnyCtx,
  identityInput?: UserIdentity | null
): Promise<Doc<"organizations"> | null> {
  const identity = identityInput ?? ((await ctx.auth.getUserIdentity()) as UserIdentity | null);
  if (!identity) {
    return null;
  }

  if (!hasDatabaseAccess(ctx)) {
    const snapshot = await resolveActionOrgContext(ctx);
    return snapshot.activeOrganization;
  }

  const orgClerkId =
    normalizeOrgClaim(identity.orgId) ??
    normalizeOrgClaim(identity.org_id);

  if (!orgClerkId) {
    return null;
  }

  return await ctx.db
    .query("organizations")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", orgClerkId))
    .unique();
}

export async function requireActiveOrganization(ctx: AnyCtx): Promise<ActiveOrganizationResult> {
  const { identity, user } = await requireAuthenticatedUser(ctx);

  const memberships = await getUserMemberships(ctx, user._id);
  if (memberships.length === 0) {
    throwOrgAuthError("ORG_MEMBERSHIP_REQUIRED");
  }

  const activeFromIdentity = await resolveActiveOrganizationFromIdentity(ctx, identity);
  if (!activeFromIdentity) {
    if (memberships.length === 1) {
      const only = memberships[0];
      return {
        identity,
        user,
        organization: only.organization,
        membership: only,
        memberships,
      };
    }
    throwOrgAuthError("ORG_CLAIM_MISSING");
  }

  const membership = memberships.find(
    (item) => item.organizationId === activeFromIdentity._id
  );
  if (!membership) {
    throwOrgAuthError("ORG_UNAUTHORIZED", {
      organizationId: String(activeFromIdentity._id),
    });
  }

  return {
    identity,
    user,
    organization: activeFromIdentity,
    membership,
    memberships,
  };
}

export function assertRecordInActiveOrg(
  recordOrganizationId: Id<"organizations"> | undefined | null,
  activeOrganizationId: Id<"organizations">
) {
  if (!recordOrganizationId) {
    throwOrgAuthError("ORG_CONTEXT_REQUIRED");
  }

  if (recordOrganizationId !== activeOrganizationId) {
    throwOrgAuthError("ORG_MISMATCH", {
      expectedOrganizationId: String(activeOrganizationId),
      recordOrganizationId: String(recordOrganizationId),
    });
  }
}

export async function requireOrganizationAdmin(
  ctx: AnyCtx,
  organizationId?: Id<"organizations">
) {
  if (organizationId) {
    const { user } = await requireAuthenticatedUser(ctx);

    if (hasDatabaseAccess(ctx)) {
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_user_and_org", (q) =>
          q.eq("userId", user._id).eq("organizationId", organizationId)
        )
        .first();

      if (!membership || !isAdminRole(membership.role)) {
        throwOrgAuthError("ORG_UNAUTHORIZED");
      }

      const organization = await ctx.db.get(membership.organizationId);
      if (!organization) {
        throwOrgAuthError("ORG_UNAUTHORIZED");
      }

      return {
        user,
        organization,
        membership: {
          ...membership,
          organization,
        },
      };
    }

    const snapshot = await resolveActionOrgContext(ctx);
    const membership = snapshot.memberships.find((item) => item.organizationId === organizationId);

    if (!membership || !isAdminRole(membership.role)) {
      throwOrgAuthError("ORG_UNAUTHORIZED");
    }

    return {
      user,
      organization: membership.organization,
      membership,
    };
  }

  const { user, membership, organization } = await requireActiveOrganization(ctx);

  if (!isAdminRole(membership.role)) {
    throwOrgAuthError("ORG_UNAUTHORIZED");
  }

  return {
    user,
    organization,
    membership,
  };
}
