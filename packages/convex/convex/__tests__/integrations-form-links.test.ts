import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../integrations.ts": () => import("../integrations"),
  "../queries.ts": () => import("../queries"),
};

async function seedOrgFixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const userClerkId = `user_${suffix}`;
    const userId = await ctx.db.insert("users", {
      clerkId: userClerkId,
      email: `${userClerkId}@example.com`,
      firstName: "Test",
      lastName: "User",
    });
    const organizationId = await ctx.db.insert("organizations", {
      clerkId: `org_${suffix}`,
      name: "Test Org",
      slug: `test-org-${suffix}`,
    });
    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_${suffix}`,
      userId,
      organizationId,
      role: "owner",
    });
    return {
      userClerkId,
      userId,
      organizationId: organizationId as Id<"organizations">,
      orgHandle: `test-org-${suffix}`,
    };
  });
}

describe.sequential("integrations form links", () => {
  it("derives request and confirmation links from form IDs", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedOrgFixture(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("organizationIntegrations", {
        organizationId: fixture.organizationId,
        provider: "tally",
        status: "configured",
        requestFormId: "request123",
        confirmationFormId: "confirm123",
        formIds: {
          request: "request123",
          confirmation: "confirm123",
        },
        updatedByUserId: fixture.userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: fixture.userClerkId });
    const result = await authed.query(api.integrations.getTallyFormLinksForActiveOrganization, {
      organizationId: fixture.organizationId,
    });

    expect(result.requestFormUrl).toBe("https://tally.so/r/request123");
    expect(result.confirmationFormUrl).toBe("https://tally.so/r/confirm123");
    expect(result.isConfigured).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("returns missing flags for incomplete form configuration", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedOrgFixture(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("organizationIntegrations", {
        organizationId: fixture.organizationId,
        provider: "tally",
        status: "incomplete",
        requestFormId: "request123",
        updatedByUserId: fixture.userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const authed = t.withIdentity({ subject: fixture.userClerkId });
    const result = await authed.query(api.integrations.getTallyFormLinksForActiveOrganization, {
      organizationId: fixture.organizationId,
    });
    expect(result.requestFormUrl).toBe("https://tally.so/r/request123");
    expect(result.confirmationFormUrl).toBeNull();
    expect(result.isConfigured).toBe(false);
    expect(result.missing).toContain("confirmation_form");
  });

  it("exposes public links by org handle", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedOrgFixture(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("organizationIntegrations", {
        organizationId: fixture.organizationId,
        provider: "tally",
        status: "configured",
        requestFormId: "request123",
        confirmationFormId: "confirm123",
        updatedByUserId: fixture.userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.integrations.getTallyFormLinksByOrgHandlePublic, {
      handle: fixture.orgHandle,
    });
    expect(result.requestFormUrl).toBe("https://tally.so/r/request123");
    expect(result.confirmationFormUrl).toBe("https://tally.so/r/confirm123");

    const internalResult = await t.query(internal.integrations.getTallyFormLinksByOrganizationIdInternal, {
      organizationId: fixture.organizationId,
    });
    expect(internalResult.requestFormUrl).toBe("https://tally.so/r/request123");
  });
});
