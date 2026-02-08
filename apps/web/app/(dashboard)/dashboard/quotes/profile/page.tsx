"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function QuoteProfilePage() {
  const profile = useQuery(api.quoteProfiles.getActiveProfile, {});
  const updateProfile = useMutation(api.quoteProfiles.updateProfile);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const [form, setForm] = useState({
    key: "kathy_clean_default",
    displayName: "",
    legalName: "",
    phone: "",
    email: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    defaultCurrency: "usd",
    defaultTaxName: "Colorado",
    defaultTaxRateBps: "0",
    quoteValidityDays: "30",
  });

  useEffect(() => {
    if (!profile) {
      updateProfile({}).catch((error) => {
        console.error(error);
      });
      return;
    }
    setForm({
      key: profile.key,
      displayName: profile.displayName,
      legalName: profile.legalName,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2 ?? "",
      city: profile.city,
      state: profile.state,
      postalCode: profile.postalCode,
      country: profile.country,
      defaultCurrency: profile.defaultCurrency,
      defaultTaxName: profile.defaultTaxName,
      defaultTaxRateBps: String(profile.defaultTaxRateBps),
      quoteValidityDays: String(profile.quoteValidityDays),
    });
  }, [profile, updateProfile]);

  const isLoading = profile === undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quote Profile"
        subtitle="Manage business identity and default quote settings."
      >
        <div className="flex items-center gap-2">
          <Link href="/dashboard/quotes">
            <Button variant="outline" size="sm">
              Back to Quotes
            </Button>
          </Link>
          <Link href="/dashboard/quotes/pricing">
            <Button variant="outline" size="sm">
              Pricing Rules
            </Button>
          </Link>
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="surface-card p-8 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading quote profile...</p>
        </div>
      ) : (
        <div className="surface-card p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalName">Legal Name</Label>
              <Input
                id="legalName"
                value={form.legalName}
                onChange={(e) => setForm((prev) => ({ ...prev, legalName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website}
                onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input
                id="addressLine1"
                value={form.addressLine1}
                onChange={(e) => setForm((prev) => ({ ...prev, addressLine1: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                value={form.addressLine2}
                onChange={(e) => setForm((prev) => ({ ...prev, addressLine2: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={form.postalCode}
                onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={form.country}
                onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Default Currency</Label>
              <Input
                id="defaultCurrency"
                value={form.defaultCurrency}
                onChange={(e) => setForm((prev) => ({ ...prev, defaultCurrency: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTaxName">Default Tax Name</Label>
              <Input
                id="defaultTaxName"
                value={form.defaultTaxName}
                onChange={(e) => setForm((prev) => ({ ...prev, defaultTaxName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTaxRateBps">Default Tax Rate (bps)</Label>
              <Input
                id="defaultTaxRateBps"
                type="number"
                min="0"
                value={form.defaultTaxRateBps}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, defaultTaxRateBps: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quoteValidityDays">Quote Validity (days)</Label>
              <Input
                id="quoteValidityDays"
                type="number"
                min="1"
                value={form.quoteValidityDays}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, quoteValidityDays: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setStatus("idle");
                try {
                  const quoteValidityDays = Math.max(
                    1,
                    Number.parseInt(form.quoteValidityDays || "30", 10)
                  );
                  const defaultTaxRateBps = Math.max(
                    0,
                    Number.parseInt(form.defaultTaxRateBps || "0", 10)
                  );
                  await updateProfile({
                    key: form.key,
                    displayName: form.displayName,
                    legalName: form.legalName,
                    phone: form.phone,
                    email: form.email,
                    website: form.website,
                    addressLine1: form.addressLine1,
                    addressLine2: form.addressLine2 || undefined,
                    city: form.city,
                    state: form.state,
                    postalCode: form.postalCode,
                    country: form.country,
                    defaultCurrency: form.defaultCurrency,
                    defaultTaxName: form.defaultTaxName,
                    defaultTaxRateBps,
                    quoteValidityDays,
                  });
                  setStatus("saved");
                } catch (error) {
                  console.error(error);
                  setStatus("error");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving..." : "Save Profile"}
            </Button>
            {status === "saved" ? (
              <p className="text-sm text-emerald-600">Profile saved.</p>
            ) : null}
            {status === "error" ? (
              <p className="text-sm text-red-600">Failed to save profile.</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

