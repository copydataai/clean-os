"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldError,
} from "@/components/ui/field";

type CleanerFormProps = {
  mode: "create" | "edit";
  initialData?: {
    _id: Id<"cleaners">;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    status: string;
    employmentType: string;
    startDate?: string | null;
    bio?: string | null;
    address?: {
      street?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
    } | null;
  };
  onSuccess?: () => void;
};

const STATUS_OPTIONS = [
  { value: "applicant", label: "Applicant" },
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "terminated", label: "Terminated" },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "W2", label: "W2 Employee" },
  { value: "1099", label: "1099 Contractor" },
];

export default function CleanerForm({
  mode,
  initialData,
  onSuccess,
}: CleanerFormProps) {
  const router = useRouter();
  const createCleaner = useMutation(api.cleaners.create);
  const updateCleaner = useMutation(api.cleaners.update);

  const [firstName, setFirstName] = useState(initialData?.firstName ?? "");
  const [lastName, setLastName] = useState(initialData?.lastName ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [status, setStatus] = useState(initialData?.status ?? "applicant");
  const [employmentType, setEmploymentType] = useState(
    initialData?.employmentType ?? "1099"
  );
  const [startDate, setStartDate] = useState(initialData?.startDate ?? "");
  const [bio, setBio] = useState(initialData?.bio ?? "");
  const [street, setStreet] = useState(initialData?.address?.street ?? "");
  const [city, setCity] = useState(initialData?.address?.city ?? "");
  const [state, setState] = useState(initialData?.address?.state ?? "");
  const [postalCode, setPostalCode] = useState(
    initialData?.address?.postalCode ?? ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await createCleaner({
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          status,
          employmentType,
        });
        router.push("/cleaners");
      } else if (initialData) {
        await updateCleaner({
          cleanerId: initialData._id,
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          status,
          employmentType,
          startDate: startDate || undefined,
          bio: bio || undefined,
          address:
            street || city || state || postalCode
              ? {
                  street: street || undefined,
                  city: city || undefined,
                  state: state || undefined,
                  postalCode: postalCode || undefined,
                }
              : undefined,
        });
        onSuccess?.();
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? <FieldError>{error}</FieldError> : null}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">
          Basic Information
        </h3>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="firstName">First Name *</FieldLabel>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="John"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lastName">Last Name *</FieldLabel>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                placeholder="Doe"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="email">Email *</FieldLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="john@example.com"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Phone</FieldLabel>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </Field>
          </div>
        </FieldGroup>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Employment</h3>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Employment Type</FieldLabel>
              <Select value={employmentType} onValueChange={(v) => v && setEmploymentType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="startDate">Start Date</FieldLabel>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>
          </div>
        </FieldGroup>
      </div>

      {mode === "edit" ? (
        <>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Address</h3>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="street">Street</FieldLabel>
                <Input
                  id="street"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="123 Main St"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="city">City</FieldLabel>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="San Francisco"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="state">State</FieldLabel>
                  <Input
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="CA"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="postalCode">Postal Code</FieldLabel>
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="94102"
                  />
                </Field>
              </div>
            </FieldGroup>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Additional</h3>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="bio">Bio</FieldLabel>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Brief description or notes about this cleaner..."
                  rows={3}
                />
              </Field>
            </FieldGroup>
          </div>
        </>
      ) : null}

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create Cleaner"
              : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
