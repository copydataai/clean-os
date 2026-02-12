import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import {
  createOrgMembershipFixture,
  createTestOrganization,
} from "./helpers/orgTestUtils";
import { expectConvexErrorCode } from "./helpers/convexError";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../bookingRequests.ts": () => import("../bookingRequests"),
  "../quoteRequests.ts": () => import("../quoteRequests"),
  "../customers.ts": () => import("../customers"),
};

function buildPayload(overrides?: {
  mode?: "new" | "existing";
  existingQuoteRequestId?: Id<"quoteRequests">;
}) {
  return {
    mode: overrides?.mode ?? "new",
    existingQuoteRequestId: overrides?.existingQuoteRequestId,
    contact: {
      firstName: "Jamie",
      lastName: "Rivera",
      email: "jamie@example.com",
      phone: "5551234567",
    },
    quote: {
      service: "Home Cleaning",
      serviceType: "Deep Clean",
      frequency: "Bi-weekly",
      squareFootage: 1600,
      address: "123 Main Street",
      addressLine2: "Apt 2",
      postalCode: "94107",
      city: "San Francisco",
      state: "CA",
      additionalNotes: "Include interior windows",
    },
    request: {
      accessMethod: ["door code"],
      accessInstructions: "Code in lockbox",
      parkingInstructions: "Street parking",
      floorTypes: ["hardwood", "tile"],
      finishedBasement: "yes",
      delicateSurfaces: "marble island",
      attentionAreas: "kitchen + bathrooms",
      pets: ["dog"],
      homeDuringCleanings: "sometimes",
      scheduleAdjustmentWindows: ["morning"],
      timingShiftOk: "yes",
      additionalNotes: "Call on arrival",
    },
  };
}

describe.sequential("dashboard request create mutation", () => {
  it("creates booking request + quote request in new mode", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createOrgMembershipFixture(t);
    const authed = t.withIdentity({
      subject: fixture.clerkUserId,
      orgId: fixture.clerkOrgId,
    });

    const result = await authed.mutation(
      api.bookingRequests.createFromDashboard,
      buildPayload({ mode: "new" })
    );

    expect(result.reusedQuote).toBe(false);

    const records = await t.run(async (ctx) => {
      const bookingRequest = await ctx.db.get(
        result.bookingRequestId as Id<"bookingRequests">
      );
      const quoteRequest = await ctx.db.get(
        result.quoteRequestId as Id<"quoteRequests">
      );
      return { bookingRequest, quoteRequest };
    });

    expect(records.bookingRequest?._id).toBe(result.bookingRequestId);
    expect(records.quoteRequest?._id).toBe(result.quoteRequestId);
    expect(records.bookingRequest?.quoteRequestId).toBe(result.quoteRequestId);
    expect(records.quoteRequest?.bookingRequestId).toBe(result.bookingRequestId);
    expect(records.bookingRequest?.organizationId).toBe(fixture.organizationId);
    expect(records.quoteRequest?.organizationId).toBe(fixture.organizationId);
  });

  it("reuses selected quote request in existing mode", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createOrgMembershipFixture(t);
    const authed = t.withIdentity({
      subject: fixture.clerkUserId,
      orgId: fixture.clerkOrgId,
    });

    const quoteRequestId = await t.mutation(internal.quoteRequests.createQuoteRequest, {
      organizationId: fixture.organizationId,
      firstName: "Existing",
      lastName: "Customer",
      email: "existing@example.com",
      phone: "5550001111",
      service: "Recurring clean",
      serviceType: "Standard",
      squareFootage: 1200,
      address: "900 Howard St",
      postalCode: "94103",
      city: "San Francisco",
      state: "CA",
    });

    const result = await authed.mutation(
      api.bookingRequests.createFromDashboard,
      buildPayload({
        mode: "existing",
        existingQuoteRequestId: quoteRequestId,
      })
    );

    expect(result.reusedQuote).toBe(true);
    expect(result.quoteRequestId).toBe(quoteRequestId);

    const records = await t.run(async (ctx) => {
      const bookingRequest = await ctx.db.get(
        result.bookingRequestId as Id<"bookingRequests">
      );
      const quoteRequest = await ctx.db.get(
        result.quoteRequestId as Id<"quoteRequests">
      );
      return { bookingRequest, quoteRequest };
    });

    expect(records.bookingRequest?.quoteRequestId).toBe(quoteRequestId);
    expect(records.bookingRequest?.contactDetails).toBe("Existing Customer");
    expect(records.bookingRequest?.email).toBe("existing@example.com");
    expect(records.bookingRequest?.phoneNumber).toBe("5550001111");
    expect(records.quoteRequest?.bookingRequestId).toBe(result.bookingRequestId);
  });

  it("falls back to payload contact fields when selected quote is missing them", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createOrgMembershipFixture(t);
    const authed = t.withIdentity({
      subject: fixture.clerkUserId,
      orgId: fixture.clerkOrgId,
    });

    const quoteRequestId = await t.mutation(internal.quoteRequests.createQuoteRequest, {
      organizationId: fixture.organizationId,
      service: "Recurring clean",
      serviceType: "Standard",
      squareFootage: 1200,
      address: "900 Howard St",
      postalCode: "94103",
      city: "San Francisco",
      state: "CA",
    });

    const result = await authed.mutation(
      api.bookingRequests.createFromDashboard,
      buildPayload({
        mode: "existing",
        existingQuoteRequestId: quoteRequestId,
      })
    );

    const bookingRequest = await t.run(async (ctx) => {
      return await ctx.db.get(result.bookingRequestId as Id<"bookingRequests">);
    });

    expect(bookingRequest?.contactDetails).toBe("Jamie Rivera");
    expect(bookingRequest?.email).toBe("jamie@example.com");
    expect(bookingRequest?.phoneNumber).toBe("5551234567");
  });

  it("rejects when selected quote is already linked", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createOrgMembershipFixture(t);
    const authed = t.withIdentity({
      subject: fixture.clerkUserId,
      orgId: fixture.clerkOrgId,
    });

    const linkedRequestId = await t.mutation(internal.bookingRequests.createRequest, {
      organizationId: fixture.organizationId,
      email: "already-linked@example.com",
      contactDetails: "Already Linked",
    });

    const linkedQuoteRequestId = await t.mutation(internal.quoteRequests.createQuoteRequest, {
      organizationId: fixture.organizationId,
      firstName: "Linked",
      lastName: "Quote",
      email: "already-linked@example.com",
      service: "Recurring clean",
      serviceType: "Standard",
      squareFootage: 1000,
      address: "1 Mission St",
      postalCode: "94105",
      city: "San Francisco",
      state: "CA",
      bookingRequestId: linkedRequestId,
    });

    await expectConvexErrorCode(
      authed.mutation(
        api.bookingRequests.createFromDashboard,
        buildPayload({
          mode: "existing",
          existingQuoteRequestId: linkedQuoteRequestId,
        })
      ),
      "QUOTE_ALREADY_LINKED_TO_REQUEST"
    );
  });

  it("rejects linking a quote request from another organization", async () => {
    const t = convexTest(schema, modules);
    const fixture = await createOrgMembershipFixture(t);
    const { organizationId: foreignOrganizationId } = await createTestOrganization(
      t,
      "Foreign Org"
    );
    const authed = t.withIdentity({
      subject: fixture.clerkUserId,
      orgId: fixture.clerkOrgId,
    });

    const foreignQuoteRequestId = await t.mutation(
      internal.quoteRequests.createQuoteRequest,
      {
        organizationId: foreignOrganizationId,
        firstName: "Foreign",
        lastName: "Owner",
        email: "foreign@example.com",
        service: "One-time clean",
        serviceType: "Move-out",
        squareFootage: 900,
        address: "500 3rd St",
        postalCode: "94107",
        city: "San Francisco",
        state: "CA",
      }
    );

    await expectConvexErrorCode(
      authed.mutation(
        api.bookingRequests.createFromDashboard,
        buildPayload({
          mode: "existing",
          existingQuoteRequestId: foreignQuoteRequestId,
        })
      ),
      "ORG_MISMATCH"
    );
  });
});
