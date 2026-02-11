import { describe, expect, it, vi } from "vitest";
import { getBookingRequestLink, getConfirmRequestLink } from "./bookingLinks";

describe("bookingLinks", () => {
  it("builds booking request link from app URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    const link = getBookingRequestLink("req_123" as any, "clean-org");
    expect(link).toBe("https://app.example.com/book/clean-org?request_id=req_123");
    vi.unstubAllEnvs();
  });

  it("builds confirm link with request_id and org_slug", () => {
    const link = getConfirmRequestLink(
      "https://tally.so/r/confirm123",
      "req_123" as any,
      "clean-org"
    );
    expect(link).toBe("https://tally.so/r/confirm123?request_id=req_123&org_slug=clean-org");
  });

  it("returns empty confirm link when URL is missing", () => {
    const link = getConfirmRequestLink(null, "req_123" as any, "clean-org");
    expect(link).toBe("");
  });
});
