import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../quotes.ts": () => import("../quotes"),
  "../quoteRequests.ts": () => import("../quoteRequests"),
  "../bookingRequests.ts": () => import("../bookingRequests"),
};

let quoteNumberCounter = 10000;

async function insertQuoteRequest(
  t: ReturnType<typeof convexTest>,
  overrides: Partial<{
    requestStatus: "requested" | "quoted" | "confirmed";
    email: string;
  }> = {}
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    return await ctx.db.insert("quoteRequests", {
      firstName: "Test",
      lastName: "Customer",
      email: overrides.email ?? `test-${Math.random()}@example.com`,
      serviceType: "Standard Cleaning",
      frequency: "Bi-weekly",
      squareFootage: 1200,
      requestStatus: overrides.requestStatus ?? "requested",
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function insertBookingRequest(
  t: ReturnType<typeof convexTest>,
  quoteRequestId: Id<"quoteRequests">
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    return await ctx.db.insert("bookingRequests", {
      status: "requested",
      quoteRequestId,
      email: "booking@example.com",
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function insertQuote(
  t: ReturnType<typeof convexTest>,
  quoteRequestId: Id<"quoteRequests">,
  overrides: Partial<{
    bookingRequestId: Id<"bookingRequests">;
    status: "draft" | "sent" | "accepted" | "expired" | "send_failed";
    expiresAt: number;
    sentAt: number;
    acceptedAt: number;
    requiresReview: boolean;
    reviewReason: string;
  }> = {}
) {
  const now = Date.now();
  const quoteNumber = quoteNumberCounter++;

  return await t.run(async (ctx) => {
    return await ctx.db.insert("quotes", {
      quoteRequestId,
      bookingRequestId: overrides.bookingRequestId,
      quoteNumber,
      status: overrides.status ?? "draft",
      profileKey: "kathy_clean_default",
      sentAt: overrides.sentAt,
      expiresAt: overrides.expiresAt,
      acceptedAt: overrides.acceptedAt,
      requiresReview: overrides.requiresReview ?? false,
      reviewReason: overrides.reviewReason,
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe.sequential("quote workflows", () => {
  it("maps quote statuses to the 3-column board buckets", async () => {
    const t = convexTest(schema, modules);

    const fallbackRequested = await insertQuoteRequest(t, { requestStatus: "quoted" });
    const draftRequest = await insertQuoteRequest(t);
    const failedRequest = await insertQuoteRequest(t);
    const sentRequest = await insertQuoteRequest(t);
    const expiredRequest = await insertQuoteRequest(t);
    const acceptedRequest = await insertQuoteRequest(t);

    const now = Date.now();
    await insertQuote(t, draftRequest, { status: "draft" });
    await insertQuote(t, failedRequest, { status: "send_failed" });
    await insertQuote(t, sentRequest, { status: "sent", expiresAt: now + 60_000 });
    await insertQuote(t, expiredRequest, { status: "expired", expiresAt: now - 60_000 });
    await insertQuote(t, acceptedRequest, { status: "accepted", acceptedAt: now });

    const board = await t.query(api.quotes.listQuoteBoard, { limit: 50 });
    const byId = new Map<Id<"quoteRequests">, any>(board.map((row: any) => [row._id, row]));

    expect(byId.get(fallbackRequested)?.boardColumn).toBe("quoted");
    expect(byId.get(draftRequest)?.boardColumn).toBe("requested");
    expect(byId.get(failedRequest)?.boardColumn).toBe("requested");
    expect(byId.get(sentRequest)?.boardColumn).toBe("quoted");
    expect(byId.get(expiredRequest)?.boardColumn).toBe("quoted");
    expect(byId.get(acceptedRequest)?.boardColumn).toBe("confirmed");
  });

  it("syncs requested/quoted state and blocks manual confirmed moves", async () => {
    const t = convexTest(schema, modules);

    const quoteRequestId = await insertQuoteRequest(t);
    const quoteId = await insertQuote(t, quoteRequestId, { status: "draft" });

    await t.mutation(api.quotes.moveBoardCard, {
      quoteRequestId,
      targetColumn: "quoted",
    });

    const afterQuoted = await t.run(async (ctx) => {
      const quoteRequest = await ctx.db.get(quoteRequestId);
      const quote = await ctx.db.get(quoteId);
      return { quoteRequest, quote };
    });

    expect(afterQuoted.quoteRequest?.requestStatus).toBe("quoted");
    expect(afterQuoted.quote?.status).toBe("sent");
    expect(typeof afterQuoted.quote?.sentAt).toBe("number");
    expect(typeof afterQuoted.quote?.expiresAt).toBe("number");
    expect(afterQuoted.quote?.acceptedAt).toBeUndefined();

    await expect(
      t.mutation(api.quotes.moveBoardCard, {
        quoteRequestId,
        targetColumn: "confirmed",
      })
    ).rejects.toThrow("Confirmed status is webhook-only");

    const afterBlockedConfirmed = await t.run(async (ctx) => {
      const quoteRequest = await ctx.db.get(quoteRequestId);
      const quote = await ctx.db.get(quoteId);
      return { quoteRequest, quote };
    });

    expect(afterBlockedConfirmed.quoteRequest?.requestStatus).toBe("quoted");
    expect(afterBlockedConfirmed.quote?.status).toBe("sent");
    expect(afterBlockedConfirmed.quote?.acceptedAt).toBeUndefined();
  });

  it("expires sent quotes with past expiry timestamps in the sweep", async () => {
    const t = convexTest(schema, modules);

    const now = Date.now();
    const pastRequest = await insertQuoteRequest(t);
    const futureRequest = await insertQuoteRequest(t);
    const pastQuoteId = await insertQuote(t, pastRequest, {
      status: "sent",
      sentAt: now - 86_400_000,
      expiresAt: now - 1_000,
    });
    const futureQuoteId = await insertQuote(t, futureRequest, {
      status: "sent",
      sentAt: now - 60_000,
      expiresAt: now + 86_400_000,
    });

    const result = await t.mutation(internal.quotes.expireSentQuotesSweep, {});
    expect(result.expiredCount).toBe(1);

    const after = await t.run(async (ctx) => {
      const pastQuote = await ctx.db.get(pastQuoteId);
      const futureQuote = await ctx.db.get(futureQuoteId);
      return { pastQuote, futureQuote };
    });

    expect(after.pastQuote?.status).toBe("expired");
    expect(after.futureQuote?.status).toBe("sent");
  });

  it("marks accepted + review flag when confirmation occurs after expiry", async () => {
    const t = convexTest(schema, modules);

    const now = Date.now();
    const quoteRequestId = await insertQuoteRequest(t, { requestStatus: "quoted" });
    const bookingRequestId = await insertBookingRequest(t, quoteRequestId);
    const quoteId = await insertQuote(t, quoteRequestId, {
      bookingRequestId,
      status: "sent",
      sentAt: now - 7 * 86_400_000,
      expiresAt: now - 1_000,
    });

    await t.mutation(internal.bookingRequests.confirmRequest, {
      requestId: bookingRequestId,
    });

    const after = await t.run(async (ctx) => {
      const quote = await ctx.db.get(quoteId);
      const quoteRequest = await ctx.db.get(quoteRequestId);
      return { quote, quoteRequest };
    });

    expect(after.quoteRequest?.requestStatus).toBe("confirmed");
    expect(after.quote?.status).toBe("accepted");
    expect(after.quote?.requiresReview).toBe(true);
    expect(after.quote?.reviewReason).toBe("confirmed_after_expiry");
    expect(typeof after.quote?.acceptedAt).toBe("number");
  });
});
