import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { expectConvexErrorCode } from "./helpers/convexError";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../bookings.ts": () => import("../bookings"),
  "../bookingRequests.ts": () => import("../bookingRequests"),
  "../dashboard.ts": () => import("../dashboard"),
};

async function seedGuardrailFixture(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const userClerkId = `user_${suffix}`;
    const userId = await ctx.db.insert("users", {
      clerkId: userClerkId,
      email: `${userClerkId}@example.com`,
      firstName: "Guard",
      lastName: "Rail",
    });

    const orgAClerkId = `org_a_${suffix}`;
    const orgBClerkId = `org_b_${suffix}`;

    const orgAId = await ctx.db.insert("organizations", {
      clerkId: orgAClerkId,
      name: "Org A",
    });

    const orgBId = await ctx.db.insert("organizations", {
      clerkId: orgBClerkId,
      name: "Org B",
    });

    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_${suffix}`,
      userId,
      organizationId: orgAId,
      role: "owner",
    });

    const now = Date.now();
    const foreignBookingId = await ctx.db.insert("bookings", {
      organizationId: orgBId,
      email: "foreign@example.com",
      customerName: "Foreign Customer",
      status: "scheduled",
      serviceDate: "2026-02-12",
      createdAt: now,
      updatedAt: now,
    });

    const foreignRequestId = await ctx.db.insert("bookingRequests", {
      organizationId: orgBId,
      status: "requested",
      email: "foreign@example.com",
      contactDetails: "Foreign Request",
      createdAt: now,
      updatedAt: now,
    });

    return {
      userClerkId,
      orgAClerkId,
      orgBClerkId,
      foreignBookingId,
      foreignRequestId,
    };
  });
}

describe.sequential("org mutation guardrails", () => {
  it("blocks cross-org mutations and unauthorized org claims", async () => {
    const t = convexTest(schema, modules);
    const fixture = await seedGuardrailFixture(t);

    const asOrgA = t.withIdentity({
      subject: fixture.userClerkId,
      orgId: fixture.orgAClerkId,
    });

    await expectConvexErrorCode(
      asOrgA.mutation(api.bookings.cancelBooking, {
        bookingId: fixture.foreignBookingId,
        reason: "cross-org test",
      }),
      "ORG_MISMATCH"
    );

    await expectConvexErrorCode(
      asOrgA.mutation(api.bookingRequests.markLinkSent, {
        requestId: fixture.foreignRequestId,
      }),
      "ORG_MISMATCH"
    );

    const asUnauthorizedOrg = t.withIdentity({
      subject: fixture.userClerkId,
      orgId: fixture.orgBClerkId,
    });

    await expectConvexErrorCode(
      asUnauthorizedOrg.query(api.dashboard.getStats, {}),
      "ORG_UNAUTHORIZED"
    );
  });
});
