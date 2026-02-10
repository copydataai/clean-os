import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../integrationsNode.ts": () => import("../integrationsNode"),
};

describe.sequential("integrations node actions", () => {
  it("returns parsed payload for successful tally api request", async () => {
    const t = convexTest(schema, modules);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: "form_1" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof global.fetch;

    try {
      const response = await t.action(internal.integrationsNode.tallyApiRequest, {
        apiKey: "test_key",
        path: "/forms",
      });

      expect(response.status).toBe(200);
      expect(response.data?.items?.[0]?.id).toBe("form_1");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("throws structured errors for failed tally api request", async () => {
    const t = convexTest(schema, modules);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Rate limit" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof global.fetch;

    try {
      await expect(
        t.action(internal.integrationsNode.tallyApiRequest, {
          apiKey: "test_key",
          path: "/forms",
        }),
      ).rejects.toThrow("TALLY_API_429");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
