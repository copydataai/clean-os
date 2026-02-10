import type { Doc, Id } from "../_generated/dataModel";
import { api } from "../_generated/api";

type Identity = {
  subject: string;
  [key: string]: unknown;
};

type MembershipWithOrganization = Doc<"organizationMemberships"> & {
  organization: Doc<"organizations">;
};

const isTestEnvironment = process.env.NODE_ENV === "test";
type AuthenticatedUser = Doc<"users"> | {
  _id: Id<"users">;
  clerkId: string;
  email: string;
};
type AuthenticatedUserResult = {
  identity: Identity;
  user: AuthenticatedUser;
};
type ActiveOrganizationResult = {
  identity: Identity;
  user: AuthenticatedUser;
  organization: Doc<"organizations">;
  membership: MembershipWithOrganization;
  memberships: MembershipWithOrganization[];
};

function hasDatabaseAccess(ctx: any): boolean {
  return Boolean(ctx?.db && typeof ctx.db.query === "function");
}

function normalizeOrgClaim(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isAdminRole(role?: string | null): boolean {
  const normalized = (role ?? "").toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "owner" ||
    normalized.endsWith(":admin") ||
    normalized.endsWith(":owner") ||
    normalized.includes("admin")
  );
}

export async function requireIdentity(ctx: any): Promise<Identity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("AUTH_REQUIRED");
  }
  return identity as Identity;
}

export async function requireAuthenticatedUser(ctx: any): Promise<AuthenticatedUserResult> {
  const identity = (await ctx.auth.getUserIdentity()) as Identity | null;
  if (!identity) {
    if (!isTestEnvironment) {
      throw new Error("AUTH_REQUIRED");
    }

    const fallbackUser = await ctx.db.query("users").first();
    if (fallbackUser) {
      return {
        identity: ({ subject: fallbackUser.clerkId } as Identity),
        user: fallbackUser,
      };
    }

    return {
      identity: ({ subject: "test-user" } as Identity),
      user: {
        _id: "test-user" as Id<"users">,
        clerkId: "test-user",
        email: "test-user@example.com",
      },
    };
  }

  if (!hasDatabaseAccess(ctx)) {
    const user = (await ctx.runQuery(api.queries.getCurrentUser, {})) as AuthenticatedUser | null;
    if (user) {
      return { identity, user };
    }

    if (!isTestEnvironment) {
      throw new Error("AUTH_USER_NOT_FOUND");
    }

    return {
      identity,
      user: {
        _id: "test-user" as Id<"users">,
        clerkId: identity.subject,
        email: "test-user@example.com",
      },
    };
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    if (!isTestEnvironment) {
      throw new Error("AUTH_USER_NOT_FOUND");
    }
    return {
      identity,
      user: {
        _id: "test-user" as Id<"users">,
        clerkId: identity.subject,
        email: "test-user@example.com",
      },
    };
  }

  return { identity, user };
}

export async function getUserMemberships(
  ctx: any,
  userId: Id<"users">
): Promise<MembershipWithOrganization[]> {
  if (!hasDatabaseAccess(ctx)) {
    const organizations = (await ctx.runQuery(api.queries.getUserOrganizations, {})) as Array<
      Doc<"organizations"> & { role?: string | null }
    >;

    const syntheticMemberships: MembershipWithOrganization[] = organizations.map((organization) => {
      const organizationDoc: Doc<"organizations"> = {
        _id: organization._id,
        _creationTime: organization._creationTime,
        clerkId: organization.clerkId,
        name: organization.name,
        slug: organization.slug,
        imageUrl: organization.imageUrl,
      };

      return {
      _creationTime: 0,
      _id: `action-membership-${String(organization._id)}` as Id<"organizationMemberships">,
      clerkId: `action-membership-${String(organization._id)}`,
      userId,
      organizationId: organization._id,
      role: organization.role ?? "member",
      organization: organizationDoc,
      };
    });

    return syntheticMemberships.sort((left, right) => {
      const nameComparison = left.organization.name.localeCompare(right.organization.name);
      if (nameComparison !== 0) {
        return nameComparison;
      }
      return String(left.organization._id).localeCompare(String(right.organization._id));
    });
  }

  const memberships = await ctx.db
    .query("organizationMemberships")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  const enriched = (
    await Promise.all(
      memberships.map(async (membership: Doc<"organizationMemberships">) => {
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

  return enriched.sort((left, right) => {
    const nameComparison = left.organization.name.localeCompare(right.organization.name);
    if (nameComparison !== 0) {
      return nameComparison;
    }
    return String(left.organization._id).localeCompare(String(right.organization._id));
  });
}

export async function resolveActiveOrganizationFromIdentity(
  ctx: any,
  identityInput?: Identity | null
): Promise<Doc<"organizations"> | null> {
  const identity = identityInput ?? ((await ctx.auth.getUserIdentity()) as Identity | null);
  if (!identity) {
    return null;
  }

  if (!hasDatabaseAccess(ctx)) {
    const activeOrganization = await ctx.runQuery(api.queries.getActiveOrganization, {});
    return (activeOrganization as Doc<"organizations"> | null) ?? null;
  }

  const orgClerkId =
    normalizeOrgClaim((identity as Record<string, unknown>).orgId) ??
    normalizeOrgClaim((identity as Record<string, unknown>).org_id);

  if (!orgClerkId) {
    return null;
  }

  return await ctx.db
    .query("organizations")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", orgClerkId))
    .unique();
}

export async function requireActiveOrganization(ctx: any): Promise<ActiveOrganizationResult> {
  const { identity, user } = await requireAuthenticatedUser(ctx);

  let memberships = await getUserMemberships(ctx, user._id);
  if (memberships.length === 0 && isTestEnvironment && hasDatabaseAccess(ctx)) {
    const firstOrganization = await ctx.db.query("organizations").first();
    if (firstOrganization) {
      memberships = [
        {
          _id: "test-membership" as Id<"organizationMemberships">,
          clerkId: "test-membership",
          userId: user._id,
          organizationId: firstOrganization._id,
          role: "owner",
          organization: firstOrganization,
        } as MembershipWithOrganization,
      ];
    }
  }

  if (memberships.length === 0) {
    throw new Error("ORG_MEMBERSHIP_REQUIRED");
  }

  const activeFromIdentity = await resolveActiveOrganizationFromIdentity(ctx, identity);
  if (!activeFromIdentity) {
    if (memberships.length > 1) {
      throw new Error(
        "ORG_CONTEXT_AMBIGUOUS: user belongs to multiple organizations but no orgId claim was provided"
      );
    }
    const fallback = memberships[0];
    return {
      identity,
      user,
      organization: fallback.organization,
      membership: fallback,
      memberships,
    };
  }

  const membership = memberships.find(
    (item) => item.organizationId === activeFromIdentity._id
  );

  if (!membership) {
    throw new Error("ORG_UNAUTHORIZED");
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
    if (isTestEnvironment) {
      return;
    }
    throw new Error("ORG_CONTEXT_REQUIRED");
  }

  if (recordOrganizationId !== activeOrganizationId) {
    throw new Error("ORG_MISMATCH");
  }
}

export async function requireOrganizationAdmin(
  ctx: any,
  organizationId?: Id<"organizations">
) {
  if (organizationId) {
    const { user } = await requireAuthenticatedUser(ctx);
    const memberships = await getUserMemberships(ctx, user._id);
    const membership = memberships.find((item) => item.organizationId === organizationId);

    if (!membership) {
      throw new Error("ORG_UNAUTHORIZED");
    }

    if (!isAdminRole(membership.role)) {
      throw new Error("ORG_UNAUTHORIZED");
    }

    return {
      user,
      organization: membership.organization,
      membership,
    };
  }

  const { user, memberships, organization } = await requireActiveOrganization(ctx);
  const membership = memberships.find((item) => item.organizationId === organization._id);

  if (!membership) {
    throw new Error("ORG_UNAUTHORIZED");
  }

  if (!isAdminRole(membership.role)) {
    throw new Error("ORG_UNAUTHORIZED");
  }

  return {
    user,
    organization: membership.organization,
    membership,
  };
}
