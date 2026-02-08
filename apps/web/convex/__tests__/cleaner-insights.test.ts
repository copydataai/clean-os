import { describe, expect, it } from "vitest";
import {
  computeRatingsWindowSummary,
  computeReadinessInsights,
  formatPayRate,
} from "../../lib/cleanerInsights";

describe("cleaner insights helpers", () => {
  it("flags missing pay rate and missing service qualifications in readiness", () => {
    const insights = computeReadinessInsights({
      serviceQualifications: [{ serviceType: "standard", isQualified: true }],
      hasActivePayRate: false,
      ratingHealth: { average: 4.8, delta30d: 0.1 },
    });

    expect(insights.score).toBeLessThan(80);
    expect(insights.flags).toContain("No active pay rate");
    expect(insights.flags).toContain("Missing qualification: deep");
    expect(insights.flags).toContain("Missing qualification: move_out");
  });

  it("computes ratings 30-day delta correctly", () => {
    const now = 1_760_000_000_000;
    const day = 24 * 60 * 60 * 1000;
    const summary = computeRatingsWindowSummary(
      [
        { overallRating: 5, createdAt: now - 5 * day },
        { overallRating: 4, createdAt: now - 10 * day },
        { overallRating: 3, createdAt: now - 35 * day },
        { overallRating: 3, createdAt: now - 45 * day },
      ],
      now
    );

    expect(summary.average30d).toBeCloseTo(4.5, 5);
    expect(summary.previousAverage30d).toBeCloseTo(3, 5);
    expect(summary.delta30d).toBeCloseTo(1.5, 5);
  });

  it("formats pay rates by pay type", () => {
    expect(formatPayRate(2550, "hourly", "USD")).toBe("$25.50");
    expect(formatPayRate(15000, "per_job", "USD")).toBe("$150.00");
    expect(formatPayRate(20, "commission", "USD")).toBe("20%");
  });
});
