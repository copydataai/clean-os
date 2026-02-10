"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import PageHeader from "@/components/dashboard/PageHeader";
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
  if (!timestamp) return "No data yet";
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

export default function PaymentsPage() {
  const organizations = useQuery(api.queries.getUserOrganizations);
  const environmentStatus = useQuery(api.payments.getPaymentsEnvironmentStatus);
  const upsertStripeConfig = useAction(api.payments.upsertOrganizationStripeConfig);
  const disableStripeConfig = useMutation(api.payments.disableOrganizationStripeConfig);
  const [selectedOrgId, setSelectedOrgId] = useState<Id<"organizations"> | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    if (!selectedOrgId && organizations?.length) {
      const firstOrgId = organizations[0]?._id as Id<"organizations"> | undefined;
      if (firstOrgId) {
        setSelectedOrgId(firstOrgId);
      }
    }
  }, [organizations, selectedOrgId]);

  const selectedOrg = useMemo(
    () => organizations?.find((org) => org._id === selectedOrgId) ?? null,
    [organizations, selectedOrgId]
  );
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
    if (!configStatus?.orgSlug) {
      return "";
    }
    const base = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
    return `${base}/stripe-webhook?org=${encodeURIComponent(configStatus.orgSlug)}`;
  }, [configStatus?.orgSlug]);

  useEffect(() => {
    setMessage(null);
    setError(null);
    setCopiedWebhook(false);
  }, [selectedOrgId]);

  if (!organizations) {
    return (
      <div className="surface-card p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading payments settings...</p>
      </div>
    );
  }

  const environmentReady = environmentStatus?.ready ?? false;
  const environmentMessage =
    environmentStatus?.message ??
    "Checking payment environment configuration...";
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
  const statusTone = cn(
    "capitalize",
    configStatusKey === "configured"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300"
      : configStatusKey === "disabled"
        ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300"
  );
  const healthTone = connectionIsHealthy
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300";

  if (organizations.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payments" subtitle="Configure Stripe per organization." />
        <div className="surface-card rounded-3xl p-6 text-sm text-muted-foreground">
          No organizations found for your account.
        </div>
      </div>
    );
  }

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

  return (
    <div className="relative isolate space-y-6 overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-12 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 top-44 h-72 w-72 rounded-full bg-accent/35 blur-3xl" />
      <PageHeader title="Payments" subtitle="Configure Stripe credentials per organization." />

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <section className="surface-card relative overflow-hidden rounded-3xl border-primary/20 bg-gradient-to-br from-card via-card to-primary/8 p-6">
          <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-primary/15 blur-2xl" />
          <div className="relative space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Payment control center
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">Stripe signal board</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Real-time configuration and webhook health for{" "}
                  <span className="font-medium text-foreground">{selectedOrg?.name ?? "selected org"}</span>.
                </p>
              </div>
              <Badge className={statusTone}>{statusLabel(rawConfigStatus)}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <article
                className="rounded-2xl border border-border/70 bg-background/80 p-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: "40ms" }}
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Connection</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{connectionState}</p>
              </article>
              <article
                className="rounded-2xl border border-border/70 bg-background/80 p-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: "110ms" }}
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Recent failures</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {paymentHealth?.recentDeliveryFailureCount ?? 0}
                </p>
              </article>
              <article
                className="rounded-2xl border border-border/70 bg-background/80 p-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: "180ms" }}
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Last webhook</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatTimestamp(paymentHealth?.lastWebhookAt)}
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="surface-card rounded-3xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Workspace scope
          </p>
          <label className="mt-3 block text-sm font-medium text-foreground" htmlFor="org-select">
            Organization
          </label>
          <Select
            value={selectedOrgId ?? ""}
            onValueChange={(value) => {
              if (value) {
                setSelectedOrgId(value as Id<"organizations">);
              }
            }}
          >
            <SelectTrigger id="org-select" className="mt-2 w-full justify-between rounded-xl border-border/70 bg-background/70">
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
          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/40 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Role</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {selectedOrg?.role ? statusLabel(selectedOrg.role) : "Unknown role"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canManage
                ? "You can update keys for this organization."
                : "View-only mode for this organization."}
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="surface-card rounded-3xl p-6">
          {!environmentReady ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium tracking-tight">Platform payment configuration required</p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">{environmentMessage}</p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                Set <code>PAYMENT_SECRETS_MASTER_KEY</code> in Convex environment variables, then
                reload this page.
              </p>
            </div>
          ) : null}
          <div className={cn("space-y-4", !environmentReady ? "mt-4" : "")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Credential locker</h2>
              <Badge className={healthTone}>{connectionState}</Badge>
            </div>
            {!canManage ? (
              <p className="text-sm text-muted-foreground">
                You can view status, but only organization admins/owners can update credentials.
              </p>
            ) : null}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground" htmlFor="stripe-secret-key">
                Stripe Secret Key
              </label>
              <Input
                id="stripe-secret-key"
                type="password"
                placeholder="sk_live_..."
                value={secretKey}
                onChange={(event) => setSecretKey(event.target.value)}
                disabled={!canManage || isSaving}
                className="rounded-xl border-border/70 bg-background/80"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground" htmlFor="stripe-publishable-key">
                Stripe Publishable Key
              </label>
              <Input
                id="stripe-publishable-key"
                type="password"
                placeholder="pk_live_..."
                value={publishableKey}
                onChange={(event) => setPublishableKey(event.target.value)}
                disabled={!canManage || isSaving}
                className="rounded-xl border-border/70 bg-background/80"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground" htmlFor="stripe-webhook-secret">
                Stripe Webhook Secret
              </label>
              <Input
                id="stripe-webhook-secret"
                type="password"
                placeholder="whsec_..."
                value={webhookSecret}
                onChange={(event) => setWebhookSecret(event.target.value)}
                disabled={!canManage || isSaving}
                className="rounded-xl border-border/70 bg-background/80"
              />
            </div>
            {hasModeMismatch || hasExistingModeMismatch ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                Key mode mismatch detected. Secret and publishable keys must both be test or both be live.
              </p>
            ) : null}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Webhook URL</p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!webhookUrl}
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
                  {copiedWebhook ? "Copied" : "Copy URL"}
                </Button>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                {webhookUrl || "Configure organization slug and Convex URL to generate webhook URL."}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                disabled={!canSave}
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
                    setMessage("Stripe credentials saved.");
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
                {isSaving ? "Saving..." : "Save Credentials"}
              </Button>
              <Button
                variant="outline"
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
                {isDisabling ? "Disabling..." : "Disable"}
              </Button>
            </div>
            {message ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </p>
            ) : null}
          </div>
        </section>

        <aside className="surface-card rounded-3xl p-6">
          <h2 className="text-base font-semibold text-foreground">Connection status</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Key rotation and webhook delivery diagnostics for the selected organization.
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
              <span className="text-sm text-muted-foreground">Secret key stored</span>
              <Badge
                className={
                  configStatus?.hasSecretKey
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300"
                }
              >
                {configStatus?.hasSecretKey ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
              <span className="text-sm text-muted-foreground">Webhook secret stored</span>
              <Badge
                className={
                  configStatus?.hasWebhookSecret
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300"
                }
              >
                {configStatus?.hasWebhookSecret ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
              <span className="text-sm text-muted-foreground">Publishable key stored</span>
              <Badge
                className={
                  configStatus?.hasPublishableKey
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300"
                }
              >
                {configStatus?.hasPublishableKey ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
              <span className="text-sm text-muted-foreground">Last delivery status</span>
              <Badge
                className={
                  (paymentHealth?.lastAttemptStatus ?? 200) >= 400
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-300"
                }
              >
                {paymentHealth?.lastAttemptStatus ?? "No attempts"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-3 py-2">
              <span className="text-sm text-muted-foreground">Current key version</span>
              <Badge className="bg-muted text-muted-foreground">{configStatus?.keyVersion ?? 0}</Badge>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/40 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline</p>
            <p className="mt-2 text-sm text-foreground">
              Updated: <span className="font-medium">{formatTimestamp(configStatus?.updatedAt)}</span>
            </p>
            <p className="mt-1 text-sm text-foreground">
              Mode: <span className="font-medium capitalize">{configStatus?.mode ?? "unknown"}</span>
            </p>
            <p className="mt-1 text-sm text-foreground">
              Last webhook:{" "}
              <span className="font-medium">{formatTimestamp(paymentHealth?.lastWebhookAt)}</span>
            </p>
            <p className="mt-1 text-sm text-foreground">
              Last failure:{" "}
              <span className="font-medium">{formatTimestamp(paymentHealth?.lastFailureAt)}</span>
            </p>
            {paymentHealth?.lastFailureMessage ? (
              <p className="mt-2 rounded-xl border border-border/70 bg-background/70 px-2 py-1.5 text-xs text-muted-foreground">
                {paymentHealth.lastFailureMessage}
              </p>
            ) : null}
          </div>
          {(paymentHealth?.recentAttempts?.length ?? 0) > 0 ? (
            <div className="mt-4 rounded-2xl border border-border/70 bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Recent delivery failures
              </p>
              <div className="mt-2 space-y-2">
                {paymentHealth?.recentAttempts
                  ?.filter((attempt) => attempt.httpStatus >= 400)
                  .slice(0, 5)
                  .map((attempt) => (
                    <div key={attempt._id} className="rounded-xl border border-border/70 px-2 py-1.5 text-xs">
                      <p className="font-medium text-foreground">
                        {attempt.httpStatus} · {statusLabel(attempt.failureStage)}
                      </p>
                      <p className="text-muted-foreground">{attempt.failureMessage ?? "No message"}</p>
                      <p className="text-muted-foreground">{formatTimestamp(attempt.receivedAt)}</p>
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
