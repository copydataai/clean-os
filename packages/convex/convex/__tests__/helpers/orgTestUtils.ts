import { convexTest } from "convex-test";
import type { Id } from "../../_generated/dataModel";

type TestHarness = ReturnType<typeof convexTest>;

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

export async function createTestOrganization(
  t: TestHarness,
  name = "Test Org"
): Promise<{ organizationId: Id<"organizations">; clerkOrgId: string }> {
  const suffix = randomSuffix();
  const clerkOrgId = `org_${suffix}`;
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      clerkId: clerkOrgId,
      name,
      slug: `org-${suffix}`,
    });
  });

  return { organizationId, clerkOrgId };
}

export async function createOrgMembershipFixture(
  t: TestHarness,
  options?: {
    organizationName?: string;
    role?: string;
    userClerkId?: string;
    orgClerkId?: string;
  }
): Promise<{
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  membershipId: Id<"organizationMemberships">;
  clerkOrgId: string;
  clerkUserId: string;
}> {
  const suffix = randomSuffix();
  const clerkOrgId = options?.orgClerkId ?? `org_${suffix}`;
  const clerkUserId = options?.userClerkId ?? `user_${suffix}`;
  const role = options?.role ?? "owner";

  return await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      clerkId: clerkOrgId,
      name: options?.organizationName ?? "Test Org",
      slug: `org-${suffix}`,
    });

    const userId = await ctx.db.insert("users", {
      clerkId: clerkUserId,
      email: `${clerkUserId}@example.com`,
      firstName: "Test",
      lastName: "User",
    });

    const membershipId = await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_${suffix}`,
      organizationId,
      userId,
      role,
    });

    return {
      organizationId,
      userId,
      membershipId,
      clerkOrgId,
      clerkUserId,
    };
  });
}
