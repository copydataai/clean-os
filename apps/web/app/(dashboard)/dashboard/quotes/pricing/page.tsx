"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type RuleRowProps = {
  rule: {
    _id: Id<"quotePricingRules">;
    serviceType: string;
    frequency: string;
    minSqft: number;
    maxSqft: number;
    priceCents: number;
    sortOrder: number;
    isActive: boolean;
  };
  onSave: (args: {
    ruleId: Id<"quotePricingRules">;
    serviceType: string;
    frequency: string;
    minSqft: number;
    maxSqft: number;
    priceCents: number;
    sortOrder: number;
    isActive: boolean;
  }) => Promise<void>;
  onDelete: (ruleId: Id<"quotePricingRules">) => Promise<void>;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
      {children}
    </h2>
  );
}

function ColumnLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
      {children}
    </span>
  );
}

function RuleRow({ rule, onSave, onDelete }: RuleRowProps) {
  const [serviceType, setServiceType] = useState(rule.serviceType);
  const [frequency, setFrequency] = useState(rule.frequency);
  const [minSqft, setMinSqft] = useState(String(rule.minSqft));
  const [maxSqft, setMaxSqft] = useState(String(rule.maxSqft));
  const [priceDollars, setPriceDollars] = useState((rule.priceCents / 100).toFixed(2));
  const [sortOrder, setSortOrder] = useState(String(rule.sortOrder));
  const [isActive, setIsActive] = useState(rule.isActive);
  const [saving, setSaving] = useState(false);

  const isDirty =
    serviceType !== rule.serviceType ||
    frequency !== rule.frequency ||
    minSqft !== String(rule.minSqft) ||
    maxSqft !== String(rule.maxSqft) ||
    priceDollars !== (rule.priceCents / 100).toFixed(2) ||
    sortOrder !== String(rule.sortOrder) ||
    isActive !== rule.isActive;

  return (
    <div
      className={cn(
        "group rounded-xl border bg-card/50 p-4 transition-all",
        isActive
          ? "border-border/60 hover:border-border"
          : "border-dashed border-border/40 opacity-60"
      )}
    >
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-[1fr_1fr_80px_80px_100px_60px]">
        <Input
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          className="text-sm"
        />
        <Input
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="text-sm"
        />
        <Input
          value={minSqft}
          type="number"
          onChange={(e) => setMinSqft(e.target.value)}
          className="text-sm tabular-nums"
        />
        <Input
          value={maxSqft}
          type="number"
          onChange={(e) => setMaxSqft(e.target.value)}
          className="text-sm tabular-nums"
        />
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>
              <span className="text-xs">$</span>
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            value={priceDollars}
            type="number"
            step="0.01"
            onChange={(e) => setPriceDollars(e.target.value)}
            className="text-sm tabular-nums"
          />
        </InputGroup>
        <Input
          value={sortOrder}
          type="number"
          onChange={(e) => setSortOrder(e.target.value)}
          className="text-sm tabular-nums"
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-primary"
          />
          {isActive ? "Active" : "Inactive"}
        </label>

        <div className="flex items-center gap-2">
          {isDirty ? (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
              Unsaved changes
            </span>
          ) : null}
          <Button
            size="sm"
            disabled={saving || !isDirty}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  ruleId: rule._id,
                  serviceType,
                  frequency,
                  minSqft: Number.parseInt(minSqft || "0", 10),
                  maxSqft: Number.parseInt(maxSqft || "0", 10),
                  priceCents: Math.round(Number.parseFloat(priceDollars || "0") * 100),
                  sortOrder: Number.parseInt(sortOrder || "0", 10),
                  isActive,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={async () => {
              setSaving(true);
              try {
                await onDelete(rule._id);
              } finally {
                setSaving(false);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function QuotePricingPage() {
  const rules = useQuery(api.quotePricing.listRules, {});
  const ensureDefaults = useMutation(api.quotePricing.ensureDefaults);
  const createRule = useMutation(api.quotePricing.createRule);
  const updateRule = useMutation(api.quotePricing.updateRule);
  const deleteRule = useMutation(api.quotePricing.deleteRule);

  const [newServiceType, setNewServiceType] = useState("Bi-Weekly Cleaning");
  const [newFrequency, setNewFrequency] = useState("Bi-weekly");
  const [newMinSqft, setNewMinSqft] = useState("0");
  const [newMaxSqft, setNewMaxSqft] = useState("1200");
  const [newPriceDollars, setNewPriceDollars] = useState("125.00");
  const [newSortOrder, setNewSortOrder] = useState("100");
  const [newActive, setNewActive] = useState(true);

  useEffect(() => {
    ensureDefaults({}).catch((error) => {
      console.error(error);
    });
  }, [ensureDefaults]);

  if (!rules) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs tracking-wide text-muted-foreground">Loading pricing rules...</p>
        </div>
      </div>
    );
  }

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quote Pricing Rules"
        subtitle="Manage sqft/frequency pricing used for automatic draft quote suggestions."
      >
        <div className="flex items-center gap-2">
          <Link href="/dashboard/settings/profile">
            <Button variant="outline" size="sm">
              Profile
            </Button>
          </Link>
          <Link href="/dashboard/quotes">
            <Button variant="outline" size="sm">
              Back to Quotes
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* ── new rule form ── */}
      <div className="surface-card overflow-hidden p-6">
        <SectionHeading>Create Rule</SectionHeading>
        <div className="mt-4 grid gap-x-3 gap-y-3 sm:grid-cols-[1fr_1fr_80px_80px_100px_60px]">
          <div className="space-y-1">
            <Label className="text-xs">Service Type</Label>
            <Input
              value={newServiceType}
              onChange={(e) => setNewServiceType(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Frequency</Label>
            <Input
              value={newFrequency}
              onChange={(e) => setNewFrequency(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Min sqft</Label>
            <Input
              value={newMinSqft}
              type="number"
              onChange={(e) => setNewMinSqft(e.target.value)}
              className="text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max sqft</Label>
            <Input
              value={newMaxSqft}
              type="number"
              onChange={(e) => setNewMaxSqft(e.target.value)}
              className="text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Price</Label>
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <InputGroupText>
                  <span className="text-xs">$</span>
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                value={newPriceDollars}
                type="number"
                step="0.01"
                onChange={(e) => setNewPriceDollars(e.target.value)}
                className="text-sm tabular-nums"
              />
            </InputGroup>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Order</Label>
            <Input
              value={newSortOrder}
              type="number"
              onChange={(e) => setNewSortOrder(e.target.value)}
              className="text-sm tabular-nums"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={newActive}
              onChange={(e) => setNewActive(e.target.checked)}
              className="accent-primary"
            />
            Active
          </label>
          <Button
            onClick={async () => {
              await createRule({
                serviceType: newServiceType,
                frequency: newFrequency,
                minSqft: Number.parseInt(newMinSqft || "0", 10),
                maxSqft: Number.parseInt(newMaxSqft || "0", 10),
                priceCents: Math.round(Number.parseFloat(newPriceDollars || "0") * 100),
                sortOrder: Number.parseInt(newSortOrder || "0", 10),
                isActive: newActive,
              });
            }}
          >
            Create Rule
          </Button>
        </div>
      </div>

      {/* ── existing rules ── */}
      {rules.length === 0 ? (
        <EmptyState
          title="No pricing rules found"
          description="Create your first rule to enable automatic quote price suggestions."
        />
      ) : (
        <div className="space-y-3">
          {/* column header row */}
          <div className="flex items-center justify-between px-1">
            <SectionHeading>
              Existing Rules
            </SectionHeading>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{rules.length} total</Badge>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                {activeCount} active
              </Badge>
            </div>
          </div>

          {/* column labels */}
          <div className="hidden px-5 sm:grid sm:grid-cols-[1fr_1fr_80px_80px_100px_60px] sm:gap-x-3">
            <ColumnLabel>Service Type</ColumnLabel>
            <ColumnLabel>Frequency</ColumnLabel>
            <ColumnLabel>Min sqft</ColumnLabel>
            <ColumnLabel>Max sqft</ColumnLabel>
            <ColumnLabel>Price</ColumnLabel>
            <ColumnLabel>Order</ColumnLabel>
          </div>

          <div className="space-y-2">
            {rules.map((rule) => (
              <RuleRow
                key={rule._id}
                rule={rule}
                onSave={async (values) => {
                  await updateRule(values);
                }}
                onDelete={async (ruleId) => {
                  await deleteRule({ ruleId });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
