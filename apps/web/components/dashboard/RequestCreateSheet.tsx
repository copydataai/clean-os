"use client";

import type { ComponentProps } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import type { Id } from "@clean-os/convex/data-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  parseCommaSeparated,
  validateRequestCreateInput,
  type RequestCreateMode,
} from "./requestCreateValidation";
import { onboardingApi } from "@/lib/onboarding/api";
import { onboardingRequestPath } from "@/lib/onboarding/routes";

type CreateFromDashboardResult = {
  bookingRequestId: Id<"bookingRequests">;
  quoteRequestId: Id<"quoteRequests">;
  reusedQuote: boolean;
};

type RequestCreateSheetProps = {
  onCreated?: (result: CreateFromDashboardResult) => void;
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
};

function formatQuoteLabel(quote: {
  fullName?: string | null;
  email?: string | null;
  service?: string | null;
  serviceType?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  const name = quote.fullName ?? quote.email ?? "Unnamed quote";
  const service = quote.serviceType ?? quote.service ?? "Service not set";
  const location = [quote.address, quote.city, quote.state].filter(Boolean).join(", ");
  return {
    title: name,
    subtitle: [service, location || null].filter(Boolean).join(" • "),
  };
}

function trimToOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function trimOrEmpty(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function trimOrFallback(value: string | null | undefined, fallback: string): string {
  const trimmed = trimOrEmpty(value);
  return trimmed.length > 0 ? trimmed : fallback;
}

function getErrorCode(error: unknown): string | null {
  const parseMessageCode = (message: string): string | null => {
    if (/^[A-Z0-9_]+$/.test(message)) {
      return message;
    }
    try {
      const parsed = JSON.parse(message) as { code?: unknown };
      return typeof parsed?.code === "string" ? parsed.code : null;
    } catch {
      return null;
    }
  };

  if (error && typeof error === "object") {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object") {
      const code = (data as { code?: unknown }).code;
      if (typeof code === "string") {
        return code;
      }
    }
  }

  if (error instanceof Error) {
    return parseMessageCode(error.message);
  }

  return null;
}

export default function RequestCreateSheet({
  onCreated,
  triggerLabel = "New onboarding",
  triggerVariant = "default",
}: RequestCreateSheetProps) {
  const router = useRouter();
  const createFromDashboard = useMutation(onboardingApi.createRequestFromDashboard);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RequestCreateMode>("new");
  const [selectedQuoteRequestId, setSelectedQuoteRequestId] = useState<Id<"quoteRequests"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [service, setService] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [frequency, setFrequency] = useState("");
  const [squareFootage, setSquareFootage] = useState("");
  const [address, setAddress] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [quoteAdditionalNotes, setQuoteAdditionalNotes] = useState("");

  const [accessMethodInput, setAccessMethodInput] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");
  const [parkingInstructions, setParkingInstructions] = useState("");
  const [floorTypesInput, setFloorTypesInput] = useState("");
  const [finishedBasement, setFinishedBasement] = useState("");
  const [delicateSurfaces, setDelicateSurfaces] = useState("");
  const [attentionAreas, setAttentionAreas] = useState("");
  const [petsInput, setPetsInput] = useState("");
  const [homeDuringCleanings, setHomeDuringCleanings] = useState("");
  const [scheduleAdjustmentWindowsInput, setScheduleAdjustmentWindowsInput] = useState("");
  const [timingShiftOk, setTimingShiftOk] = useState("");
  const [requestAdditionalNotes, setRequestAdditionalNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quoteResults = useQuery(
    onboardingApi.searchQuoteRequestsForLinking,
    open && mode === "existing"
      ? {
          query: searchQuery.trim() || undefined,
          limit: 25,
        }
      : "skip"
  );

  const selectedQuoteDetails = useQuery(
    onboardingApi.getQuoteRequestById,
    open && mode === "existing" && selectedQuoteRequestId
      ? { id: selectedQuoteRequestId }
      : "skip"
  );

  const selectedQuote = useMemo(
    () => quoteResults?.find((quote) => quote._id === selectedQuoteRequestId) ?? null,
    [quoteResults, selectedQuoteRequestId]
  );

  const selectedQuotePreview = useMemo(() => {
    if (!selectedQuoteRequestId) return null;

    const firstName = trimOrEmpty(selectedQuoteDetails?.firstName ?? selectedQuote?.firstName);
    const lastName = trimOrEmpty(selectedQuoteDetails?.lastName ?? selectedQuote?.lastName);
    const fullName = `${firstName} ${lastName}`.trim();
    const emailValue = trimOrEmpty(selectedQuoteDetails?.email ?? selectedQuote?.email);
    const serviceValue = trimOrEmpty(
      selectedQuoteDetails?.serviceType ??
        selectedQuoteDetails?.service ??
        selectedQuote?.serviceType ??
        selectedQuote?.service
    );
    const addressValue = [
      trimOrEmpty(selectedQuoteDetails?.address ?? selectedQuote?.address),
      trimOrEmpty(selectedQuoteDetails?.city ?? selectedQuote?.city),
      trimOrEmpty(selectedQuoteDetails?.state ?? selectedQuote?.state),
    ]
      .filter(Boolean)
      .join(", ");

    return {
      name: fullName || selectedQuote?.fullName || emailValue || "Unnamed quote",
      email: emailValue || null,
      service: serviceValue || null,
      address: addressValue || null,
    };
  }, [selectedQuote, selectedQuoteDetails, selectedQuoteRequestId]);

  function resetForm() {
    setMode("new");
    setSelectedQuoteRequestId(null);
    setSearchQuery("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setService("");
    setServiceType("");
    setFrequency("");
    setSquareFootage("");
    setAddress("");
    setAddressLine2("");
    setPostalCode("");
    setCity("");
    setState("");
    setQuoteAdditionalNotes("");
    setAccessMethodInput("");
    setAccessInstructions("");
    setParkingInstructions("");
    setFloorTypesInput("");
    setFinishedBasement("");
    setDelicateSurfaces("");
    setAttentionAreas("");
    setPetsInput("");
    setHomeDuringCleanings("");
    setScheduleAdjustmentWindowsInput("");
    setTimingShiftOk("");
    setRequestAdditionalNotes("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const isExistingMode = mode === "existing";

    if (isExistingMode && !selectedQuoteRequestId) {
      setError("Select an existing quote.");
      return;
    }

    if (isExistingMode && selectedQuoteDetails === undefined) {
      setError("Loading selected quote details. Try again in a moment.");
      return;
    }

    if (isExistingMode && !selectedQuoteDetails) {
      setError("Selected quote is unavailable.");
      return;
    }

    const existingQuote = isExistingMode ? selectedQuoteDetails : null;
    const derivedContact = {
      firstName: isExistingMode
        ? trimOrEmpty(existingQuote?.firstName ?? selectedQuote?.firstName ?? firstName)
        : firstName.trim(),
      lastName: isExistingMode
        ? trimOrEmpty(existingQuote?.lastName ?? selectedQuote?.lastName ?? lastName)
        : lastName.trim(),
      email: isExistingMode
        ? trimOrEmpty(existingQuote?.email ?? selectedQuote?.email ?? email)
        : email.trim(),
      phone: isExistingMode
        ? trimOrEmpty(existingQuote?.phone ?? phone)
        : phone.trim(),
    };
    const derivedSquareFootageRaw = isExistingMode
      ? existingQuote?.squareFootage != null
        ? String(existingQuote.squareFootage)
        : squareFootage
      : squareFootage;
    const derivedQuote = {
      service: isExistingMode
        ? trimOrFallback(existingQuote?.service ?? selectedQuote?.service ?? service, "Quoted service")
        : service.trim(),
      serviceType: isExistingMode
        ? trimOrFallback(
            existingQuote?.serviceType ?? selectedQuote?.serviceType ?? serviceType,
            "Quoted service"
          )
        : serviceType.trim(),
      frequency: isExistingMode
        ? trimOrEmpty(existingQuote?.frequency ?? frequency)
        : frequency.trim(),
      squareFootage: derivedSquareFootageRaw,
      address: isExistingMode
        ? trimOrFallback(existingQuote?.address ?? selectedQuote?.address ?? address, "Unknown address")
        : address.trim(),
      addressLine2: isExistingMode
        ? trimOrEmpty(existingQuote?.addressLine2 ?? addressLine2)
        : addressLine2.trim(),
      postalCode: isExistingMode
        ? trimOrFallback(existingQuote?.postalCode ?? postalCode, "00000")
        : postalCode.trim(),
      city: isExistingMode
        ? trimOrFallback(existingQuote?.city ?? selectedQuote?.city ?? city, "Unknown city")
        : city.trim(),
      state: isExistingMode
        ? trimOrFallback(existingQuote?.state ?? selectedQuote?.state ?? state, "NA")
        : state.trim(),
      additionalNotes: isExistingMode
        ? trimOrEmpty(existingQuote?.additionalNotes ?? quoteAdditionalNotes)
        : quoteAdditionalNotes.trim(),
    };

    const errors = validateRequestCreateInput({
      mode,
      existingQuoteRequestId: selectedQuoteRequestId,
      contact: derivedContact,
      quote: {
        service: derivedQuote.service,
        serviceType: derivedQuote.serviceType,
        squareFootage: derivedQuote.squareFootage,
        address: derivedQuote.address,
        postalCode: derivedQuote.postalCode,
        city: derivedQuote.city,
        state: derivedQuote.state,
      },
    });

    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }

    const parsedSquareFootage = Number.parseInt(derivedQuote.squareFootage, 10);
    if (!isExistingMode && (!Number.isFinite(parsedSquareFootage) || parsedSquareFootage <= 0)) {
      setError("Square footage must be a positive number.");
      return;
    }
    const squareFootageValue =
      Number.isFinite(parsedSquareFootage) && parsedSquareFootage > 0
        ? parsedSquareFootage
        : (() => {
            if (isExistingMode) {
              console.warn(
                `[RequestCreateSheet] Existing quote missing valid squareFootage (got "${derivedQuote.squareFootage}"), defaulting to 1`
              );
            }
            return 1;
          })();

    setIsSubmitting(true);
    try {
      const result = await createFromDashboard({
        mode,
        existingQuoteRequestId: mode === "existing" ? selectedQuoteRequestId ?? undefined : undefined,
        contact: derivedContact,
        quote: {
          service: derivedQuote.service,
          serviceType: derivedQuote.serviceType,
          frequency: trimToOptional(derivedQuote.frequency),
          squareFootage: squareFootageValue,
          address: derivedQuote.address,
          addressLine2: trimToOptional(derivedQuote.addressLine2),
          postalCode: derivedQuote.postalCode,
          city: derivedQuote.city,
          state: derivedQuote.state,
          additionalNotes: trimToOptional(derivedQuote.additionalNotes),
        },
        request: {
          accessMethod: parseCommaSeparated(accessMethodInput),
          accessInstructions: trimToOptional(accessInstructions),
          parkingInstructions: trimToOptional(parkingInstructions),
          floorTypes: parseCommaSeparated(floorTypesInput),
          finishedBasement: trimToOptional(finishedBasement),
          delicateSurfaces: trimToOptional(delicateSurfaces),
          attentionAreas: trimToOptional(attentionAreas),
          pets: parseCommaSeparated(petsInput),
          homeDuringCleanings: trimToOptional(homeDuringCleanings),
          scheduleAdjustmentWindows: parseCommaSeparated(scheduleAdjustmentWindowsInput),
          timingShiftOk: trimToOptional(timingShiftOk),
          additionalNotes: trimToOptional(requestAdditionalNotes),
        },
      });

      setOpen(false);
      resetForm();
      onCreated?.(result);
      const quoteMode = result.reusedQuote ? "reused" : "created";
      router.push(
        `${onboardingRequestPath(result.bookingRequestId)}?created=1&quote_mode=${quoteMode}`
      );
    } catch (submitError) {
      const message = submitError instanceof Error
        ? submitError.message
        : "Failed to create onboarding.";
      const code = getErrorCode(submitError);

      if (code === "QUOTE_ALREADY_LINKED_TO_REQUEST") {
        setError(
          "That quote is already linked to another intake. Open the existing linked intake instead."
        );
      } else if (
        code === "ORG_MISMATCH" ||
        code === "ORG_CONTEXT_REQUIRED" ||
        code === "QUOTE_REQUEST_NOT_FOUND"
      ) {
        setError("Unable to link this quote in the current organization.");
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <Button size="sm" variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <SheetContent className="data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Create Onboarding</SheetTitle>
          <SheetDescription>
            Create a new onboarding intake and connect it to quote workflows.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
          <div className="space-y-5 overflow-y-auto px-4 pb-4">
            {error ? <FieldError>{error}</FieldError> : null}

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Intake type</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("new");
                    setSelectedQuoteRequestId(null);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    mode === "new"
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  New intake
                </button>
                <button
                  type="button"
                  onClick={() => setMode("existing")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    mode === "existing"
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  Existing quote
                </button>
              </div>
            </div>

            {mode === "existing" ? (
              <div className="space-y-3 rounded-xl border border-border/70 bg-card p-3">
                <p className="text-sm font-medium text-foreground">Link existing quote</p>
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, email, service, address"
                />

                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {!quoteResults ? (
                    <p className="text-xs text-muted-foreground">Loading quotes...</p>
                  ) : quoteResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No quotes found for this search.</p>
                  ) : (
                    quoteResults.map((quote) => {
                      const isSelected = selectedQuoteRequestId === quote._id;
                      const isLinked = Boolean(quote.bookingRequestId);
                      const display = formatQuoteLabel(quote);
                      return (
                        <button
                          type="button"
                          key={quote._id}
                          disabled={isLinked}
                          onClick={() => setSelectedQuoteRequestId(quote._id)}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:bg-muted/60",
                            isLinked ? "cursor-not-allowed opacity-60" : null
                          )}
                        >
                          <p className="text-sm font-medium text-foreground">{display.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{display.subtitle}</p>
                          {isLinked ? (
                            <p className="mt-1 text-xs text-amber-700">
                              Already linked to intake {quote.bookingRequestId}
                            </p>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>

                {selectedQuoteRequestId ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <p className="font-semibold uppercase tracking-[0.12em]">Using selected quote data</p>
                    {selectedQuoteDetails === undefined ? (
                      <p className="mt-2 text-emerald-700 dark:text-emerald-300">
                        Loading selected quote details...
                      </p>
                    ) : selectedQuoteDetails === null ? (
                      <p className="mt-2 text-rose-700 dark:text-rose-300">
                        Selected quote is unavailable.
                      </p>
                    ) : (
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        <p>
                          <span className="font-semibold">Name:</span> {selectedQuotePreview?.name ?? "---"}
                        </p>
                        <p>
                          <span className="font-semibold">Email:</span> {selectedQuotePreview?.email ?? "---"}
                        </p>
                        <p>
                          <span className="font-semibold">Service:</span> {selectedQuotePreview?.service ?? "---"}
                        </p>
                        <p>
                          <span className="font-semibold">Address:</span> {selectedQuotePreview?.address ?? "---"}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {mode === "new" ? (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Contact</h3>
                  <FieldGroup>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="request-first-name">First name *</FieldLabel>
                        <Input
                          id="request-first-name"
                          value={firstName}
                          onChange={(event) => setFirstName(event.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="request-last-name">Last name *</FieldLabel>
                        <Input
                          id="request-last-name"
                          value={lastName}
                          onChange={(event) => setLastName(event.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="request-email">Email *</FieldLabel>
                        <Input
                          id="request-email"
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="request-phone">Phone *</FieldLabel>
                        <Input
                          id="request-phone"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                        />
                      </Field>
                    </div>
                  </FieldGroup>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Quote details</h3>
                  <FieldGroup>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="request-service">Service *</FieldLabel>
                        <Input
                          id="request-service"
                          value={service}
                          onChange={(event) => setService(event.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="request-service-type">Service type *</FieldLabel>
                        <Input
                          id="request-service-type"
                          value={serviceType}
                          onChange={(event) => setServiceType(event.target.value)}
                        />
                      </Field>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="request-frequency">Frequency</FieldLabel>
                        <Input
                          id="request-frequency"
                          value={frequency}
                          onChange={(event) => setFrequency(event.target.value)}
                          placeholder="Weekly, bi-weekly, monthly"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="request-square-footage">Square footage *</FieldLabel>
                        <Input
                          id="request-square-footage"
                          inputMode="numeric"
                          value={squareFootage}
                          onChange={(event) => setSquareFootage(event.target.value)}
                        />
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel htmlFor="request-address">Address *</FieldLabel>
                      <Input
                        id="request-address"
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="request-address-line2">Address line 2</FieldLabel>
                      <Input
                        id="request-address-line2"
                        value={addressLine2}
                        onChange={(event) => setAddressLine2(event.target.value)}
                      />
                    </Field>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field>
                        <FieldLabel htmlFor="request-postal-code">Postal code *</FieldLabel>
                        <Input
                          id="request-postal-code"
                          value={postalCode}
                          onChange={(event) => setPostalCode(event.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="request-city">City *</FieldLabel>
                        <Input
                          id="request-city"
                          value={city}
                          onChange={(event) => setCity(event.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="request-state">State *</FieldLabel>
                        <Input
                          id="request-state"
                          value={state}
                          onChange={(event) => setState(event.target.value)}
                        />
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel htmlFor="request-quote-notes">Quote notes</FieldLabel>
                      <Textarea
                        id="request-quote-notes"
                        value={quoteAdditionalNotes}
                        onChange={(event) => setQuoteAdditionalNotes(event.target.value)}
                        rows={3}
                      />
                    </Field>
                  </FieldGroup>
                </div>
              </>
            ) : null}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Intake details (optional)</h3>
              <FieldGroup>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="request-access-method">Access method</FieldLabel>
                    <Input
                      id="request-access-method"
                      value={accessMethodInput}
                      onChange={(event) => setAccessMethodInput(event.target.value)}
                      placeholder="Comma separated"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="request-floor-types">Floor types</FieldLabel>
                    <Input
                      id="request-floor-types"
                      value={floorTypesInput}
                      onChange={(event) => setFloorTypesInput(event.target.value)}
                      placeholder="Comma separated"
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="request-pets">Pets</FieldLabel>
                    <Input
                      id="request-pets"
                      value={petsInput}
                      onChange={(event) => setPetsInput(event.target.value)}
                      placeholder="Comma separated"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="request-schedule-adjustments">Schedule adjustment windows</FieldLabel>
                    <Input
                      id="request-schedule-adjustments"
                      value={scheduleAdjustmentWindowsInput}
                      onChange={(event) => setScheduleAdjustmentWindowsInput(event.target.value)}
                      placeholder="Comma separated"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="request-access-instructions">Access instructions</FieldLabel>
                  <Textarea
                    id="request-access-instructions"
                    rows={2}
                    value={accessInstructions}
                    onChange={(event) => setAccessInstructions(event.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="request-parking-instructions">Parking instructions</FieldLabel>
                  <Textarea
                    id="request-parking-instructions"
                    rows={2}
                    value={parkingInstructions}
                    onChange={(event) => setParkingInstructions(event.target.value)}
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="request-finished-basement">Finished basement</FieldLabel>
                    <Input
                      id="request-finished-basement"
                      value={finishedBasement}
                      onChange={(event) => setFinishedBasement(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="request-delicate-surfaces">Delicate surfaces</FieldLabel>
                    <Input
                      id="request-delicate-surfaces"
                      value={delicateSurfaces}
                      onChange={(event) => setDelicateSurfaces(event.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="request-attention-areas">Attention areas</FieldLabel>
                    <Input
                      id="request-attention-areas"
                      value={attentionAreas}
                      onChange={(event) => setAttentionAreas(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="request-home-during-cleanings">Home during cleanings</FieldLabel>
                    <Input
                      id="request-home-during-cleanings"
                      value={homeDuringCleanings}
                      onChange={(event) => setHomeDuringCleanings(event.target.value)}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="request-timing-shift-ok">Timing shift ok</FieldLabel>
                  <Input
                    id="request-timing-shift-ok"
                    value={timingShiftOk}
                    onChange={(event) => setTimingShiftOk(event.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="request-additional-notes">Intake notes</FieldLabel>
                  <Textarea
                    id="request-additional-notes"
                    rows={3}
                    value={requestAdditionalNotes}
                    onChange={(event) => setRequestAdditionalNotes(event.target.value)}
                  />
                </Field>
              </FieldGroup>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create onboarding"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
