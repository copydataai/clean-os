import { describe, expect, it } from "vitest";
import {
  getEmailAttentionLevel,
  getOnboardingAttentionLevel,
  getQuoteAttentionLevel,
  matchesAttentionFilter,
  rankAttention,
} from "./commsAttention";

const NOW = Date.UTC(2026, 1, 13, 12, 0, 0);
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

describe("commsAttention", () => {
  it("ranks attention levels in operational priority order", () => {
    expect(rankAttention("failed")).toBeGreaterThan(rankAttention("delayed"));
    expect(rankAttention("delayed")).toBeGreaterThan(rankAttention("undelivered_60m"));
    expect(rankAttention("undelivered_60m")).toBeGreaterThan(rankAttention("expiring_24h"));
    expect(rankAttention("expiring_24h")).toBeGreaterThan(rankAttention("none"));
  });

  it("applies 60m undelivered threshold boundaries for sent email", () => {
    const beforeThreshold = getEmailAttentionLevel(
      {
        status: "sent",
        updatedAt: NOW - (60 * MINUTE_MS - 1),
      },
      NOW - (60 * MINUTE_MS - 1),
      NOW
    );
    const atThreshold = getEmailAttentionLevel(
      {
        status: "sent",
        updatedAt: NOW - 60 * MINUTE_MS,
      },
      NOW - 60 * MINUTE_MS,
      NOW
    );

    expect(beforeThreshold).toBe("none");
    expect(atThreshold).toBe("undelivered_60m");
  });

  it("applies 24h expiring threshold boundaries for quotes", () => {
    const outsideWindow = getQuoteAttentionLevel(
      {
        quoteStatus: "sent",
        expiresAt: NOW + 24 * HOUR_MS + 1,
      },
      NOW
    );
    const atWindow = getQuoteAttentionLevel(
      {
        quoteStatus: "sent",
        expiresAt: NOW + 24 * HOUR_MS,
      },
      NOW
    );

    expect(outsideWindow).toBe("none");
    expect(atWindow).toBe("expiring_24h");
  });

  it("uses highest-severity channel for onboarding precedence", () => {
    const level = getOnboardingAttentionLevel(
      {
        cardRequestEmailDelivery: {
          status: "delivery_delayed",
          updatedAt: NOW - 10 * MINUTE_MS,
        },
        confirmationEmailDelivery: {
          status: "failed",
          updatedAt: NOW - 2 * MINUTE_MS,
          errorMessage: "Mailbox rejected",
        },
      },
      NOW
    );

    expect(level).toBe("failed");
  });

  it("matches all quick-filter variants", () => {
    const failedQuote = {
      quoteStatus: "send_failed",
      latestEmailDelivery: {
        status: "failed" as const,
        updatedAt: NOW - 10 * MINUTE_MS,
        errorMessage: "Provider rejected",
      },
      sentAt: NOW - 10 * MINUTE_MS,
    };
    const delayedQuote = {
      quoteStatus: "sent",
      latestEmailDelivery: {
        status: "delivery_delayed" as const,
        updatedAt: NOW - 20 * MINUTE_MS,
      },
      sentAt: NOW - 20 * MINUTE_MS,
    };
    const undeliveredQuote = {
      quoteStatus: "sent",
      latestEmailDelivery: {
        status: "sent" as const,
        updatedAt: NOW - 70 * MINUTE_MS,
      },
      sentAt: NOW - 70 * MINUTE_MS,
    };
    const expiringQuote = {
      quoteStatus: "sent",
      latestEmailDelivery: {
        status: "delivered" as const,
        updatedAt: NOW - 5 * MINUTE_MS,
      },
      sentAt: NOW - 5 * MINUTE_MS,
      expiresAt: NOW + 2 * HOUR_MS,
    };
    const cleanOnboarding = {
      cardRequestEmailDelivery: {
        status: "delivered" as const,
        updatedAt: NOW - 3 * MINUTE_MS,
      },
      confirmationEmailDelivery: {
        status: "delivered" as const,
        updatedAt: NOW - 2 * MINUTE_MS,
      },
    };

    expect(matchesAttentionFilter(failedQuote, "all", NOW)).toBe(true);
    expect(matchesAttentionFilter(failedQuote, "needs_attention", NOW)).toBe(true);
    expect(matchesAttentionFilter(failedQuote, "email_failed", NOW)).toBe(true);

    expect(matchesAttentionFilter(delayedQuote, "delivery_delayed", NOW)).toBe(true);
    expect(matchesAttentionFilter(undeliveredQuote, "undelivered_60m", NOW)).toBe(true);
    expect(matchesAttentionFilter(expiringQuote, "expiring_24h", NOW)).toBe(true);

    expect(matchesAttentionFilter(cleanOnboarding, "needs_attention", NOW)).toBe(false);
    expect(matchesAttentionFilter(cleanOnboarding, "email_failed", NOW)).toBe(false);
    expect(matchesAttentionFilter(cleanOnboarding, "delivery_delayed", NOW)).toBe(false);
    expect(matchesAttentionFilter(cleanOnboarding, "undelivered_60m", NOW)).toBe(false);
    expect(matchesAttentionFilter(cleanOnboarding, "expiring_24h", NOW)).toBe(false);
  });
});
