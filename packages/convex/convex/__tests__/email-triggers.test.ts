import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../emailTriggers.ts": () => import("../emailTriggers"),
  "../bookingRequests.ts": () => import("../bookingRequests"),
  "../quoteRequests.ts": () => import("../quoteRequests"),
  "../queries.ts": () => import("../queries"),
  "../integrations.ts": () => import("../integrations"),
};

describe.sequential("email triggers", () => {
  it("throws when tally confirmation form is not configured", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const suffix = Math.random().toString(36).slice(2, 8);
      const userId = await ctx.db.insert("users", {
        clerkId: `user_${suffix}`,
        email: `user_${suffix}@example.com`,
        firstName: "User",
        lastName: "Test",
      });
      const organizationId = await ctx.db.insert("organizations", {
        clerkId: `org_${suffix}`,
        name: "Org",
        slug: `org-${suffix}`,
      });
      await ctx.db.insert("organizationMemberships", {
        clerkId: `membership_${suffix}`,
        userId,
        organizationId,
        role: "owner",
      });
      const quoteRequestId = await ctx.db.insert("quoteRequests", {
        organizationId,
        firstName: "Customer",
        email: "customer@example.com",
        requestStatus: "requested",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const requestId = await ctx.db.insert("bookingRequests", {
        organizationId,
        status: "requested",
        quoteRequestId,
        email: "customer@example.com",
        contactDetails: "Customer",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { userClerkId: `user_${suffix}`, requestId };
    });

    const authed = t.withIdentity({ subject: fixture.userClerkId });
    await expect(
      authed.action(api.emailTriggers.sendConfirmationEmail, { requestId: fixture.requestId as any })
    ).rejects.toThrow("TALLY_CONFIRMATION_FORM_NOT_CONFIGURED");
  });
});
