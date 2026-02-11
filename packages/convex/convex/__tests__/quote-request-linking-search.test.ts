import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import {
  createOrgMembershipFixture,
  createTestOrganization,
} from "./helpers/orgTestUtils";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../quoteRequests.ts": () => import("../quoteRequests"),
};

describe.sequential("quote request linking search", () => {
  it("returns only active org records and applies search filtering", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createOrgMembershipFixture(t);
    const { organizationId: foreignOrganizationId } = await createTestOrganization(
      t,
      "Foreign Search Org"
    );
    const authed = t.withIdentity({
      subject: fixture.clerkUserId,
      orgId: fixture.clerkOrgId,
    });

    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("quoteRequests", {
        organizationId: fixture.organizationId,
        firstName: "Ana",
        lastName: "Lopez",
        email: "ana@example.com",
        service: "Deep Clean",
        serviceType: "Move-out",
        address: "100 Main St",
        city: "San Francisco",
        state: "CA",
        requestStatus: "requested",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("quoteRequests", {
        organizationId: fixture.organizationId,
        firstName: "Bob",
        lastName: "Stone",
        email: "bob@example.com",
        service: "Standard Clean",
        serviceType: "Recurring",
        address: "200 Main St",
        city: "San Francisco",
        state: "CA",
        requestStatus: "quoted",
        createdAt: now + 1,
        updatedAt: now + 1,
      });
      await ctx.db.insert("quoteRequests", {
        organizationId: foreignOrganizationId,
        firstName: "Ana",
        lastName: "Foreign",
        email: "ana-foreign@example.com",
        service: "Deep Clean",
        serviceType: "Move-out",
        address: "500 Elsewhere",
        city: "Oakland",
        state: "CA",
        requestStatus: "requested",
        createdAt: now + 2,
        updatedAt: now + 2,
      });
    });

    const results = await authed.query(api.quoteRequests.searchForRequestLinking, {
      query: "ana",
      limit: 20,
    });

    expect(results.length).toBe(1);
    expect(results[0].email).toBe("ana@example.com");
  });

  it("respects result limits", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createOrgMembershipFixture(t);
    const authed = t.withIdentity({
      subject: fixture.clerkUserId,
      orgId: fixture.clerkOrgId,
    });

    const now = Date.now();
    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i += 1) {
        await ctx.db.insert("quoteRequests", {
          organizationId: fixture.organizationId,
          firstName: `Customer${i}`,
          lastName: "Limit",
          email: `customer-${i}@example.com`,
          service: "Standard Clean",
          serviceType: "Recurring",
          address: `${i} Limit Ave`,
          city: "San Francisco",
          state: "CA",
          requestStatus: "requested",
          createdAt: now + i,
          updatedAt: now + i,
        });
      }
    });

    const results = await authed.query(api.quoteRequests.searchForRequestLinking, {
      limit: 2,
    });

    expect(results.length).toBe(2);
  });
});
