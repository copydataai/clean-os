"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function RuleRow({ rule, onSave, onDelete }: RuleRowProps) {
  const [serviceType, setServiceType] = useState(rule.serviceType);
  const [frequency, setFrequency] = useState(rule.frequency);
  const [minSqft, setMinSqft] = useState(String(rule.minSqft));
  const [maxSqft, setMaxSqft] = useState(String(rule.maxSqft));
  const [priceDollars, setPriceDollars] = useState((rule.priceCents / 100).toFixed(2));
  const [sortOrder, setSortOrder] = useState(String(rule.sortOrder));
  const [isActive, setIsActive] = useState(rule.isActive);
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Input value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
        <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} />
        <Input value={minSqft} type="number" onChange={(e) => setMinSqft(e.target.value)} />
        <Input value={maxSqft} type="number" onChange={(e) => setMaxSqft(e.target.value)} />
        <Input value={priceDollars} type="number" step="0.01" onChange={(e) => setPriceDollars(e.target.value)} />
        <Input value={sortOrder} type="number" onChange={(e) => setSortOrder(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={saving}
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
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={saving}
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
      <div className="surface-card p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">Loading pricing rules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quote Pricing Rules"
        subtitle="Manage sqft/frequency pricing used for automatic draft quote suggestions."
      >
        <div className="flex items-center gap-2">
          <Link href="/dashboard/quotes/profile">
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

      <div className="surface-card p-6">
        <h2 className="text-lg font-semibold text-foreground">New Rule</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Service Type</Label>
            <Input value={newServiceType} onChange={(e) => setNewServiceType(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Frequency</Label>
            <Input value={newFrequency} onChange={(e) => setNewFrequency(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Min sqft</Label>
            <Input value={newMinSqft} type="number" onChange={(e) => setNewMinSqft(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Max sqft</Label>
            <Input value={newMaxSqft} type="number" onChange={(e) => setNewMaxSqft(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Price (USD)</Label>
            <Input
              value={newPriceDollars}
              type="number"
              step="0.01"
              onChange={(e) => setNewPriceDollars(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Sort order</Label>
            <Input value={newSortOrder} type="number" onChange={(e) => setNewSortOrder(e.target.value)} />
          </div>
          <label className="mt-7 flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} />
            Active
          </label>
        </div>
        <div className="mt-4">
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

      {rules.length === 0 ? (
        <EmptyState
          title="No pricing rules found"
          description="Create your first rule to enable automatic quote price suggestions."
        />
      ) : (
        <div className="grid gap-3">
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
      )}
    </div>
  );
}
