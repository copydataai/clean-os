import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../bookingRequests.ts": () => import("../bookingRequests"),
  "../bookings.ts": () => import("../bookings"),
  "../customers.ts": () => import("../customers"),
  "../bookingStateMachine.ts": () => import("../bookingStateMachine"),
  "../bookingDb.ts": () => import("../bookingDb"),
};

async function seedOrganization(
  t: ReturnType<typeof convexTest>,
  opts: { slug: string; name: string }
) {
  return await t.run(async (ctx) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const userId = await ctx.db.insert("users", {
      clerkId: `user_${suffix}`,
      email: `user_${suffix}@example.com`,
      firstName: "Ops",
      lastName: "Tester",
    });

    const organizationId = await ctx.db.insert("organizations", {
      clerkId: `org_${suffix}`,
      name: opts.name,
      slug: opts.slug,
    });

    return { userId, organizationId };
  });
}

describe.sequential("public booking context", () => {
  it("returns canonical booking context when stripe is configured", async () => {
    const t = convexTest(schema, modules);
    const { userId, organizationId } = await seedOrganization(t, {
      slug: "alpha-org",
      name: "Alpha Org",
    });

    const requestId = await t.run(async (ctx) => {
      return await ctx.db.insert("bookingRequests", {
        organizationId,
        status: "requested",
        email: "alpha@example.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("organizationStripeConfigs", {
        organizationId,
        orgSlug: "alpha-org",
        status: "configured",
        mode: "test",
        publishableKey: "pk_test_123",
        secretKeyCiphertext: "cipher",
        secretKeyIv: "iv",
        secretKeyAuthTag: "tag",
        webhookSecretCiphertext: "webhook-cipher",
        webhookSecretIv: "webhook-iv",
        webhookSecretAuthTag: "webhook-tag",
        keyVersion: 1,
        updatedByUserId: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const context = await t.query(api.bookingRequests.getPublicBookingContext, {
      requestId,
    });

    expect(context.errorCode).toBeNull();
    expect(context.canonicalSlug).toBe("alpha-org");
    expect(context.organizationId).toBe(organizationId);
    expect(context.requestStatus).toBe("requested");
    expect(context.stripeConfigured).toBe(true);

    const route = await t.query(api.bookingRequests.resolvePublicBookingRoute, {
      requestId,
    });
    expect(route).toEqual({
      handle: "alpha-org",
      organizationId,
    });
  });

  it("returns ORG_NOT_CONFIGURED_PUBLIC when stripe is not configured", async () => {
    const t = convexTest(schema, modules);
    const { organizationId } = await seedOrganization(t, {
      slug: "beta-org",
      name: "Beta Org",
    });

    const requestId = await t.run(async (ctx) => {
      return await ctx.db.insert("bookingRequests", {
        organizationId,
        status: "requested",
        email: "beta@example.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const context = await t.query(api.bookingRequests.getPublicBookingContext, {
      requestId,
    });

    expect(context.errorCode).toBe("ORG_NOT_CONFIGURED_PUBLIC");
    expect(context.canonicalSlug).toBe("beta-org");
    expect(context.organizationId).toBe(organizationId);
    expect(context.stripeConfigured).toBe(false);

    const route = await t.query(api.bookingRequests.resolvePublicBookingRoute, {
      requestId,
    });
    expect(route).toEqual({
      handle: "beta-org",
      organizationId,
    });
  });

  it("returns ORG_DATA_CONFLICT when request and quote organizations disagree", async () => {
    const t = convexTest(schema, modules);
    const { organizationId: orgA } = await seedOrganization(t, {
      slug: "org-a",
      name: "Org A",
    });
    const { organizationId: orgB } = await seedOrganization(t, {
      slug: "org-b",
      name: "Org B",
    });

    const requestId = await t.run(async (ctx) => {
      const quoteRequestId = await ctx.db.insert("quoteRequests", {
        organizationId: orgB,
        requestStatus: "requested",
        email: "conflict@example.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return await ctx.db.insert("bookingRequests", {
        organizationId: orgA,
        quoteRequestId,
        status: "requested",
        email: "conflict@example.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const context = await t.query(api.bookingRequests.getPublicBookingContext, {
      requestId,
    });

    expect(context.errorCode).toBe("ORG_DATA_CONFLICT");
    expect(context.organizationId).toBeNull();
    expect(context.canonicalSlug).toBeNull();

    const route = await t.query(api.bookingRequests.resolvePublicBookingRoute, {
      requestId,
    });
    expect(route).toBeNull();
  });

  it("creates booking using request authority and backfills missing request org from quote", async () => {
    const t = convexTest(schema, modules);
    const { organizationId: orgA } = await seedOrganization(t, {
      slug: "org-a",
      name: "Org A",
    });
    const { organizationId: orgB } = await seedOrganization(t, {
      slug: "org-b",
      name: "Org B",
    });

    const requestId = await t.run(async (ctx) => {
      const quoteRequestId = await ctx.db.insert("quoteRequests", {
        organizationId: orgA,
        requestStatus: "requested",
        email: "fallback@example.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return await ctx.db.insert("bookingRequests", {
        quoteRequestId,
        status: "requested",
        email: "fallback@example.com",
        contactDetails: "Fallback User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const bookingId = await t.mutation(api.bookings.createBookingFromRequest, {
      requestId,
    });

    const after = await t.run(async (ctx) => {
      const request = await ctx.db.get(requestId as Id<"bookingRequests">);
      const booking = await ctx.db.get(bookingId as Id<"bookings">);
      return { request, booking };
    });

    expect(after.request?.organizationId).toBe(orgA);
    expect(after.booking?.organizationId).toBe(orgA);

    const route = await t.query(api.bookingRequests.resolvePublicBookingRoute, {
      requestId,
    });
    expect(route).toEqual({
      handle: "org-a",
      organizationId: orgA,
    });

    await expect(
      t.mutation(api.bookings.createBookingFromRequest, {
        requestId,
        organizationId: orgB,
      })
    ).rejects.toThrow("ORG_MISMATCH");

    const missingOrgRequestId = await t.run(async (ctx) => {
      return await ctx.db.insert("bookingRequests", {
        status: "requested",
        email: "missing-org@example.com",
        contactDetails: "Missing Org",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      t.mutation(api.bookings.createBookingFromRequest, {
        requestId: missingOrgRequestId,
        organizationId: orgA,
      })
    ).rejects.toThrow("ORG_CONTEXT_REQUIRED");
  });
});
