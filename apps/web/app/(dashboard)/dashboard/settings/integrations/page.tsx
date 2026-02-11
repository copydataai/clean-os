"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import PageHeader from "@/components/dashboard/PageHeader";
import { useActiveOrganization } from "@/components/org/useActiveOrganization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────── */

type MappingRef = {
  questionId?: string;
  key?: string;
  label?: string;
};

type FlowMappings = Record<string, MappingRef | undefined>;
type IntegrationMappings = {
  quoteRequest?: FlowMappings;
  bookingConfirmation?: FlowMappings;
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

type TallyWebhookRecord = {
  id?: string;
  url?: string;
  formId?: string;
  eventType?: string;
};

type WebhookOpResult = {
  endpoint: string;
  action: string;
  webhookId?: string;
  reason?: string;
};

/* ─── Constants ─────────────────────────────────────────────── */

const QUOTE_REQUIRED_TARGETS = [
  "firstName", "lastName", "email", "phone", "service",
  "serviceType", "squareFootage", "address", "postalCode", "city", "state",
] as const;

const QUOTE_OPTIONAL_TARGETS = [
  "frequency", "addressLine2", "additionalNotes",
  "utm_source", "utm_campaign", "gad_campaignid", "gclid", "status",
] as const;

const CONFIRMATION_REQUIRED_TARGETS = ["contactDetails", "phoneNumber", "email"] as const;

const CONFIRMATION_OPTIONAL_TARGETS = [
  "accessMethod", "accessInstructions", "parkingInstructions", "floorTypes",
  "finishedBasement", "delicateSurfaces", "attentionAreas", "pets",
  "homeDuringCleanings", "scheduleAdjustmentWindows", "timingShiftOk", "additionalNotes",
] as const;

/* ─── Helpers ───────────────────────────────────────────────── */

function isAdminRole(role?: string | null): boolean {
  const normalized = (role ?? "").toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "owner" ||
    normalized.endsWith(":admin") ||
    normalized.endsWith(":owner") ||
    normalized.includes("admin")
  );
}

function formatDate(timestamp?: number | null): string {
  if (!timestamp) return "---";
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
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as MappingRef;
    return { questionId: parsed.questionId, key: parsed.key, label: parsed.label };
  } catch {
    return undefined;
  }
}

function selectedQuestionValue(ref?: MappingRef): string {
  if (!ref) return "";
  return JSON.stringify({ questionId: ref.questionId, key: ref.key, label: ref.label });
}

function maskUrl(url: string): string {
  if (!url) return "Not available";
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/");
    const last = segments[segments.length - 1] ?? "";
    if (last.length > 6) segments[segments.length - 1] = last.slice(0, 6) + "******";
    return parsed.origin + segments.join("/");
  } catch {
    return url.slice(0, 30) + "******";
  }
}

/* ─── Sub-components ────────────────────────────────────────── */

function SectionNumber({ n }: { n: string }) {
  return (
    <span className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
      {n}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="relative mr-2 inline-flex">
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          active ? "bg-emerald-500" : "bg-amber-400",
        )}
      />
      {active && (
        <span className="absolute inset-0 inline-block h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-50" />
      )}
    </span>
  );
}

function CredentialChip({ label, configured }: { label: string; configured: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
        configured
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", configured ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      {label}
    </span>
  );
}

function MetricCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-sm font-medium text-foreground", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

function MappingGrid({
  title,
  subtitle,
  targets,
  mappings,
  questions,
  onChange,
  defaultOpen = true,
}: {
  title: string;
  subtitle: string;
  targets: readonly string[];
  mappings?: FlowMappings;
  questions: TallyQuestion[];
  onChange: (target: string, next: MappingRef | undefined) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const mappedCount = targets.filter((t) => mappings?.[t]).length;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-foreground">{title}</h4>
            <Badge variant="outline" className="font-mono text-[10px] tabular-nums">
              {mappedCount}/{targets.length}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <svg
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {targets.map((target) => {
              const isMapped = !!mappings?.[target];
              return (
                <label key={target} className="group space-y-1">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <span
                      className={cn(
                        "inline-block h-1 w-1 rounded-full transition-colors",
                        isMapped ? "bg-emerald-500" : "bg-border",
                      )}
                    />
                    {humanizeTarget(target)}
                  </span>
                  <select
                    className={cn(
                      "w-full rounded-lg border bg-card px-2.5 py-1.5 text-xs transition-colors",
                      "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                      isMapped
                        ? "border-emerald-200 text-foreground dark:border-emerald-800"
                        : "border-border/60 text-muted-foreground",
                    )}
                    value={selectedQuestionValue(mappings?.[target])}
                    onChange={(e) => onChange(target, parseSerializedQuestion(e.target.value))}
                  >
                    <option value="">-- not mapped</option>
                    {questions.map((q) => {
                      const val = serializeQuestion(q);
                      const meta = [q.key, q.id].filter(Boolean).join(" / ");
                      return (
                        <option key={`${q.id ?? ""}:${q.key ?? ""}:${q.label}`} value={val}>
                          {q.label}{meta ? ` (${meta})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WebhookEndpoint({
  label,
  url,
  webhookId,
  isRevealed,
  isCopied,
  onReveal,
  onCopy,
}: {
  label: string;
  url: string;
  webhookId?: string;
  isRevealed: boolean;
  isCopied: boolean;
  onReveal: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {webhookId && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge variant="outline" className="max-w-28 truncate font-mono text-[10px]">
                    {webhookId}
                  </Badge>
                }
              />
              <TooltipContent>Webhook ID: {webhookId}</TooltipContent>
            </Tooltip>
          )}
          {!webhookId && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              not registered
            </Badge>
          )}
        </div>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {url ? (isRevealed ? url : maskUrl(url)) : "Not available"}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button variant="ghost" size="xs" disabled={!url} onClick={onReveal}>
          {isRevealed ? "Hide" : "Reveal"}
        </Button>
        <Button variant="outline" size="xs" disabled={!url} onClick={onCopy}>
          {isCopied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function HealthStatusDot({ status }: { status?: number }) {
  if (!status) return <span className="inline-block h-2 w-2 rounded-full bg-muted" />;
  if (status >= 200 && status < 300) return <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />;
  if (status >= 400) return <span className="inline-block h-2 w-2 rounded-full bg-red-400" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />;
}

/* ─── Main Page ─────────────────────────────────────────────── */

export default function IntegrationsPage() {
  const { activeOrg, organizations, isLoading: isOrgLoading } = useActiveOrganization();

  const selectedOrg = useMemo(() => {
    if (activeOrg) return activeOrg;
    if (organizations.length === 0) return null;
    return organizations.find((org) => isAdminRole(org.role)) ?? organizations[0] ?? null;
  }, [activeOrg, organizations]);

  const selectedOrgId = selectedOrg?._id;
  const isAdmin = isAdminRole(selectedOrg?.role);

  const status = useQuery(
    api.integrations.getTallyIntegrationStatus,
    selectedOrgId && isAdmin ? { organizationId: selectedOrgId } : "skip",
  );
  const health = useQuery(
    api.integrations.listTallyWebhookHealth,
    selectedOrgId && isAdmin ? { organizationId: selectedOrgId, limit: 20 } : "skip",
  );

  const upsertCredentials = useAction(api.integrations.upsertTallyCredentials);
  const validateConnection = useAction(api.integrations.validateTallyConnection);
  const syncForms = useAction(api.integrations.syncTallyFormsAndQuestions);
  const saveMappingsAndForms = useAction(api.integrations.saveTallyMappingsAndForms);
  const ensureWebhooks = useAction(api.integrations.ensureTallyWebhooks);
  const bootstrapFromEnv = useAction(api.integrations.bootstrapTallyIntegrationFromEnv);

  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [requestFormId, setRequestFormId] = useState("");
  const [confirmationFormId, setConfirmationFormId] = useState("");
  const [mappings, setMappings] = useState<IntegrationMappings>({
    quoteRequest: {},
    bookingConfirmation: {},
  });
  const [formsCatalog, setFormsCatalog] = useState<TallyForm[]>([]);
  const [webhookList, setWebhookList] = useState<TallyWebhookRecord[]>([]);
  const [webhookOps, setWebhookOps] = useState<WebhookOpResult[]>([]);
  const localDirtyRef = useRef(false);

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
  const [copiedWebhookKey, setCopiedWebhookKey] = useState<string | null>(null);
  const [revealedWebhookKeys, setRevealedWebhookKeys] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"quote" | "booking">("quote");
  const [webhooksExpanded, setWebhooksExpanded] = useState(false);

  const statusUpdatedAt = status?.updatedAt ?? null;
  const prevUpdatedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!status) return;
    if (localDirtyRef.current && statusUpdatedAt === prevUpdatedAtRef.current) return;
    prevUpdatedAtRef.current = statusUpdatedAt;
    localDirtyRef.current = false;
    setRequestFormId(status.formIds?.request ?? "");
    setConfirmationFormId(status.formIds?.confirmation ?? "");
    setMappings({
      quoteRequest: status.fieldMappings?.quoteRequest ?? {},
      bookingConfirmation: status.fieldMappings?.bookingConfirmation ?? {},
    });
  }, [status, statusUpdatedAt]);

  const requestQuestions = useMemo(
    () => formsCatalog.find((f) => f.id === requestFormId)?.questions ?? [],
    [formsCatalog, requestFormId],
  );

  const confirmationQuestions = useMemo(
    () => formsCatalog.find((f) => f.id === confirmationFormId)?.questions ?? [],
    [formsCatalog, confirmationFormId],
  );

  const managedWebhookUrls = useMemo(
    () => [
      { key: "request", label: "Request endpoint", url: status?.webhookUrls?.request ?? "" },
      { key: "confirmation", label: "Confirmation endpoint", url: status?.webhookUrls?.confirmation ?? "" },
    ],
    [status?.webhookUrls],
  );

  async function copyWebhookUrl(key: string, url: string) {
    setMessage(null);
    setError(null);
    if (!url) { setError("Webhook URL is not available yet."); return; }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedWebhookKey(key);
      setMessage("Webhook URL copied to clipboard.");
      setTimeout(() => setCopiedWebhookKey((c) => (c === key ? null : c)), 1500);
    } catch {
      setError("Failed to copy webhook URL.");
    }
  }

  function toggleRevealWebhook(key: string) {
    setRevealedWebhookKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setFlowMapping(flow: "quoteRequest" | "bookingConfirmation", target: string, next: MappingRef | undefined) {
    localDirtyRef.current = true;
    setMappings((prev) => ({ ...prev, [flow]: { ...prev[flow], [target]: next } }));
  }

  function toPayloadFlow(flow?: FlowMappings): Record<string, MappingRef> {
    const next: Record<string, MappingRef> = {};
    for (const [target, ref] of Object.entries(flow ?? {})) {
      if (ref) next[target] = ref;
    }
    return next;
  }

  async function runWebhookOperation(operation: "list" | "ensure" | "delete") {
    if (!selectedOrgId) { setError("Select an organization before managing webhooks."); return; }
    setMessage(null);
    setError(null);
    const setLoading =
      operation === "list" ? setIsRefreshingWebhooks
        : operation === "ensure" ? setIsEnsuringWebhooks
          : setIsDeletingWebhooks;
    setLoading(true);
    try {
      const result = await ensureWebhooks({ organizationId: selectedOrgId, operation, target: "all" });
      if (operation === "list") {
        setWebhookList(result.webhooks ?? []);
      } else {
        setWebhookOps(result.results ?? []);
        setMessage(operation === "ensure" ? "Webhooks ensured." : "Webhooks deleted for configured endpoints.");
      }
    } catch (opError) {
      console.error(opError);
      setError(opError instanceof Error ? opError.message : "Webhook operation failed.");
    } finally {
      setLoading(false);
    }
  }

  const isConnected = status?.status === "configured";

  /* ─── Guard states ─── */

  if (isOrgLoading || (!selectedOrg && organizations.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading integrations...</p>
      </div>
    );
  }

  if (!selectedOrg) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrations" subtitle="Manage third-party service connections.">
          <Link href="/dashboard/settings"><Button variant="outline" size="sm">Back to Settings</Button></Link>
        </PageHeader>
        <div className="surface-card rounded-2xl p-10 text-center">
          <p className="text-sm font-medium text-foreground">No organization found</p>
          <p className="mt-1 text-sm text-muted-foreground">Your account is not assigned to an organization.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrations" subtitle="Manage third-party service connections.">
          <Link href="/dashboard/settings"><Button variant="outline" size="sm">Back to Settings</Button></Link>
        </PageHeader>
        <div className="surface-card rounded-2xl p-10 text-center">
          <p className="text-sm font-medium text-foreground">Insufficient permissions</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin or owner role required for {selectedOrg.name}.
          </p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading integration status...</p>
      </div>
    );
  }

  /* ─── Render ─── */

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Integrations"
        subtitle="Connect external services, map data fields, and monitor webhook health."
      >
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/settings">
            <Button variant="outline" size="sm">Back to Settings</Button>
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center">
            <StatusDot active={isConnected} />
            <span className="text-sm font-medium capitalize text-foreground">{status.status}</span>
          </div>
        </div>
      </PageHeader>

      {/* Toast messages */}
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {message}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
          {error}
        </div>
      )}

      {/* Status overview strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Provider" value="Tally" />
        <MetricCard label="Status" value={status.status} />
        <MetricCard label="Last sync" value={formatDate(status.lastSyncAt)} mono />
        <MetricCard label="Last validation" value={formatDate(status.lastValidationAt)} mono />
      </div>

      {/* 01 · Connection */}
      <section className="surface-card overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <SectionNumber n="01" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Connection</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Store encrypted credentials and validate API connectivity.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <CredentialChip label="API key" configured={!!status.hasApiKey} />
            <CredentialChip label="Webhook secret" configured={!!status.hasWebhookSecret} />
            <CredentialChip label="Route token" configured={!!status.hasWebhookRouteToken} />
          </div>
        </div>

        <Separator />

        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="tally-api-key" className="text-xs font-medium text-muted-foreground">
                Tally API Key
              </label>
              <Input
                id="tally-api-key"
                type="password"
                placeholder="tal_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="tally-webhook-secret" className="text-xs font-medium text-muted-foreground">
                Webhook Signing Secret
              </label>
              <Input
                id="tally-webhook-secret"
                type="password"
                placeholder="whsec_..."
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={isSavingCredentials || !apiKey || !webhookSecret}
              onClick={async () => {
                setMessage(null); setError(null); setIsSavingCredentials(true);
                try {
                  if (!selectedOrgId) { setError("Select an organization first."); return; }
                  await upsertCredentials({ organizationId: selectedOrgId, apiKey, webhookSecret });
                  setApiKey(""); setWebhookSecret(""); setMessage("Credentials saved.");
                } catch (e) {
                  console.error(e);
                  setError(e instanceof Error ? e.message : "Failed to save credentials.");
                } finally {
                  setApiKey(""); setWebhookSecret(""); setIsSavingCredentials(false);
                }
              }}
            >
              {isSavingCredentials ? "Saving..." : "Save credentials"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isValidating}
              onClick={async () => {
                setMessage(null); setError(null); setIsValidating(true);
                try {
                  if (!selectedOrgId) { setError("Select an organization first."); return; }
                  const r = await validateConnection({ organizationId: selectedOrgId });
                  if (r.ok) setMessage("Connection validated successfully.");
                  else setError(r.error ?? "Validation failed.");
                } catch (e) {
                  console.error(e);
                  setError(e instanceof Error ? e.message : "Validation failed.");
                } finally {
                  setIsValidating(false);
                }
              }}
            >
              {isValidating ? "Validating..." : "Validate"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isBootstrapping}
              onClick={async () => {
                setMessage(null); setError(null); setIsBootstrapping(true);
                try {
                  if (!selectedOrgId) { setError("Select an organization first."); return; }
                  const r = await bootstrapFromEnv({ organizationId: selectedOrgId });
                  if (r.seeded) setMessage("Bootstrapped from environment variables.");
                  else setError(r.reason ?? "Bootstrap skipped.");
                } catch (e) {
                  console.error(e);
                  setError(e instanceof Error ? e.message : "Bootstrap failed.");
                } finally {
                  setIsBootstrapping(false);
                }
              }}
            >
              {isBootstrapping ? "Bootstrapping..." : "Bootstrap from env"}
            </Button>
          </div>
        </div>
      </section>

      {/* 02 · Forms */}
      <section className="surface-card overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <SectionNumber n="02" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Forms</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sync forms from Tally and assign them to webhook flows.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isSyncing}
            onClick={async () => {
              setMessage(null); setError(null); setIsSyncing(true);
              try {
                if (!selectedOrgId) { setError("Select an organization first."); return; }
                const result = await syncForms({ organizationId: selectedOrgId });
                setFormsCatalog(result.forms ?? []);
                setMappings((prev) => ({
                  quoteRequest: { ...result.suggestions?.quoteRequest, ...prev.quoteRequest },
                  bookingConfirmation: { ...result.suggestions?.bookingConfirmation, ...prev.bookingConfirmation },
                }));
                setMessage(`Synced ${result.forms?.length ?? 0} forms.`);
              } catch (e) {
                console.error(e);
                setError(e instanceof Error ? e.message : "Failed to sync forms.");
              } finally {
                setIsSyncing(false);
              }
            }}
          >
            {isSyncing ? "Syncing..." : "Sync forms"}
          </Button>
        </div>

        <Separator />

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Quote Request Form</span>
            <select
              className="w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={requestFormId}
              onChange={(e) => { localDirtyRef.current = true; setRequestFormId(e.target.value); }}
            >
              <option value="">Select a form...</option>
              {formsCatalog.map((f) => (
                <option key={f.id} value={f.id}>{f.name} ({f.id})</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Booking Confirmation Form</span>
            <select
              className="w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={confirmationFormId}
              onChange={(e) => { localDirtyRef.current = true; setConfirmationFormId(e.target.value); }}
            >
              <option value="">Select a form...</option>
              {formsCatalog.map((f) => (
                <option key={f.id} value={f.id}>{f.name} ({f.id})</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* 03 · Field Mappings */}
      <section className="surface-card overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <SectionNumber n="03" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Field Mappings</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Map Tally question fields to internal data targets.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            disabled={isSavingMappings || !requestFormId || !confirmationFormId}
            onClick={async () => {
              setMessage(null); setError(null); setIsSavingMappings(true);
              try {
                if (!selectedOrgId) { setError("Select an organization first."); return; }
                await saveMappingsAndForms({
                  organizationId: selectedOrgId,
                  requestFormId,
                  confirmationFormId,
                  fieldMappings: {
                    quoteRequest: toPayloadFlow(mappings.quoteRequest),
                    bookingConfirmation: toPayloadFlow(mappings.bookingConfirmation),
                  },
                });
                setMessage("Forms and mappings saved.");
              } catch (e) {
                console.error(e);
                setError(e instanceof Error ? e.message : "Failed to save mappings.");
              } finally {
                setIsSavingMappings(false);
              }
            }}
          >
            {isSavingMappings ? "Saving..." : "Save mappings"}
          </Button>
        </div>

        <Separator />

        {/* Tab bar */}
        <div className="flex border-b border-border/40">
          <button
            type="button"
            onClick={() => setActiveTab("quote")}
            className={cn(
              "relative px-5 py-3 text-xs font-semibold transition-colors",
              activeTab === "quote"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Quote Request
            {activeTab === "quote" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("booking")}
            className={cn(
              "relative px-5 py-3 text-xs font-semibold transition-colors",
              activeTab === "booking"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Booking Confirmation
            {activeTab === "booking" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        <div className="space-y-3 p-5">
          {activeTab === "quote" && (
            <>
              <MappingGrid
                title="Required Fields"
                subtitle="Core fields required for quote request ingestion."
                targets={QUOTE_REQUIRED_TARGETS}
                mappings={mappings.quoteRequest}
                questions={requestQuestions}
                onChange={(t, n) => setFlowMapping("quoteRequest", t, n)}
                defaultOpen={true}
              />
              <MappingGrid
                title="Optional Fields"
                subtitle="Enrichment, tracking, and attribution fields."
                targets={QUOTE_OPTIONAL_TARGETS}
                mappings={mappings.quoteRequest}
                questions={requestQuestions}
                onChange={(t, n) => setFlowMapping("quoteRequest", t, n)}
                defaultOpen={false}
              />
            </>
          )}
          {activeTab === "booking" && (
            <>
              <MappingGrid
                title="Required Fields"
                subtitle="Core fields required for booking confirmation."
                targets={CONFIRMATION_REQUIRED_TARGETS}
                mappings={mappings.bookingConfirmation}
                questions={confirmationQuestions}
                onChange={(t, n) => setFlowMapping("bookingConfirmation", t, n)}
                defaultOpen={true}
              />
              <MappingGrid
                title="Optional Fields"
                subtitle="Access, household, and scheduling metadata."
                targets={CONFIRMATION_OPTIONAL_TARGETS}
                mappings={mappings.bookingConfirmation}
                questions={confirmationQuestions}
                onChange={(t, n) => setFlowMapping("bookingConfirmation", t, n)}
                defaultOpen={false}
              />
            </>
          )}
        </div>
      </section>

      {/* 04 · Webhooks */}
      <section className="surface-card overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <SectionNumber n="04" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Webhooks</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Managed endpoints and remote webhook lifecycle.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="xs" disabled={isRefreshingWebhooks} onClick={() => runWebhookOperation("list")}>
              {isRefreshingWebhooks ? "..." : "List"}
            </Button>
            <Button variant="outline" size="xs" disabled={isEnsuringWebhooks} onClick={() => runWebhookOperation("ensure")}>
              {isEnsuringWebhooks ? "..." : "Ensure"}
            </Button>
            <Button variant="outline" size="xs" disabled={isDeletingWebhooks} onClick={() => runWebhookOperation("delete")}>
              {isDeletingWebhooks ? "..." : "Delete"}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-3 p-5">
          {/* Managed endpoints */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Managed Endpoints
            </h3>
            {managedWebhookUrls.map((entry) => (
              <WebhookEndpoint
                key={entry.key}
                label={entry.label}
                url={entry.url}
                webhookId={status.webhookIds?.[entry.key as "request" | "confirmation"] ?? undefined}
                isRevealed={revealedWebhookKeys.has(entry.key)}
                isCopied={copiedWebhookKey === entry.key}
                onReveal={() => toggleRevealWebhook(entry.key)}
                onCopy={() => copyWebhookUrl(entry.key, entry.url)}
              />
            ))}
          </div>

          {/* Expandable remote/ops section */}
          {(webhookList.length > 0 || webhookOps.length > 0) && (
            <>
              <button
                type="button"
                onClick={() => setWebhooksExpanded(!webhooksExpanded)}
                className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <svg
                  className={cn("h-3.5 w-3.5 transition-transform duration-200", webhooksExpanded && "rotate-90")}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {webhookList.length > 0 && `${webhookList.length} remote webhooks`}
                {webhookList.length > 0 && webhookOps.length > 0 && " · "}
                {webhookOps.length > 0 && `${webhookOps.length} operation results`}
              </button>

              {webhooksExpanded && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {webhookList.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground">Remote Webhooks</h4>
                      {webhookList.map((wh, i) => (
                        <div
                          key={`${wh.id ?? ""}-${wh.formId ?? ""}-${i}`}
                          className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 font-mono text-[11px]"
                        >
                          <p className="font-semibold text-foreground">{wh.id ?? "(no id)"}</p>
                          <p className="text-muted-foreground">form: {wh.formId ?? "n/a"}</p>
                          <p className="text-muted-foreground">event: {wh.eventType ?? "n/a"}</p>
                          <p className="truncate text-muted-foreground">url: {wh.url ?? "n/a"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {webhookOps.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground">Last Operation</h4>
                      {webhookOps.map((op, i) => (
                        <div
                          key={`${op.endpoint}-${i}`}
                          className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 font-mono text-[11px]"
                        >
                          <p className="font-semibold capitalize text-foreground">
                            {op.endpoint}: {op.action}
                          </p>
                          {op.webhookId && <p className="text-muted-foreground">id: {op.webhookId}</p>}
                          {op.reason && <p className="text-muted-foreground">reason: {op.reason}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* 05 · Health */}
      <section className="surface-card overflow-hidden rounded-2xl">
        <div className="flex items-start gap-2 p-5">
          <SectionNumber n="05" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Health Monitor</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recent webhook delivery attempts and validation outcomes.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-y border-border/50 bg-muted/30">
                <th className="px-5 py-2.5 font-semibold text-muted-foreground"></th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Timestamp</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Endpoint</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">HTTP</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Stage</th>
                <th className="px-3 py-2.5 font-semibold text-muted-foreground">Message</th>
              </tr>
            </thead>
            <tbody>
              {(health ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                    No webhook events recorded yet.
                  </td>
                </tr>
              )}
              {(health ?? []).map((entry) => (
                <tr key={entry._id} className="border-b border-border/30 transition-colors hover:bg-muted/20">
                  <td className="px-5 py-2.5">
                    <HealthStatusDot status={entry.httpStatus} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                    {formatDate(entry.receivedAt)}
                  </td>
                  <td className="px-3 py-2.5 font-medium capitalize text-foreground">{entry.endpoint}</td>
                  <td className="px-3 py-2.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono text-[10px] tabular-nums",
                        entry.httpStatus && entry.httpStatus >= 200 && entry.httpStatus < 300
                          ? "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                          : entry.httpStatus && entry.httpStatus >= 400
                            ? "border-red-200 text-red-600 dark:border-red-800 dark:text-red-400"
                            : "",
                      )}
                    >
                      {entry.httpStatus ?? "---"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-foreground">{entry.stage}</td>
                  <td className="max-w-xs truncate px-3 py-2.5 text-muted-foreground">
                    {entry.message ?? "---"}
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
