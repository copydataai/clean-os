"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

export default function PaymentsPage() {
  const organizations = useQuery(api.queries.getUserOrganizations);
  const upsertStripeConfig = useAction(api.payments.upsertOrganizationStripeConfig);
  const disableStripeConfig = useMutation(api.payments.disableOrganizationStripeConfig);
  const [selectedOrgId, setSelectedOrgId] = useState<Id<"organizations"> | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (!organizations) {
    return (
      <div className="surface-card p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading payments settings...</p>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Payments" subtitle="Configure Stripe per organization." />
        <div className="surface-card p-6 text-sm text-muted-foreground">
          No organizations found for your account.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle="Configure Stripe credentials per organization." />

      <div className="surface-card space-y-4 p-6">
        <label className="text-sm font-medium text-foreground" htmlFor="org-select">
          Organization
        </label>
        <select
          id="org-select"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={selectedOrgId ?? ""}
          onChange={(event) => setSelectedOrgId(event.target.value as Id<"organizations">)}
        >
          {organizations.map((organization) => (
            <option key={organization._id} value={organization._id}>
              {organization.name}
            </option>
          ))}
        </select>
      </div>

      <div className="surface-card space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Connection Status</h2>
          <Badge className="bg-muted text-muted-foreground">{configStatus?.status ?? "incomplete"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Last webhook:{" "}
          {paymentHealth?.lastWebhookAt
            ? new Date(paymentHealth.lastWebhookAt).toLocaleString()
            : "No webhook received"}
        </p>
        <p className="text-sm text-muted-foreground">
          Recent webhook failures: {paymentHealth?.recentFailureCount ?? 0}
        </p>
      </div>

      <div className="surface-card space-y-4 p-6">
        <h2 className="text-base font-semibold text-foreground">Stripe Credentials</h2>
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
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Webhook URL</p>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {webhookUrl || "Configure organization slug and Convex URL to generate webhook URL."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!canManage || !selectedOrgId || isSaving || !secretKey || !webhookSecret}
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
                });
                setSecretKey("");
                setWebhookSecret("");
                setMessage("Stripe credentials saved.");
              } catch (err: any) {
                setError(err?.message ?? "Failed to save Stripe credentials.");
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
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
