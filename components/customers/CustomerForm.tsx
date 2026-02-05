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

type CustomerFormProps = {
  mode: "create" | "edit";
  initialData?: {
    _id: Id<"customers">;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    alternatePhone?: string | null;
    status: string;
    source?: string | null;
    squareFootage?: number | null;
    notes?: string | null;
    internalNotes?: string | null;
    address?: {
      street?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
    } | null;
  };
  onSuccess?: () => void;
};

const STATUS_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "churned", label: "Churned" },
];

const SOURCE_OPTIONS = [
  { value: "quote_request", label: "Quote Request" },
  { value: "booking", label: "Booking" },
  { value: "manual", label: "Manual Entry" },
  { value: "referral", label: "Referral" },
];

export default function CustomerForm({
  mode,
  initialData,
  onSuccess,
}: CustomerFormProps) {
  const router = useRouter();
  const createCustomer = useMutation(api.customers.create);
  const updateCustomer = useMutation(api.customers.update);

  const [firstName, setFirstName] = useState(initialData?.firstName ?? "");
  const [lastName, setLastName] = useState(initialData?.lastName ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [alternatePhone, setAlternatePhone] = useState(
    initialData?.alternatePhone ?? ""
  );
  const [status, setStatus] = useState(initialData?.status ?? "lead");
  const [source, setSource] = useState(initialData?.source ?? "manual");
  const [squareFootage, setSquareFootage] = useState(
    initialData?.squareFootage?.toString() ?? ""
  );
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [internalNotes, setInternalNotes] = useState(
    initialData?.internalNotes ?? ""
  );
  const [street, setStreet] = useState(initialData?.address?.street ?? "");
  const [addressLine2, setAddressLine2] = useState(
    initialData?.address?.addressLine2 ?? ""
  );
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
      const addressData =
        street || addressLine2 || city || state || postalCode
          ? {
              street: street || undefined,
              addressLine2: addressLine2 || undefined,
              city: city || undefined,
              state: state || undefined,
              postalCode: postalCode || undefined,
            }
          : undefined;

      if (mode === "create") {
        await createCustomer({
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          alternatePhone: alternatePhone || undefined,
          status,
          source,
          squareFootage: squareFootage ? parseInt(squareFootage) : undefined,
          notes: notes || undefined,
          internalNotes: internalNotes || undefined,
          address: addressData,
        });
        router.push("/dashboard/customers");
      } else if (initialData) {
        await updateCustomer({
          customerId: initialData._id,
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          alternatePhone: alternatePhone || undefined,
          status,
          source,
          squareFootage: squareFootage ? parseInt(squareFootage) : undefined,
          notes: notes || undefined,
          internalNotes: internalNotes || undefined,
          address: addressData,
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
          {mode === "edit" ? (
            <Field>
              <FieldLabel htmlFor="alternatePhone">Alternate Phone</FieldLabel>
              <Input
                id="alternatePhone"
                type="tel"
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value)}
                placeholder="(555) 987-6543"
              />
            </Field>
          ) : null}
        </FieldGroup>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Status</h3>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Customer Status</FieldLabel>
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
              <FieldLabel>Source</FieldLabel>
              <Select value={source} onValueChange={(v) => v && setSource(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FieldGroup>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Property</h3>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="street">Street Address</FieldLabel>
            <Input
              id="street"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="123 Main St"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="addressLine2">Address Line 2</FieldLabel>
            <Input
              id="addressLine2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Apt, Suite, Unit, etc."
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
          <Field>
            <FieldLabel htmlFor="squareFootage">Square Footage</FieldLabel>
            <Input
              id="squareFootage"
              type="number"
              value={squareFootage}
              onChange={(e) => setSquareFootage(e.target.value)}
              placeholder="2000"
            />
          </Field>
        </FieldGroup>
      </div>

      {mode === "edit" ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#1A1A1A]">Notes</h3>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="notes">Customer Notes</FieldLabel>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes visible to the customer..."
                rows={3}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="internalNotes">Internal Notes</FieldLabel>
              <Textarea
                id="internalNotes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Internal notes (not visible to customer)..."
                rows={3}
              />
            </Field>
          </FieldGroup>
        </div>
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
              ? "Create Customer"
              : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
