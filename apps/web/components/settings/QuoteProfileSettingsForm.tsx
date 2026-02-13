"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────── */

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
  brandColor: string;
  accentColor: string;
  tagline: string;
  logoUrl: string;
  iconUrl: string;
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
  brandColor: "#1A3C34",
  accentColor: "#C5BCAD",
  tagline: "",
  logoUrl: "",
  iconUrl: "",
};

/* ─── Sub-components ────────────────────────────────────────── */

function SectionNumber({ n }: { n: string }) {
  return (
    <span className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
      {n}
    </span>
  );
}

function FieldWrapper({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
        </label>
        {hint && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function CompletionDot({ filled }: { filled: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-1 w-1 rounded-full transition-colors",
        filled ? "bg-emerald-500" : "bg-border",
      )}
    />
  );
}

/* ─── Main Form ─────────────────────────────────────────────── */

export default function QuoteProfileSettingsForm() {
  const profile = useQuery(api.quoteProfiles.getActiveProfile, {});
  const updateProfile = useMutation(api.quoteProfiles.updateProfile);
  const generateUploadUrl = useMutation(api.quoteProfiles.generateUploadUrl);
  const saveBrandingImage = useMutation(api.quoteProfiles.saveBrandingImage);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);

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
        if (!cancelled) setIsBootstrapping(false);
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
      brandColor: profile.brandColor ?? "#1A3C34",
      accentColor: profile.accentColor ?? "#C5BCAD",
      tagline: profile.tagline ?? "",
      logoUrl: profile.logoUrl ?? "",
      iconUrl: profile.iconUrl ?? "",
    });
  }, [profile]);

  const handleImageUpload = async (
    file: File,
    field: "logo" | "icon",
  ) => {
    const setUploading = field === "logo" ? setUploadingLogo : setUploadingIcon;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      const result = await saveBrandingImage({ storageId, field });
      setForm((prev) => ({
        ...prev,
        [field === "logo" ? "logoUrl" : "iconUrl"]: result.url ?? "",
      }));
    } catch (err) {
      console.error(`Failed to upload ${field}`, err);
    } finally {
      setUploading(false);
    }
  };

  const set = (field: keyof QuoteProfileFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (status !== "idle") setStatus("idle");
  };

  // Identity completion
  const identityFields = [form.displayName, form.legalName, form.phone, form.email];
  const identityFilled = identityFields.filter(Boolean).length;
  const addressFields = [form.addressLine1, form.city, form.state, form.postalCode, form.country];
  const addressFilled = addressFields.filter(Boolean).length;

  if (profile === undefined || (profile === null && isBootstrapping)) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">
          {profile === null ? "Creating default profile..." : "Loading profile..."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Profile identifier strip */}
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Profile
        </span>
        <Separator orientation="vertical" className="h-4" />
        <span className="font-mono text-xs text-foreground">{form.key}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <CompletionDot filled={identityFilled === identityFields.length} />
            Identity {identityFilled}/{identityFields.length}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <CompletionDot filled={addressFilled === addressFields.length} />
            Address {addressFilled}/{addressFields.length}
          </span>
        </div>
      </div>

      {/* 01 · Business Identity */}
      <section className="surface-card overflow-hidden rounded-2xl">
        <div className="flex items-start gap-2 p-5">
          <SectionNumber n="01" />
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Business Identity</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Company details used in quotes and customer-facing communications.
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] tabular-nums">
                {identityFilled}/{identityFields.length} fields
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-5 p-5">
          {/* Company names */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWrapper id="displayName" label="Display Name" hint="Shown on quotes">
              <Input id="displayName" value={form.displayName} onChange={set("displayName")} placeholder="JoluAI" />
            </FieldWrapper>
            <FieldWrapper id="legalName" label="Legal Name" hint="For invoices & contracts">
              <Input id="legalName" value={form.legalName} onChange={set("legalName")} placeholder="JoluAI LLC" />
            </FieldWrapper>
          </div>

          {/* Contact */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWrapper id="phone" label="Phone">
              <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="(303) 555-0123" />
            </FieldWrapper>
            <FieldWrapper id="email" label="Email">
              <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="hello@kathysclean.com" />
            </FieldWrapper>
          </div>

          {/* Website */}
          <FieldWrapper id="website" label="Website">
            <Input id="website" type="url" value={form.website} onChange={set("website")} placeholder="https://kathysclean.com" />
          </FieldWrapper>

          <Separator className="opacity-50" />

          {/* Address */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Business Address
              </h3>
              <Badge variant="outline" className="font-mono text-[10px] tabular-nums">
                {addressFilled}/{addressFields.length}
              </Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldWrapper id="addressLine1" label="Street Address">
                <Input id="addressLine1" value={form.addressLine1} onChange={set("addressLine1")} placeholder="123 Main St" />
              </FieldWrapper>
              <FieldWrapper id="addressLine2" label="Unit / Suite" hint="Optional">
                <Input id="addressLine2" value={form.addressLine2} onChange={set("addressLine2")} placeholder="Suite 100" />
              </FieldWrapper>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <FieldWrapper id="city" label="City" className="sm:col-span-2">
                <Input id="city" value={form.city} onChange={set("city")} placeholder="Denver" />
              </FieldWrapper>
              <FieldWrapper id="state" label="State">
                <Input id="state" value={form.state} onChange={set("state")} placeholder="CO" />
              </FieldWrapper>
              <FieldWrapper id="postalCode" label="ZIP">
                <Input id="postalCode" value={form.postalCode} onChange={set("postalCode")} placeholder="80202" className="font-mono" />
              </FieldWrapper>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <FieldWrapper id="country" label="Country" className="sm:col-span-2">
                <Input id="country" value={form.country} onChange={set("country")} placeholder="US" />
              </FieldWrapper>
            </div>
          </div>
        </div>
      </section>

      {/* 03 · Branding */}
      <section className="surface-card overflow-hidden rounded-2xl">
        <div className="flex items-start gap-2 p-5">
          <SectionNumber n="03" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Branding</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Logo, colors, and tagline used in emails and PDFs.
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-5 p-5">
          {/* Logo & Icon uploads */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Logo</label>
              <p className="text-[10px] text-muted-foreground">Recommended 280×80px, PNG or SVG</p>
              <div className="flex items-center gap-3">
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt="Logo"
                    className="h-10 max-w-[140px] rounded border border-border/60 bg-white object-contain p-1"
                  />
                ) : (
                  <div className="flex h-10 w-[140px] items-center justify-center rounded border border-dashed border-border/60 bg-muted/30 text-[10px] text-muted-foreground">
                    No logo
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {uploadingLogo ? "Uploading..." : "Upload"}
                </Button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, "logo");
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Icon</label>
              <p className="text-[10px] text-muted-foreground">Square, 64×64px minimum</p>
              <div className="flex items-center gap-3">
                {form.iconUrl ? (
                  <img
                    src={form.iconUrl}
                    alt="Icon"
                    className="h-10 w-10 rounded border border-border/60 bg-white object-contain p-1"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-border/60 bg-muted/30 text-[10px] text-muted-foreground">
                    —
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingIcon}
                  onClick={() => iconInputRef.current?.click()}
                >
                  {uploadingIcon ? "Uploading..." : "Upload"}
                </Button>
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, "icon");
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWrapper id="brandColor" label="Brand Color" hint="Primary color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.brandColor}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, brandColor: e.target.value }));
                    if (status !== "idle") setStatus("idle");
                  }}
                  className="h-8 w-8 cursor-pointer rounded border border-border/60"
                />
                <Input
                  id="brandColor"
                  value={form.brandColor}
                  onChange={set("brandColor")}
                  placeholder="#1A3C34"
                  className="font-mono"
                />
              </div>
            </FieldWrapper>
            <FieldWrapper id="accentColor" label="Accent Color" hint="Dividers & details">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, accentColor: e.target.value }));
                    if (status !== "idle") setStatus("idle");
                  }}
                  className="h-8 w-8 cursor-pointer rounded border border-border/60"
                />
                <Input
                  id="accentColor"
                  value={form.accentColor}
                  onChange={set("accentColor")}
                  placeholder="#C5BCAD"
                  className="font-mono"
                />
              </div>
            </FieldWrapper>
          </div>

          {/* Tagline */}
          <FieldWrapper id="tagline" label="Tagline" hint="Shown in email footer">
            <Input
              id="tagline"
              value={form.tagline}
              onChange={set("tagline")}
              placeholder="AI-powered operations"
            />
          </FieldWrapper>
        </div>
      </section>

      {/* 02 · Quote Defaults */}
      <section className="surface-card overflow-hidden rounded-2xl">
        <div className="flex items-start gap-2 p-5">
          <SectionNumber n="02" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Quote Defaults</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Currency, tax, and validity settings applied to new quotes.
            </p>
          </div>
        </div>

        <Separator />

        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FieldWrapper id="defaultCurrency" label="Currency" hint="ISO 4217">
              <Input
                id="defaultCurrency"
                value={form.defaultCurrency}
                onChange={set("defaultCurrency")}
                placeholder="usd"
                className="font-mono uppercase"
              />
            </FieldWrapper>
            <FieldWrapper id="defaultTaxName" label="Tax Jurisdiction">
              <Input
                id="defaultTaxName"
                value={form.defaultTaxName}
                onChange={set("defaultTaxName")}
                placeholder="Colorado"
              />
            </FieldWrapper>
            <FieldWrapper id="defaultTaxRateBps" label="Tax Rate" hint="basis points">
              <Input
                id="defaultTaxRateBps"
                type="number"
                min="0"
                value={form.defaultTaxRateBps}
                onChange={set("defaultTaxRateBps")}
                placeholder="0"
                className="font-mono"
              />
            </FieldWrapper>
            <FieldWrapper id="quoteValidityDays" label="Validity Period" hint="days">
              <Input
                id="quoteValidityDays"
                type="number"
                min="1"
                value={form.quoteValidityDays}
                onChange={set("quoteValidityDays")}
                placeholder="30"
                className="font-mono"
              />
            </FieldWrapper>
          </div>
        </div>
      </section>

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          disabled={isSaving}
          onClick={async () => {
            setIsSaving(true);
            setStatus("idle");
            try {
              const quoteValidityDays = Math.max(1, Number.parseInt(form.quoteValidityDays || "30", 10));
              const defaultTaxRateBps = Math.max(0, Number.parseInt(form.defaultTaxRateBps || "0", 10));

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
                brandColor: form.brandColor || undefined,
                accentColor: form.accentColor || undefined,
                tagline: form.tagline || undefined,
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

        {status === "saved" && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Profile saved.
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            Failed to save profile.
          </span>
        )}
      </div>
    </div>
  );
}
