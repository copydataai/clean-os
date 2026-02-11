import { describe, expect, it, vi } from "vitest";
import { logTallyRouteValidationFailure } from "../lib/tallyWebhookHttp";

describe("tally webhook http helpers", () => {
  it("logs route validation failures with expected payload", async () => {
    const runMutation = vi.fn().mockResolvedValue(null);
    const ctx = { runMutation };

    await logTallyRouteValidationFailure(ctx, {
      endpoint: "request",
      routeToken: "token_123",
      message: "Missing signature",
    });

    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        provider: "tally",
        endpoint: "request",
        routeToken: "token_123",
        httpStatus: 400,
        stage: "route_validation",
        message: "Missing signature",
      }),
    );
  });

  it("swallows logging errors to avoid blocking webhook responses", async () => {
    const runMutation = vi.fn().mockRejectedValue(new Error("db unavailable"));
    const ctx = { runMutation };
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      logTallyRouteValidationFailure(ctx, {
        endpoint: "confirmation",
        message: "Missing route token",
      }),
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });
});
