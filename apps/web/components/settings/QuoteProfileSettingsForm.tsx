"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type QuoteProfileFormState = {
  key: string;
  displayName: string;
  legalName: string;
  phone: string;
  email: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  defaultCurrency: string;
  defaultTaxName: string;
  defaultTaxRateBps: string;
  quoteValidityDays: string;
};

const DEFAULT_FORM: QuoteProfileFormState = {
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
};

export default function QuoteProfileSettingsForm() {
  const profile = useQuery(api.quoteProfiles.getActiveProfile, {});
  const updateProfile = useMutation(api.quoteProfiles.updateProfile);

  const [form, setForm] = useState<QuoteProfileFormState>(DEFAULT_FORM);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    if (profile === undefined || profile !== null) return;

    let cancelled = false;
    setIsBootstrapping(true);
    updateProfile({})
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile, updateProfile]);

  useEffect(() => {
    if (!profile) return;
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
  }, [profile]);

  if (profile === undefined || (profile === null && isBootstrapping)) {
    return (
      <div className="surface-card p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">
          {profile === null ? "Creating default quote profile..." : "Loading quote profile..."}
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card p-6">
      <div className="grid gap-8">
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Business Identity</h2>
            <p className="text-sm text-muted-foreground">
              Information used in quotes and customer-facing communication.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, displayName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalName">Legal Name</Label>
              <Input
                id="legalName"
                value={form.legalName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, legalName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, website: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input
                id="addressLine1"
                value={form.addressLine1}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, addressLine1: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                value={form.addressLine2}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, addressLine2: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={form.postalCode}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, postalCode: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={form.country}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, country: event.target.value }))
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Quote Defaults</h2>
            <p className="text-sm text-muted-foreground">
              Baseline tax, currency, and validity settings for generated quotes.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Default Currency</Label>
              <Input
                id="defaultCurrency"
                value={form.defaultCurrency}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, defaultCurrency: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTaxName">Default Tax Name</Label>
              <Input
                id="defaultTaxName"
                value={form.defaultTaxName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, defaultTaxName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTaxRateBps">Default Tax Rate (bps)</Label>
              <Input
                id="defaultTaxRateBps"
                type="number"
                min="0"
                value={form.defaultTaxRateBps}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, defaultTaxRateBps: event.target.value }))
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
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, quoteValidityDays: event.target.value }))
                }
              />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button
          disabled={isSaving}
          onClick={async () => {
            setIsSaving(true);
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
              setIsSaving(false);
            }
          }}
        >
          {isSaving ? "Saving..." : "Save Profile"}
        </Button>
        {status === "saved" ? <p className="text-sm text-emerald-600">Profile saved.</p> : null}
        {status === "error" ? (
          <p className="text-sm text-red-600">Failed to save profile.</p>
        ) : null}
      </div>
    </div>
  );
}
