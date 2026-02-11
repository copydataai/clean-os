"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import PageHeader from "@/components/dashboard/PageHeader";
import { useActiveOrganization } from "@/components/org/useActiveOrganization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function isAdminRole(role?: string | null) {
  const normalized = (role ?? "").toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "owner" ||
    normalized.endsWith(":admin") ||
    normalized.endsWith(":owner") ||
    normalized.includes("admin")
  );
}

function formatTimestamp(timestamp?: number | null) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString();
}

function statusLabel(status?: string | null) {
  return (status ?? "incomplete").replace(/_/g, " ");
}

function deriveKeyMode(key?: string | null) {
  const normalized = (key ?? "").trim().toLowerCase();
  if (normalized.startsWith("sk_live_") || normalized.startsWith("pk_live_")) return "live";
  if (normalized.startsWith("sk_test_") || normalized.startsWith("pk_test_")) return "test";
  return null;
}

function toConvexSiteBaseUrl(input?: string | null) {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  const trimmed = raw.replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    if (url.hostname.endsWith(".convex.cloud")) {
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
    }
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

/* ------------------------------------------------------------------ */
/*  Micro-components                                                  */
/* ------------------------------------------------------------------ */

function PulsingDot({ healthy }: { healthy: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
          healthy ? "bg-emerald-400" : "bg-amber-400"
        )}
      />
      <span
        className={cn(
          "relative inline-flex h-2.5 w-2.5 rounded-full",
          healthy ? "bg-emerald-500" : "bg-amber-500"
        )}
      />
    </span>
  );
}

function StatusRow({
  label,
  value,
  ok,
  mono,
  delay,
}: {
  label: string;
  value: React.ReactNode;
  ok: boolean;
  mono?: boolean;
  delay?: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3.5 py-2.5 backdrop-blur-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-500"
      style={{ animationDelay: delay }}
    >
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[13px] font-semibold",
          mono && "font-mono text-xs",
          ok
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-amber-600 dark:text-amber-400"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            ok ? "bg-emerald-500" : "bg-amber-500"
          )}
        />
        {value}
      </span>
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  delay,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  delay?: string;
}) {
  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-background/90 to-muted/30 p-4 backdrop-blur-sm transition-shadow hover:shadow-md animate-in fade-in-0 slide-in-from-bottom-3 duration-600"
      style={{ animationDelay: delay }}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary/8 blur-xl transition-all group-hover:bg-primary/14" />
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2.5 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      {sub ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
      ) : null}
    </article>
  );
}

function FieldGroup({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[13px] font-medium text-foreground" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? (
          <span className="font-mono text-[10px] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function PaymentsPage() {
  const { organizations, activeOrg: selectedOrg, switchOrganization, isLoading } =
    useActiveOrganization();
  const environmentStatus = useQuery(api.payments.getPaymentsEnvironmentStatus);
  const upsertStripeConfig = useAction(api.payments.upsertOrganizationStripeConfig);
  const disableStripeConfig = useMutation(api.payments.disableOrganizationStripeConfig);
  const selectedOrgId = (selectedOrg?._id as Id<"organizations"> | null | undefined) ?? null;
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const canManage = Boolean(selectedOrg && isAdminRole(selectedOrg.role));

  const configStatus = useQuery(
    api.payments.getOrganizationStripeConfigStatus,
    selectedOrgId ? { organizationId: selectedOrgId } : "skip"
  );
  const paymentHealth = useQuery(
    api.payments.getOrganizationPaymentHealth,
    selectedOrgId ? { organizationId: selectedOrgId } : "skip"
  );

  const webhookUrl = useMemo(() => {
    if (!configStatus?.orgSlug) return "";
    const base = toConvexSiteBaseUrl(process.env.NEXT_PUBLIC_CONVEX_URL);
    if (!base) return "";
    return `${base}/stripe-webhook?org=${encodeURIComponent(configStatus.orgSlug)}`;
  }, [configStatus?.orgSlug]);

  useEffect(() => {
    setMessage(null);
    setError(null);
    setCopiedWebhook(false);
  }, [selectedOrgId]);

  /* ---- derived state ---- */
  const environmentReady = environmentStatus?.ready ?? false;
  const environmentMessage =
    environmentStatus?.message ?? "Checking payment environment configuration...";
  const rawConfigStatus = configStatus?.status ?? "incomplete";
  const configStatusKey = rawConfigStatus.toLowerCase();
  const enteredSecretMode = deriveKeyMode(secretKey);
  const enteredPublishableMode = deriveKeyMode(publishableKey);
  const hasModeMismatch =
    Boolean(enteredSecretMode) &&
    Boolean(enteredPublishableMode) &&
    enteredSecretMode !== enteredPublishableMode;
  const hasExistingModeMismatch =
    Boolean(configStatus?.mode) &&
    Boolean(enteredSecretMode) &&
    configStatus?.mode !== enteredSecretMode;
  const connectionIsHealthy =
    environmentReady &&
    configStatusKey === "configured" &&
    (paymentHealth?.recentDeliveryFailureCount ?? 0) === 0;
  const connectionState = !environmentReady
    ? "Platform blocked"
    : (paymentHealth?.recentDeliveryFailureCount ?? 0) > 0
      ? "Needs attention"
      : configStatusKey === "configured"
        ? "Healthy"
        : "Setup required";

  const canSave =
    canManage &&
    environmentReady &&
    Boolean(selectedOrgId) &&
    !isSaving &&
    Boolean(secretKey) &&
    Boolean(webhookSecret) &&
    Boolean(publishableKey) &&
    !hasModeMismatch &&
    !hasExistingModeMismatch;

  /* ---- loading ---- */
  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm tracking-wide text-muted-foreground">
            Initializing payment systems&hellip;
          </p>
        </div>
      </div>
    );
  }

  /* ---- no orgs ---- */
  if (organizations.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payments" subtitle="Configure Stripe per organization." />
        <div className="surface-card flex flex-col items-center justify-center gap-3 rounded-3xl px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            No organizations found. Create one to start configuring payments.
          </p>
        </div>
      </div>
    );
  }

  /* ---- main ---- */
  return (
    <div className="relative isolate space-y-6 overflow-hidden">
      {/* atmospheric glow */}
      <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full bg-primary/15 blur-[100px]" />
      <div className="pointer-events-none absolute -left-28 top-60 h-72 w-72 rounded-full bg-accent/25 blur-[80px]" />

      {/* header */}
      <PageHeader title="Payments" subtitle="Stripe credentials, webhook health, and connection diagnostics.">
        <div className="flex items-center gap-2.5">
          <PulsingDot healthy={connectionIsHealthy} />
          <span className="text-sm font-medium text-foreground">{connectionState}</span>
        </div>
      </PageHeader>

      {/* signal board + org selector */}
      <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
        {/* signal board */}
        <section className="surface-card relative overflow-hidden rounded-3xl p-6">
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-accent/15 blur-2xl" />

          <div className="relative space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
                  Signal board
                </p>
                <h2 className="mt-1.5 text-xl font-semibold text-foreground">
                  {selectedOrg?.name ?? "Select organization"}
                </h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Real-time Stripe connection and webhook delivery health.
                </p>
              </div>
              <Badge
                className={cn(
                  "capitalize",
                  configStatusKey === "configured"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300"
                    : configStatusKey === "disabled"
                      ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300"
                )}
              >
                {statusLabel(rawConfigStatus)}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile
                label="Connection"
                value={connectionState}
                sub={environmentReady ? "Platform ready" : "Platform offline"}
                delay="60ms"
              />
              <MetricTile
                label="Recent failures"
                value={paymentHealth?.recentDeliveryFailureCount ?? 0}
                sub={
                  (paymentHealth?.recentDeliveryFailureCount ?? 0) === 0
                    ? "All deliveries ok"
                    : "Check delivery log"
                }
                delay="140ms"
              />
              <MetricTile
                label="Last webhook"
                value={
                  <span className="text-base">
                    {formatTimestamp(paymentHealth?.lastWebhookAt)}
                  </span>
                }
                sub={`Mode: ${configStatus?.mode ?? "unknown"}`}
                delay="220ms"
              />
            </div>
          </div>
        </section>

        {/* workspace scope */}
        <section className="surface-card rounded-3xl p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
            Workspace scope
          </p>

          <div className="mt-4 space-y-3">
            <FieldGroup label="Organization" htmlFor="org-select">
              <Select
                value={selectedOrgId ?? ""}
                onValueChange={async (value) => {
                  if (!value) return;
                  const organization = organizations.find((item) => item._id === value);
                  if (!organization) return;
                  await switchOrganization(organization);
                }}
              >
                <SelectTrigger
                  id="org-select"
                  className="w-full justify-between rounded-xl border-border/60 bg-background/70 backdrop-blur-sm"
                >
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((organization) => (
                    <SelectItem key={organization._id} value={organization._id}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>

          <div className="mt-5 rounded-xl border border-border/60 bg-muted/30 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Your role
              </p>
              <Badge variant="outline" className="capitalize text-[11px]">
                {selectedOrg?.role ? statusLabel(selectedOrg.role) : "Unknown"}
              </Badge>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {canManage
                ? "Full access — you can update credentials and manage configuration."
                : "View-only — contact an admin to update payment settings."}
            </p>
          </div>

          {/* key version + timeline mini */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-center">
              <p className="font-mono text-lg font-bold text-foreground">
                v{configStatus?.keyVersion ?? 0}
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Key version
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-center">
              <p className="font-mono text-lg font-bold capitalize text-foreground">
                {configStatus?.mode ?? "—"}
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Key mode
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* credential locker + connection diagnostics */}
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        {/* credential locker */}
        <section className="surface-card rounded-3xl p-6">
          {!environmentReady ? (
            <div className="mb-5 rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-200/70 dark:bg-amber-900/50">
                  <svg className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-200">
                    Platform configuration required
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
                    {environmentMessage}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
                    Set <code className="rounded bg-amber-200/50 px-1 py-0.5 font-mono text-[11px] dark:bg-amber-900/40">PAYMENT_SECRETS_MASTER_KEY</code> in Convex environment variables.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
                Credential locker
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Encrypted Stripe keys for {selectedOrg?.name ?? "this organization"}.
              </p>
            </div>
            <PulsingDot healthy={connectionIsHealthy} />
          </div>

          {!canManage ? (
            <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
              <p className="text-[12px] text-muted-foreground">
                You can view connection status, but only admins and owners can update credentials.
              </p>
            </div>
          ) : null}

          <div className={cn("mt-5 space-y-4", !canManage && "opacity-60")}>
            <FieldGroup label="Secret Key" htmlFor="stripe-secret-key" hint="sk_live_… or sk_test_…">
              <Input
                id="stripe-secret-key"
                type="password"
                placeholder="sk_live_…"
                value={secretKey}
                onChange={(event) => setSecretKey(event.target.value)}
                disabled={!canManage || isSaving}
                className="rounded-xl border-border/60 bg-background/70 font-mono text-sm backdrop-blur-sm"
              />
            </FieldGroup>

            <FieldGroup label="Publishable Key" htmlFor="stripe-publishable-key" hint="pk_live_… or pk_test_…">
              <Input
                id="stripe-publishable-key"
                type="password"
                placeholder="pk_live_…"
                value={publishableKey}
                onChange={(event) => setPublishableKey(event.target.value)}
                disabled={!canManage || isSaving}
                className="rounded-xl border-border/60 bg-background/70 font-mono text-sm backdrop-blur-sm"
              />
            </FieldGroup>

            <FieldGroup label="Webhook Secret" htmlFor="stripe-webhook-secret" hint="whsec_…">
              <Input
                id="stripe-webhook-secret"
                type="password"
                placeholder="whsec_…"
                value={webhookSecret}
                onChange={(event) => setWebhookSecret(event.target.value)}
                disabled={!canManage || isSaving}
                className="rounded-xl border-border/60 bg-background/70 font-mono text-sm backdrop-blur-sm"
              />
            </FieldGroup>

            {hasModeMismatch || hasExistingModeMismatch ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3.5 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <p className="text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
                  Key mode mismatch — secret and publishable keys must both be test or both be live.
                </p>
              </div>
            ) : null}

            {/* webhook URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[13px] font-medium text-foreground">Webhook URL</label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!webhookUrl}
                  className="h-7 rounded-lg px-2.5 text-[11px]"
                  onClick={async () => {
                    if (!webhookUrl) return;
                    try {
                      await navigator.clipboard.writeText(webhookUrl);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 1500);
                    } catch {
                      setError("Failed to copy webhook URL.");
                    }
                  }}
                >
                  {copiedWebhook ? "Copied!" : "Copy"}
                </Button>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/25 px-3.5 py-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground backdrop-blur-sm">
                {webhookUrl || "Configure organization slug and Convex URL to generate webhook URL."}
              </div>
            </div>
          </div>

          {/* actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/50 pt-5">
            <Button
              disabled={!canSave}
              className="rounded-xl px-5"
              onClick={async () => {
                if (!selectedOrgId) return;
                setIsSaving(true);
                setMessage(null);
                setError(null);
                try {
                  await upsertStripeConfig({
                    organizationId: selectedOrgId,
                    secretKey,
                    webhookSecret,
                    publishableKey,
                  });
                  setSecretKey("");
                  setPublishableKey("");
                  setWebhookSecret("");
                  setMessage("Stripe credentials saved and encrypted.");
                } catch (err: any) {
                  const raw = err?.message ?? "Failed to save Stripe credentials.";
                  if (raw.includes("PAYMENT_ENV_NOT_CONFIGURED")) {
                    setError(
                      "Payment encryption is not configured. Add PAYMENT_SECRETS_MASTER_KEY to Convex environment variables."
                    );
                  } else if (raw.includes("PAYMENT_ENV_INVALID_MASTER_KEY")) {
                    setError(
                      "PAYMENT_SECRETS_MASTER_KEY is invalid. It must be a base64-encoded 32-byte key."
                    );
                  } else {
                    setError(raw);
                  }
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? "Encrypting…" : "Save credentials"}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={!canManage || !selectedOrgId || isDisabling}
              onClick={async () => {
                if (!selectedOrgId) return;
                setIsDisabling(true);
                setMessage(null);
                setError(null);
                try {
                  await disableStripeConfig({ organizationId: selectedOrgId });
                  setMessage("Stripe configuration disabled.");
                } catch (err: any) {
                  setError(err?.message ?? "Failed to disable Stripe configuration.");
                } finally {
                  setIsDisabling(false);
                }
              }}
            >
              {isDisabling ? "Disabling…" : "Disable"}
            </Button>
          </div>

          {/* feedback */}
          {message ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3.5 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <p className="text-[13px] text-emerald-700 dark:text-emerald-300">{message}</p>
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200/80 bg-rose-50/60 px-3.5 py-2.5 dark:border-rose-900/50 dark:bg-rose-950/30">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
              <p className="text-[13px] text-rose-700 dark:text-rose-300">{error}</p>
            </div>
          ) : null}
        </section>

        {/* connection diagnostics */}
        <aside className="surface-card rounded-3xl p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">
            Connection diagnostics
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Key storage and webhook delivery status.
          </p>

          <div className="mt-5 space-y-2">
            <StatusRow
              label="Secret key"
              value={configStatus?.hasSecretKey ? "Stored" : "Missing"}
              ok={configStatus?.hasSecretKey ?? false}
              delay="40ms"
            />
            <StatusRow
              label="Publishable key"
              value={configStatus?.hasPublishableKey ? "Stored" : "Missing"}
              ok={configStatus?.hasPublishableKey ?? false}
              delay="100ms"
            />
            <StatusRow
              label="Webhook secret"
              value={configStatus?.hasWebhookSecret ? "Stored" : "Missing"}
              ok={configStatus?.hasWebhookSecret ?? false}
              delay="160ms"
            />
            <StatusRow
              label="Last delivery"
              value={paymentHealth?.lastAttemptStatus ?? "No attempts"}
              ok={(paymentHealth?.lastAttemptStatus ?? 200) < 400}
              mono
              delay="220ms"
            />
          </div>

          {/* timeline */}
          <div className="mt-5 rounded-xl border border-border/60 bg-muted/25 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Timeline
            </p>
            <div className="mt-3 space-y-2">
              {[
                { label: "Config updated", value: formatTimestamp(configStatus?.updatedAt) },
                { label: "Last webhook", value: formatTimestamp(paymentHealth?.lastWebhookAt) },
                { label: "Last failure", value: formatTimestamp(paymentHealth?.lastFailureAt) },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-muted-foreground">{row.label}</span>
                  <span className="font-mono text-[11px] font-medium text-foreground">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            {paymentHealth?.lastFailureMessage ? (
              <div className="mt-3 rounded-lg border border-border/60 bg-background/60 px-2.5 py-2">
                <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {paymentHealth.lastFailureMessage}
                </p>
              </div>
            ) : null}
          </div>

          {/* recent delivery failures */}
          {(paymentHealth?.recentAttempts?.length ?? 0) > 0 ? (
            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Recent delivery failures
              </p>
              <div className="mt-2.5 space-y-2">
                {paymentHealth?.recentAttempts
                  ?.filter((attempt) => attempt.httpStatus >= 400)
                  .slice(0, 5)
                  .map((attempt) => (
                    <div
                      key={attempt._id}
                      className="rounded-xl border border-rose-200/60 bg-rose-50/40 px-3 py-2.5 dark:border-rose-900/40 dark:bg-rose-950/20"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                        <p className="font-mono text-[12px] font-semibold text-rose-700 dark:text-rose-300">
                          {attempt.httpStatus}
                        </p>
                        <span className="text-[11px] text-rose-600/70 dark:text-rose-400/70">
                          {statusLabel(attempt.failureStage)}
                        </span>
                      </div>
                      <p className="mt-1 pl-3.5 text-[11px] text-muted-foreground">
                        {attempt.failureMessage ?? "No message"}
                      </p>
                      <p className="mt-0.5 pl-3.5 font-mono text-[10px] text-muted-foreground/70">
                        {formatTimestamp(attempt.receivedAt)}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
