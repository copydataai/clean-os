import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import {
  assertRecordInActiveOrg,
  requireActiveOrganization,
} from "../lib/orgContext";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
};

async function seedUserWithOrganizations(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userClerkId = `user_${Math.random().toString(36).slice(2, 10)}`;
    const userId = await ctx.db.insert("users", {
      clerkId: userClerkId,
      email: `${userClerkId}@example.com`,
      firstName: "Org",
      lastName: "Tester",
    });

    const alphaClerkId = `org_alpha_${Math.random().toString(36).slice(2, 8)}`;
    const betaClerkId = `org_beta_${Math.random().toString(36).slice(2, 8)}`;

    const alphaOrgId = await ctx.db.insert("organizations", {
      clerkId: alphaClerkId,
      name: "Alpha Org",
      slug: "alpha-org",
    });
    const betaOrgId = await ctx.db.insert("organizations", {
      clerkId: betaClerkId,
      name: "Beta Org",
      slug: "beta-org",
    });

    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_alpha_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      organizationId: alphaOrgId,
      role: "owner",
    });

    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_beta_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      organizationId: betaOrgId,
      role: "admin",
    });

    return {
      userId,
      userClerkId,
      alphaOrgId,
      alphaClerkId,
      betaOrgId,
      betaClerkId,
    };
  });
}

describe.sequential("org context helper", () => {
  it("resolves active organization from Clerk claim and validates membership", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedUserWithOrganizations(t);

    const authed = t.withIdentity({
      subject: fixture.userClerkId,
      orgId: fixture.betaClerkId,
    });

    const resolved = await authed.run(async (ctx) => {
      return await requireActiveOrganization(ctx);
    });

    expect(resolved.organization._id).toBe(fixture.betaOrgId);
    expect(resolved.membership.organizationId).toBe(fixture.betaOrgId);
    expect(resolved.user._id).toBe(fixture.userId);
  });

  it("falls back to deterministic first membership when no org claim is set", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedUserWithOrganizations(t);

    const authed = t.withIdentity({
      subject: fixture.userClerkId,
    });

    const resolved = await authed.run(async (ctx) => {
      return await requireActiveOrganization(ctx);
    });

    expect(resolved.organization._id).toBe(fixture.alphaOrgId);
  });

  it("rejects when identity points to org without user membership", async () => {
    const t = convexTest(schema, modules);

    const fixture = await t.run(async (ctx) => {
      const userClerkId = `user_${Math.random().toString(36).slice(2, 10)}`;
      const userId = await ctx.db.insert("users", {
        clerkId: userClerkId,
        email: `${userClerkId}@example.com`,
      });

      const allowedOrgClerkId = `org_allowed_${Math.random().toString(36).slice(2, 8)}`;
      const blockedOrgClerkId = `org_blocked_${Math.random().toString(36).slice(2, 8)}`;

      const allowedOrgId = await ctx.db.insert("organizations", {
        clerkId: allowedOrgClerkId,
        name: "Allowed Org",
      });

      await ctx.db.insert("organizations", {
        clerkId: blockedOrgClerkId,
        name: "Blocked Org",
      });

      await ctx.db.insert("organizationMemberships", {
        clerkId: `membership_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        organizationId: allowedOrgId,
        role: "member",
      });

      return { userClerkId, blockedOrgClerkId };
    });

    const authed = t.withIdentity({
      subject: fixture.userClerkId,
      orgId: fixture.blockedOrgClerkId,
    });

    await expect(
      authed.run(async (ctx) => {
        return await requireActiveOrganization(ctx);
      })
    ).rejects.toThrow("ORG_UNAUTHORIZED");
  });

  it("requires at least one org membership", async () => {
    const t = convexTest(schema, modules);

    const userClerkId = await t.run(async (ctx) => {
      const clerkId = `user_${Math.random().toString(36).slice(2, 10)}`;
      await ctx.db.insert("users", {
        clerkId,
        email: `${clerkId}@example.com`,
      });
      return clerkId;
    });

    const authed = t.withIdentity({ subject: userClerkId });

    await expect(
      authed.run(async (ctx) => {
        return await requireActiveOrganization(ctx);
      })
    ).rejects.toThrow("ORG_MEMBERSHIP_REQUIRED");
  });

  it("throws ORG_MISMATCH for cross-org record checks", () => {
    expect(() => {
      assertRecordInActiveOrg("org_a" as Id<"organizations">, "org_b" as Id<"organizations">);
    }).toThrow("ORG_MISMATCH");
  });
});
