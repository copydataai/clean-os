"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import PageHeader from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MappingRef = {
  questionId?: string;
  key?: string;
  label?: string;
};

type FlowMappings = Record<string, MappingRef | undefined>;
type IntegrationMappings = {
  quoteRequest?: FlowMappings;
  bookingConfirmation?: FlowMappings;
  cardCapture?: FlowMappings;
};

type TallyQuestion = {
  id?: string;
  key?: string;
  label: string;
  type?: string;
};

type TallyForm = {
  id: string;
  name: string;
  questions: TallyQuestion[];
};

const QUOTE_REQUIRED_TARGETS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "service",
  "serviceType",
  "squareFootage",
  "address",
  "postalCode",
  "city",
  "state",
] as const;

const QUOTE_OPTIONAL_TARGETS = [
  "frequency",
  "addressLine2",
  "additionalNotes",
  "utm_source",
  "utm_campaign",
  "gad_campaignid",
  "gclid",
  "status",
] as const;

const CONFIRMATION_REQUIRED_TARGETS = ["contactDetails", "phoneNumber", "email"] as const;

const CONFIRMATION_OPTIONAL_TARGETS = [
  "accessMethod",
  "accessInstructions",
  "parkingInstructions",
  "floorTypes",
  "finishedBasement",
  "delicateSurfaces",
  "attentionAreas",
  "pets",
  "homeDuringCleanings",
  "scheduleAdjustmentWindows",
  "timingShiftOk",
  "additionalNotes",
] as const;

const CARD_OPTIONAL_TARGETS = ["email", "paymentMethod", "cardLast4", "cardBrand", "status"] as const;

function formatDate(timestamp?: number | null): string {
  if (!timestamp) {
    return "No data";
  }
  return new Date(timestamp).toLocaleString();
}

function humanizeTarget(target: string): string {
  return target
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function serializeQuestion(question: TallyQuestion): string {
  return JSON.stringify({
    questionId: question.id,
    key: question.key,
    label: question.label,
  });
}

function parseSerializedQuestion(value: string): MappingRef | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as MappingRef;
    return {
      questionId: parsed.questionId,
      key: parsed.key,
      label: parsed.label,
    };
  } catch {
    return undefined;
  }
}

function selectedQuestionValue(ref?: MappingRef): string {
  if (!ref) {
    return "";
  }
  return JSON.stringify({
    questionId: ref.questionId,
    key: ref.key,
    label: ref.label,
  });
}

function MappingSection({
  title,
  subtitle,
  targets,
  mappings,
  questions,
  onChange,
}: {
  title: string;
  subtitle: string;
  targets: readonly string[];
  mappings?: FlowMappings;
  questions: TallyQuestion[];
  onChange: (target: string, next: MappingRef | undefined) => void;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {targets.map((target) => (
          <label key={target} className="space-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{humanizeTarget(target)}</span>
            <select
              className="w-full rounded-lg border border-border/70 bg-card px-3 py-2 text-sm text-foreground"
              value={selectedQuestionValue(mappings?.[target])}
              onChange={(event) => onChange(target, parseSerializedQuestion(event.target.value))}
            >
              <option value="">Not mapped</option>
              {questions.map((question) => {
                const value = serializeQuestion(question);
                const meta = [question.key, question.id].filter(Boolean).join(" • ");
                return (
                  <option key={`${question.id ?? ""}:${question.key ?? ""}:${question.label}`} value={value}>
                    {question.label}{meta ? ` (${meta})` : ""}
                  </option>
                );
              })}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}

export default function IntegrationsPage() {
  const status = useQuery(api.integrations.getTallyIntegrationStatus, {});
  const health = useQuery(api.integrations.listTallyWebhookHealth, { limit: 20 });

  const upsertCredentials = useAction(api.integrations.upsertTallyCredentials);
  const validateConnection = useAction(api.integrations.validateTallyConnection);
  const syncForms = useAction(api.integrations.syncTallyFormsAndQuestions);
  const saveMappingsAndForms = useMutation(api.integrations.saveTallyMappingsAndForms);
  const ensureWebhooks = useAction(api.integrations.ensureTallyWebhooks);
  const bootstrapFromEnv = useAction(api.integrations.bootstrapTallyIntegrationFromEnv);

  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [requestFormId, setRequestFormId] = useState("");
  const [confirmationFormId, setConfirmationFormId] = useState("");
  const [cardFormId, setCardFormId] = useState("");
  const [mappings, setMappings] = useState<IntegrationMappings>({
    quoteRequest: {},
    bookingConfirmation: {},
    cardCapture: {},
  });
  const [formsCatalog, setFormsCatalog] = useState<TallyForm[]>([]);
  const [webhookList, setWebhookList] = useState<any[]>([]);
  const [webhookOps, setWebhookOps] = useState<any[]>([]);

  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingMappings, setIsSavingMappings] = useState(false);
  const [isRefreshingWebhooks, setIsRefreshingWebhooks] = useState(false);
  const [isEnsuringWebhooks, setIsEnsuringWebhooks] = useState(false);
  const [isDeletingWebhooks, setIsDeletingWebhooks] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!status) {
      return;
    }

    setRequestFormId(status.formIds?.request ?? "");
    setConfirmationFormId(status.formIds?.confirmation ?? "");
    setCardFormId(status.formIds?.card ?? "");
    setMappings({
      quoteRequest: status.fieldMappings?.quoteRequest ?? {},
      bookingConfirmation: status.fieldMappings?.bookingConfirmation ?? {},
      cardCapture: status.fieldMappings?.cardCapture ?? {},
    });
  }, [status]);

  const requestQuestions = useMemo(
    () => formsCatalog.find((form) => form.id === requestFormId)?.questions ?? [],
    [formsCatalog, requestFormId],
  );

  const confirmationQuestions = useMemo(
    () => formsCatalog.find((form) => form.id === confirmationFormId)?.questions ?? [],
    [formsCatalog, confirmationFormId],
  );

  const cardQuestions = useMemo(
    () => formsCatalog.find((form) => form.id === cardFormId)?.questions ?? [],
    [formsCatalog, cardFormId],
  );

  function setFlowMapping(
    flow: "quoteRequest" | "bookingConfirmation" | "cardCapture",
    target: string,
    next: MappingRef | undefined,
  ) {
    setMappings((prev) => ({
      ...prev,
      [flow]: {
        ...prev[flow],
        [target]: next,
      },
    }));
  }

  function toPayloadFlow(flow?: FlowMappings): Record<string, MappingRef> {
    const next: Record<string, MappingRef> = {};
    for (const [target, ref] of Object.entries(flow ?? {})) {
      if (!ref) {
        continue;
      }
      next[target] = ref;
    }
    return next;
  }

  async function runWebhookOperation(operation: "list" | "ensure" | "delete") {
    setMessage(null);
    setError(null);

    const setLoading =
      operation === "list"
        ? setIsRefreshingWebhooks
        : operation === "ensure"
          ? setIsEnsuringWebhooks
          : setIsDeletingWebhooks;

    setLoading(true);
    try {
      const result = await ensureWebhooks({ operation, target: "all" });
      if (operation === "list") {
        setWebhookList(result.webhooks ?? []);
      } else {
        setWebhookOps(result.results ?? []);
        setMessage(
          operation === "ensure"
            ? "Webhooks ensured."
            : "Webhooks deleted for configured endpoints.",
        );
      }
    } catch (operationError) {
      console.error(operationError);
      setError(
        operationError instanceof Error ? operationError.message : "Webhook operation failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!status) {
    return (
      <div className="surface-card p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading integrations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="Connect Tally, map fields dynamically, and manage webhook delivery health."
      >
        <div className="flex items-center gap-2">
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm">
              Back to Settings
            </Button>
          </Link>
          <Badge className="capitalize">{status.status}</Badge>
        </div>
      </PageHeader>

      <section className="surface-card relative overflow-hidden rounded-3xl border-primary/25 bg-gradient-to-br from-card via-card to-primary/10 p-6">
        <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-primary/18 blur-3xl" />
        <div className="relative grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Provider</p>
            <p className="mt-2 text-lg font-semibold text-foreground">Tally</p>
          </article>
          <article className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</p>
            <p className="mt-2 text-lg font-semibold capitalize text-foreground">{status.status}</p>
          </article>
          <article className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last Sync</p>
            <p className="mt-2 text-sm font-medium text-foreground">{formatDate(status.lastSyncAt)}</p>
          </article>
          <article className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last Validation</p>
            <p className="mt-2 text-sm font-medium text-foreground">{formatDate(status.lastValidationAt)}</p>
          </article>
        </div>
      </section>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="surface-card rounded-3xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Connection</h2>
            <p className="text-sm text-muted-foreground">
              Store encrypted Tally credentials and validate API connectivity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">API key: {status.hasApiKey ? "configured" : "missing"}</Badge>
            <Badge variant="outline">
              Webhook secret: {status.hasWebhookSecret ? "configured" : "missing"}
            </Badge>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="tally-api-key" className="text-sm text-muted-foreground">
              Tally API Key
            </label>
            <Input
              id="tally-api-key"
              type="password"
              placeholder="tal_..."
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="tally-webhook-secret" className="text-sm text-muted-foreground">
              Tally Webhook Secret
            </label>
            <Input
              id="tally-webhook-secret"
              type="password"
              placeholder="whsec_..."
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            disabled={isSavingCredentials || !apiKey || !webhookSecret}
            onClick={async () => {
              setMessage(null);
              setError(null);
              setIsSavingCredentials(true);
              try {
                await upsertCredentials({ apiKey, webhookSecret });
                setApiKey("");
                setWebhookSecret("");
                setMessage("Credentials saved.");
              } catch (saveError) {
                console.error(saveError);
                setError(saveError instanceof Error ? saveError.message : "Failed to save credentials.");
              } finally {
                setIsSavingCredentials(false);
              }
            }}
          >
            {isSavingCredentials ? "Saving..." : "Save credentials"}
          </Button>

          <Button
            variant="outline"
            disabled={isValidating}
            onClick={async () => {
              setMessage(null);
              setError(null);
              setIsValidating(true);
              try {
                const result = await validateConnection({});
                if (result.ok) {
                  setMessage("Tally connection validated.");
                } else {
                  setError(result.error ?? "Validation failed.");
                }
              } catch (validationError) {
                console.error(validationError);
                setError(
                  validationError instanceof Error ? validationError.message : "Validation failed.",
                );
              } finally {
                setIsValidating(false);
              }
            }}
          >
            {isValidating ? "Validating..." : "Validate connection"}
          </Button>

          <Button
            variant="ghost"
            disabled={isBootstrapping}
            onClick={async () => {
              setMessage(null);
              setError(null);
              setIsBootstrapping(true);
              try {
                const result = await bootstrapFromEnv({});
                if (result.seeded) {
                  setMessage("Seeded Tally integration from environment.");
                } else {
                  setError(result.reason ?? "Bootstrap skipped.");
                }
              } catch (bootstrapError) {
                console.error(bootstrapError);
                setError(bootstrapError instanceof Error ? bootstrapError.message : "Bootstrap failed.");
              } finally {
                setIsBootstrapping(false);
              }
            }}
          >
            {isBootstrapping ? "Bootstrapping..." : "Bootstrap from env"}
          </Button>
        </div>
      </section>

      <section className="surface-card rounded-3xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Forms</h2>
            <p className="text-sm text-muted-foreground">
              Pull forms live from Tally and choose which forms power each webhook flow.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={isSyncing}
            onClick={async () => {
              setMessage(null);
              setError(null);
              setIsSyncing(true);
              try {
                const result = await syncForms({});
                setFormsCatalog(result.forms ?? []);

                setMappings((prev) => ({
                  quoteRequest: {
                    ...result.suggestions?.quoteRequest,
                    ...prev.quoteRequest,
                  },
                  bookingConfirmation: {
                    ...result.suggestions?.bookingConfirmation,
                    ...prev.bookingConfirmation,
                  },
                  cardCapture: {
                    ...result.suggestions?.cardCapture,
                    ...prev.cardCapture,
                  },
                }));

                setMessage("Forms and questions synced.");
              } catch (syncError) {
                console.error(syncError);
                setError(syncError instanceof Error ? syncError.message : "Failed to sync forms.");
              } finally {
                setIsSyncing(false);
              }
            }}
          >
            {isSyncing ? "Syncing..." : "Sync forms"}
          </Button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm text-muted-foreground">
            <span>Request Form</span>
            <select
              className="w-full rounded-lg border border-border/70 bg-card px-3 py-2 text-sm text-foreground"
              value={requestFormId}
              onChange={(event) => setRequestFormId(event.target.value)}
            >
              <option value="">Select request form</option>
              {formsCatalog.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name} ({form.id})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-muted-foreground">
            <span>Confirmation Form</span>
            <select
              className="w-full rounded-lg border border-border/70 bg-card px-3 py-2 text-sm text-foreground"
              value={confirmationFormId}
              onChange={(event) => setConfirmationFormId(event.target.value)}
            >
              <option value="">Select confirmation form</option>
              {formsCatalog.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name} ({form.id})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-muted-foreground">
            <span>Card Form (optional)</span>
            <select
              className="w-full rounded-lg border border-border/70 bg-card px-3 py-2 text-sm text-foreground"
              value={cardFormId}
              onChange={(event) => setCardFormId(event.target.value)}
            >
              <option value="">No card form</option>
              {formsCatalog.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name} ({form.id})
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="surface-card rounded-3xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Mappings</h2>
            <p className="text-sm text-muted-foreground">
              Dynamic field mapping from Tally question IDs/keys to internal targets.
            </p>
          </div>
          <Button
            disabled={isSavingMappings || !requestFormId || !confirmationFormId}
            onClick={async () => {
              setMessage(null);
              setError(null);
              setIsSavingMappings(true);
              try {
                await saveMappingsAndForms({
                  requestFormId,
                  confirmationFormId,
                  cardFormId: cardFormId || undefined,
                  fieldMappings: {
                    quoteRequest: toPayloadFlow(mappings.quoteRequest),
                    bookingConfirmation: toPayloadFlow(mappings.bookingConfirmation),
                    cardCapture: toPayloadFlow(mappings.cardCapture),
                  },
                });
                setMessage("Forms and mappings saved.");
              } catch (saveError) {
                console.error(saveError);
                setError(saveError instanceof Error ? saveError.message : "Failed to save mappings.");
              } finally {
                setIsSavingMappings(false);
              }
            }}
          >
            {isSavingMappings ? "Saving..." : "Save mappings"}
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <MappingSection
            title="Quote Request: Required"
            subtitle="Required targets for request ingestion."
            targets={QUOTE_REQUIRED_TARGETS}
            mappings={mappings.quoteRequest}
            questions={requestQuestions}
            onChange={(target, next) => setFlowMapping("quoteRequest", target, next)}
          />

          <MappingSection
            title="Quote Request: Optional"
            subtitle="Optional targets for enrichment and tracking."
            targets={QUOTE_OPTIONAL_TARGETS}
            mappings={mappings.quoteRequest}
            questions={requestQuestions}
            onChange={(target, next) => setFlowMapping("quoteRequest", target, next)}
          />

          <MappingSection
            title="Booking Confirmation: Required"
            subtitle="Required targets for confirmation ingestion."
            targets={CONFIRMATION_REQUIRED_TARGETS}
            mappings={mappings.bookingConfirmation}
            questions={confirmationQuestions}
            onChange={(target, next) => setFlowMapping("bookingConfirmation", target, next)}
          />

          <MappingSection
            title="Booking Confirmation: Optional"
            subtitle="Optional access and household metadata."
            targets={CONFIRMATION_OPTIONAL_TARGETS}
            mappings={mappings.bookingConfirmation}
            questions={confirmationQuestions}
            onChange={(target, next) => setFlowMapping("bookingConfirmation", target, next)}
          />

          <MappingSection
            title="Card Capture: Optional"
            subtitle="Configure and validate card form payload fields (no payment mutation in v1)."
            targets={CARD_OPTIONAL_TARGETS}
            mappings={mappings.cardCapture}
            questions={cardQuestions}
            onChange={(target, next) => setFlowMapping("cardCapture", target, next)}
          />
        </div>
      </section>

      <section className="surface-card rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Webhooks</h2>
            <p className="text-sm text-muted-foreground">
              List, repair, and delete managed Tally webhooks for all configured flows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={isRefreshingWebhooks} onClick={() => runWebhookOperation("list")}>
              {isRefreshingWebhooks ? "Refreshing..." : "List"}
            </Button>
            <Button variant="outline" disabled={isEnsuringWebhooks} onClick={() => runWebhookOperation("ensure")}>
              {isEnsuringWebhooks ? "Ensuring..." : "Ensure"}
            </Button>
            <Button variant="outline" disabled={isDeletingWebhooks} onClick={() => runWebhookOperation("delete")}>
              {isDeletingWebhooks ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <h3 className="text-sm font-semibold text-foreground">Remote webhooks</h3>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              {webhookList.length === 0 ? (
                <p>No webhook list loaded.</p>
              ) : (
                webhookList.map((webhook) => (
                  <div key={`${webhook.id ?? webhook.url}`} className="rounded-lg border border-border/70 bg-card px-3 py-2">
                    <p className="font-medium text-foreground">{webhook.id ?? "(no id)"}</p>
                    <p>form: {webhook.formId ?? "n/a"}</p>
                    <p>event: {webhook.eventType ?? "n/a"}</p>
                    <p className="truncate">url: {webhook.url ?? "n/a"}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <h3 className="text-sm font-semibold text-foreground">Last operation</h3>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              {webhookOps.length === 0 ? (
                <p>No webhook operation run yet.</p>
              ) : (
                webhookOps.map((item, index) => (
                  <div key={`${item.endpoint}-${index}`} className="rounded-lg border border-border/70 bg-card px-3 py-2">
                    <p className="font-medium capitalize text-foreground">
                      {item.endpoint}: {item.action}
                    </p>
                    {item.webhookId ? <p>webhook: {item.webhookId}</p> : null}
                    {item.reason ? <p>reason: {item.reason}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card rounded-3xl p-6">
        <h2 className="text-base font-semibold text-foreground">Health</h2>
        <p className="text-sm text-muted-foreground">
          Recent integration webhook attempts and validation outcomes.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 text-muted-foreground">
                <th className="px-2 py-2 font-medium">Time</th>
                <th className="px-2 py-2 font-medium">Endpoint</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Stage</th>
                <th className="px-2 py-2 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {(health ?? []).map((entry) => (
                <tr key={entry._id} className="border-b border-border/50">
                  <td className="px-2 py-2 text-muted-foreground">{formatDate(entry.receivedAt)}</td>
                  <td className="px-2 py-2 capitalize text-foreground">{entry.endpoint}</td>
                  <td className="px-2 py-2 text-foreground">{entry.httpStatus}</td>
                  <td className="px-2 py-2 text-foreground">{entry.stage}</td>
                  <td className="max-w-[420px] truncate px-2 py-2 text-muted-foreground">
                    {entry.message ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
