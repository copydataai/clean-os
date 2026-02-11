import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../integrations.ts": () => import("../integrations"),
  "../integrationsNode.ts": () => import("../integrationsNode"),
  "../queries.ts": () => import("../queries"),
};

async function seedMultiOrgAdminFixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const userClerkId = `user_${suffix}`;
    const userId = await ctx.db.insert("users", {
      clerkId: userClerkId,
      email: `${userClerkId}@example.com`,
      firstName: "Multi",
      lastName: "Org",
    });

    const orgAClerkId = `org_a_${suffix}`;
    const orgBClerkId = `org_b_${suffix}`;

    const orgAId = await ctx.db.insert("organizations", {
      clerkId: orgAClerkId,
      name: "Org A",
      slug: "org-a",
    });

    const orgBId = await ctx.db.insert("organizations", {
      clerkId: orgBClerkId,
      name: "Org B",
      slug: "org-b",
    });

    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_a_${suffix}`,
      userId,
      organizationId: orgAId,
      role: "owner",
    });

    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_b_${suffix}`,
      userId,
      organizationId: orgBId,
      role: "admin",
    });

    return {
      userClerkId,
      orgBId: orgBId as Id<"organizations">,
    };
  });
}

describe.sequential("integrations org context", () => {
  it("supports explicit organizationId when auth claim has no active org", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedMultiOrgAdminFixture(t);

    const authedWithoutOrgClaim = t.withIdentity({
      subject: fixture.userClerkId,
    });

    const fallbackStatus = await authedWithoutOrgClaim.query(
      api.integrations.getTallyIntegrationStatus,
      {},
    );
    expect(fallbackStatus.orgHandle).toBe("org-a");
    expect(fallbackStatus.status).toBe("incomplete");

    const scopedStatus = await authedWithoutOrgClaim.query(
      api.integrations.getTallyIntegrationStatus,
      {
        organizationId: fixture.orgBId,
      },
    );

    expect(scopedStatus.orgHandle).toBe("org-b");
    expect(scopedStatus.status).toBe("incomplete");
  });

  it("validates tally connection in action context without active org claim", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedMultiOrgAdminFixture(t);
    const authedWithoutOrgClaim = t.withIdentity({
      subject: fixture.userClerkId,
    });

    const originalFetch = global.fetch;
    global.fetch = (async () =>
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof global.fetch;

    try {
      const result = await authedWithoutOrgClaim.action(
        api.integrations.validateTallyConnection,
        {
          organizationId: fixture.orgBId,
          apiKey: "test_key",
        },
      );

      expect(result.ok).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
