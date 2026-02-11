import { describe, expect, it } from "vitest";
import {
  buildManagedTallyWebhookUpsertBody,
  normalizeTallyWebhooks,
  shouldUpdateManagedTallyWebhook,
  type TallyWebhookRecord,
} from "../integrations";

describe("tally webhook management helpers", () => {
  it("normalizes webhook signing secrets from Tally payloads", () => {
    const webhooks = normalizeTallyWebhooks({
      webhooks: [
        {
          id: "w1",
          url: "https://example.com/one",
          formId: "form_1",
          eventType: "FORM_RESPONSE",
          signingSecret: "secret-one",
        },
        {
          id: "w2",
          url: "https://example.com/two",
          formId: "form_2",
          eventType: "FORM_RESPONSE",
          signingSecret: null,
        },
      ],
    });

    expect(webhooks).toHaveLength(2);
    expect(webhooks[0]?.signingSecret).toBe("secret-one");
    expect(webhooks[1]?.signingSecret).toBeNull();
  });

  it("updates managed webhook when signing secret is missing or mismatched", () => {
    const missingSecret: TallyWebhookRecord = {
      id: "w1",
      url: "https://example.com/hook",
      formId: "PdOzde",
      eventType: "FORM_RESPONSE",
      signingSecret: null,
    };

    const mismatchedSecret: TallyWebhookRecord = {
      id: "w2",
      url: "https://example.com/hook",
      formId: "PdOzde",
      eventType: "FORM_RESPONSE",
      signingSecret: "old-secret",
    };

    const matchingSecret: TallyWebhookRecord = {
      id: "w3",
      url: "https://example.com/hook",
      formId: "PdOzde",
      eventType: "FORM_RESPONSE",
      signingSecret: "expected-secret",
    };

    expect(
      shouldUpdateManagedTallyWebhook({
        webhook: missingSecret,
        targetUrl: "https://example.com/hook",
        formId: "PdOzde",
        expectedSigningSecret: "expected-secret",
      }),
    ).toBe(true);

    expect(
      shouldUpdateManagedTallyWebhook({
        webhook: mismatchedSecret,
        targetUrl: "https://example.com/hook",
        formId: "PdOzde",
        expectedSigningSecret: "expected-secret",
      }),
    ).toBe(true);

    expect(
      shouldUpdateManagedTallyWebhook({
        webhook: matchingSecret,
        targetUrl: "https://example.com/hook",
        formId: "PdOzde",
        expectedSigningSecret: "expected-secret",
      }),
    ).toBe(false);
  });

  it("builds webhook upsert payloads with signing secret", () => {
    const body = buildManagedTallyWebhookUpsertBody({
      url: "https://example.com/hook",
      formId: "PdOzde",
      signingSecret: "expected-secret",
    });

    expect(body).toEqual({
      url: "https://example.com/hook",
      eventTypes: ["FORM_RESPONSE"],
      formId: "PdOzde",
      isEnabled: true,
      signingSecret: "expected-secret",
    });
  });
});
