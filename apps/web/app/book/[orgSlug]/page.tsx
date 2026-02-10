"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Id } from "@clean-os/convex/data-model";

function BookPageContent() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params?.orgSlug;
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "confirm" | "redirecting" | "error">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<Id<"bookings"> | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [cardSummary, setCardSummary] = useState<{
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
  } | null>(null);

  const rawBookingId = searchParams.get("booking_id");
  const rawRequestId = searchParams.get("request_id");
  const debugEnabled = process.env.NODE_ENV !== "production" || searchParams.get("debug") === "1";
  const traceIdRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `book-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
  const existingBookingId = rawBookingId && /^[a-z0-9]+$/.test(rawBookingId)
    ? (rawBookingId as Id<"bookings">)
    : null;
  const requestId = rawRequestId && /^[a-z0-9]+$/.test(rawRequestId)
    ? (rawRequestId as Id<"bookingRequests">)
    : null;
  const publicBookingContext = useQuery(
    api.bookingRequests.getPublicBookingContext,
    requestId ? { requestId } : "skip"
  );
  const organization = useQuery(
    api.payments.getOrganizationByPublicHandle,
    !requestId && orgSlug ? { handle: orgSlug } : "skip"
  );
  const publicStripeConfig = useQuery(
    api.payments.getPublicStripeRecoveryConfig,
    !requestId && orgSlug ? { handle: orgSlug } : "skip"
  );
  const bookingSummary = useQuery(
    api.bookings.getPublicBookingSummary,
    bookingId ? { id: bookingId } : "skip"
  );

  const createBooking = useMutation(api.bookings.createBookingFromTally);
  const createBookingFromRequest = useMutation(api.bookings.createBookingFromRequest);
  const createCheckoutSession = useAction(api.stripeActions.createCheckoutSession);
  const getCardOnFileStatus = useAction(api.stripeActions.getCardOnFileStatus);
  const markCardOnFile = useMutation(api.bookings.markCardOnFile);

  const checkoutStartedRef = useRef(false);
  const cardCheckStartedRef = useRef(false);
  const bookingCreationStartedRef = useRef(false);

  const logDebug = useCallback(
    (event: string, data?: Record<string, unknown>, level: "log" | "warn" | "error" = "log") => {
      if (!debugEnabled) {
        return;
      }
      console[level](`[BookFlow:${traceIdRef.current}] ${event}`, {
        orgSlug,
        requestId: requestId ?? null,
        ...data,
      });
    },
    [debugEnabled, orgSlug, requestId]
  );

  useEffect(() => {
    logDebug("init", {
      rawBookingId,
      rawRequestId,
      hasBookingId: Boolean(existingBookingId),
      hasRequestId: Boolean(requestId),
      query: searchParams.toString(),
    });
  }, [logDebug, rawBookingId, rawRequestId, existingBookingId, requestId, searchParams]);

  useEffect(() => {
    logDebug("status_changed", { status });
  }, [logDebug, status]);

  function setPublicRequestError(errorCode?: string | null) {
    logDebug("public_request_error", { errorCode }, "warn");
    if (errorCode === "REQUEST_NOT_FOUND") {
      setError("Booking request not found. Please contact support for a new link.");
      setStatus("error");
      return;
    }
    if (errorCode === "ORG_DATA_CONFLICT") {
      setError(
        "Booking request configuration conflict detected. Please contact support."
      );
      setStatus("error");
      return;
    }
    if (errorCode === "ORG_NOT_CONFIGURED_PUBLIC") {
      setError(
        "Payments are not configured for this organization yet. Please contact support."
      );
      setStatus("error");
      return;
    }
    if (errorCode === "ORG_CONTEXT_REQUIRED") {
      setError(
        "This booking request is missing organization context. Please contact support."
      );
      setStatus("error");
    }
  }

  const startCheckout = useCallback(async (resolvedBookingId: Id<"bookings">) => {
    if (checkoutStartedRef.current) {
      return;
    }
    checkoutStartedRef.current = true;
    try {
      const baseUrl = window.location.origin;
      const requestParam = requestId ? `&request_id=${encodeURIComponent(requestId)}` : "";
      logDebug("checkout_start", {
        bookingId: resolvedBookingId,
        successPath: `/book/success?booking_id=${resolvedBookingId}&org=${encodeURIComponent(orgSlug ?? "")}${requestParam}`,
        cancelPath: `/book/cancel?booking_id=${resolvedBookingId}&org=${encodeURIComponent(orgSlug ?? "")}${requestParam}`,
      });
      const { checkoutUrl } = await createCheckoutSession({
        bookingId: resolvedBookingId,
        successUrl: `${baseUrl}/book/success?booking_id=${resolvedBookingId}&org=${encodeURIComponent(orgSlug ?? "")}${requestParam}`,
        cancelUrl: `${baseUrl}/book/cancel?booking_id=${resolvedBookingId}&org=${encodeURIComponent(orgSlug ?? "")}${requestParam}`,
      });

      logDebug("checkout_session_created", { bookingId: resolvedBookingId, checkoutUrl });
      setStatus("redirecting");
      window.location.href = checkoutUrl;
    } catch (err: any) {
      checkoutStartedRef.current = false;
      logDebug(
        "checkout_error",
        { bookingId: resolvedBookingId, message: err?.message, stack: err?.stack },
        "error"
      );
      setError(err.message ?? "Something went wrong. Please try again.");
      setStatus("error");
    }
  }, [createCheckoutSession, logDebug, orgSlug, requestId]);

  useEffect(() => {
    if (bookingId || bookingCreationStartedRef.current) {
      return;
    }
    async function initBooking() {
      try {
        if (rawBookingId && !existingBookingId) {
          logDebug("init_booking_invalid_booking_id", { rawBookingId }, "warn");
          setError("Invalid booking link. Please request a new link from support.");
          setStatus("error");
          return;
        }

        if (rawRequestId && !requestId) {
          logDebug("init_booking_invalid_request_id", { rawRequestId }, "warn");
          setError("Invalid request link. Please request a new link from support.");
          setStatus("error");
          return;
        }

        if (existingBookingId && !requestId) {
          logDebug(
            "init_booking_missing_request_for_existing_booking",
            { existingBookingId },
            "warn"
          );
          setError("This booking link is missing request information. Please request a new link.");
          setStatus("error");
          return;
        }

        let resolvedBookingId: Id<"bookings">;

        if (requestId) {
          logDebug("init_booking_request_flow_start", { requestId });
          if (publicBookingContext === undefined) {
            logDebug("init_booking_waiting_for_public_context");
            return;
          }

          if (publicBookingContext.errorCode) {
            setPublicRequestError(publicBookingContext.errorCode);
            return;
          }

          const canonicalHandle = publicBookingContext.canonicalSlug;
          if (!canonicalHandle) {
            setPublicRequestError("ORG_CONTEXT_REQUIRED");
            return;
          }
          if (canonicalHandle !== orgSlug) {
            logDebug("init_booking_redirect_to_canonical_org", { canonicalHandle });
            const nextParams = new URLSearchParams(searchParams.toString());
            window.location.replace(`/book/${canonicalHandle}?${nextParams.toString()}`);
            return;
          }
        } else {
          if (!orgSlug) {
            setError("Missing organization in booking link.");
            setStatus("error");
            return;
          }
          if (organization === undefined) {
            logDebug("init_booking_waiting_for_org");
            return;
          }
          if (organization === null) {
            logDebug("init_booking_org_not_found", { orgSlug }, "warn");
            setError("Organization not found. Please contact support.");
            setStatus("error");
            return;
          }
        }

        if (requestId) {
          bookingCreationStartedRef.current = true;
          logDebug("init_booking_create_from_request", { requestId });
          resolvedBookingId = await createBookingFromRequest({
            requestId,
          });
          logDebug("init_booking_create_from_request_success", { requestId, resolvedBookingId });

          if (existingBookingId && existingBookingId !== resolvedBookingId) {
            logDebug(
              "init_booking_request_mismatch",
              { existingBookingId, resolvedBookingId, requestId },
              "warn"
            );
            setError("Booking link mismatch. Please use the latest booking link.");
            setStatus("error");
            return;
          }
        } else {
          // Create new booking from query params (direct Tally redirect)
          const email = searchParams.get("email");
          const name = searchParams.get("name");
          const serviceType = searchParams.get("service");
          const serviceDate = searchParams.get("date");
          const amount = searchParams.get("amount");
          const notes = searchParams.get("notes");
          const tallyResponseId = searchParams.get("responseId");

          if (!email) {
            logDebug("init_booking_missing_email_for_tally_flow", {}, "warn");
            setError("Missing email parameter. Please complete the booking form first.");
            setStatus("error");
            return;
          }

          if (!organization) {
            logDebug("init_booking_missing_organization_for_tally_flow", { orgSlug }, "warn");
            setError("Organization not found. Please contact support.");
            setStatus("error");
            return;
          }

          let parsedAmount: number | undefined;
          if (amount) {
            const cents = Math.round(parseFloat(amount) * 100);
            if (!Number.isFinite(cents) || cents <= 0) {
              logDebug("init_booking_invalid_amount", { amount, cents }, "warn");
              setError("Invalid amount. Please contact support.");
              setStatus("error");
              return;
            }
            parsedAmount = cents;
          }

          // Create booking in database
          bookingCreationStartedRef.current = true;
          logDebug("init_booking_create_from_tally", { orgId: organization._id, email });
          resolvedBookingId = await createBooking({
            organizationId: organization._id,
            email,
            customerName: name ?? undefined,
            serviceType: serviceType ?? undefined,
            serviceDate: serviceDate ?? undefined,
            amount: parsedAmount,
            notes: notes ?? undefined,
            tallyResponseId: tallyResponseId ?? undefined,
          });
          logDebug("init_booking_create_from_tally_success", { resolvedBookingId });
        }

        logDebug("init_booking_complete", { resolvedBookingId });
        setBookingId(resolvedBookingId);
      } catch (err: any) {
        logDebug(
          "init_booking_error",
          { message: err?.message, stack: err?.stack, requestId, existingBookingId },
          "error"
        );
        setError(err.message ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    }

    initBooking();
  }, [
    bookingId,
    orgSlug,
    organization,
    searchParams,
    publicBookingContext,
    rawBookingId,
    rawRequestId,
    existingBookingId,
    requestId,
    createBooking,
    createBookingFromRequest,
    logDebug,
  ]);

  useEffect(() => {
    if (!bookingId || cardCheckStartedRef.current) {
      return;
    }

    if (bookingSummary === undefined) {
      logDebug("card_check_waiting_for_booking_summary", { bookingId });
      return;
    }

    if (bookingSummary === null) {
      logDebug("card_check_booking_not_found", { bookingId }, "warn");
      setError("Booking not found. Please request a new link.");
      setStatus("error");
      return;
    }

    if (requestId && bookingSummary.bookingRequestId !== requestId) {
      logDebug(
        "card_check_booking_request_mismatch",
        { bookingId, requestId, bookingRequestId: bookingSummary.bookingRequestId },
        "warn"
      );
      setError("Booking request mismatch. Please request a new link.");
      setStatus("error");
      return;
    }

    if (!["pending_card", "card_saved"].includes(bookingSummary.status)) {
      logDebug("card_check_status_ineligible", { bookingId, status: bookingSummary.status }, "warn");
      setError("This booking is no longer awaiting card setup.");
      setStatus("error");
      return;
    }

    if (requestId) {
      if (publicBookingContext === undefined) {
        logDebug("card_check_waiting_for_public_context");
        return;
      }
      if (publicBookingContext.errorCode) {
        setPublicRequestError(publicBookingContext.errorCode);
        return;
      }
      if (!publicBookingContext.stripeConfigured) {
        logDebug("card_check_stripe_not_configured_public", { requestId }, "warn");
        setPublicRequestError("ORG_NOT_CONFIGURED_PUBLIC");
        return;
      }
    } else {
      if (publicStripeConfig === undefined) {
        logDebug("card_check_waiting_for_public_stripe_config");
        return;
      }
      if (!publicStripeConfig) {
        logDebug("card_check_missing_public_stripe_config", { orgSlug }, "warn");
        setError(
          "Payments are not configured for this organization yet. Please contact support."
        );
        setStatus("error");
        return;
      }
    }

    cardCheckStartedRef.current = true;

    async function checkCardOnFile() {
      try {
        logDebug("card_check_start", { bookingId });
        const cardStatus = await getCardOnFileStatus({ bookingId: bookingId! });
        logDebug("card_check_result", {
          bookingId,
          hasCard: cardStatus.hasCard,
          stripeCustomerIdPresent: Boolean(cardStatus.stripeCustomerId),
          cardBrand: cardStatus.cardSummary?.brand ?? null,
          cardLast4: cardStatus.cardSummary?.last4 ?? null,
        });
        if (cardStatus.hasCard) {
          setStripeCustomerId(cardStatus.stripeCustomerId ?? null);
          setCardSummary(cardStatus.cardSummary ?? null);
          setStatus("confirm");
          return;
        }
        await startCheckout(bookingId!);
      } catch (err: any) {
        logDebug(
          "card_check_error",
          { bookingId, message: err?.message, stack: err?.stack },
          "error"
        );
        setError(err.message ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    }

    checkCardOnFile();
  }, [
    bookingId,
    bookingSummary,
    getCardOnFileStatus,
    startCheckout,
    publicStripeConfig,
    publicBookingContext,
    requestId,
    logDebug,
  ]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-xl text-center">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Request received
            </span>
            <span className="h-px w-6 bg-border" />
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-border" />
              Card saved
            </span>
            <span className="h-px w-6 bg-border" />
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-border" />
              Scheduled
            </span>
          </div>
          <div className="rounded-full border border-border bg-card px-4 py-1 text-xs text-muted-foreground">
            Secured by Stripe
          </div>
        </div>

        {status === "loading" && (
          <>
            <div className="mb-6 flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <h1 className="text-2xl font-medium text-foreground">Setting up your booking...</h1>
            <p className="mt-2 text-muted-foreground">Please wait while we prepare your secure payment page.</p>
          </>
        )}

        {status === "confirm" && (
          <>
            <div className="mb-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-medium text-foreground">Card on file</h1>
            <p className="mt-2 text-muted-foreground">
              {cardSummary?.last4
                ? `We already have a card on file ending ${cardSummary.last4}${
                    cardSummary.brand ? ` (${cardSummary.brand})` : ""
                  }.`
                : "We already have a card on file for your account."}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary/90"
                onClick={async () => {
                  if (!bookingId || !stripeCustomerId) {
                    setError("Unable to confirm card on file. Please try again.");
                    setStatus("error");
                    return;
                  }
                  try {
                    setStatus("redirecting");
                    logDebug("card_on_file_confirm_start", { bookingId, stripeCustomerId });
                    await markCardOnFile({ bookingId, stripeCustomerId });
                    const requestParam = requestId ? `&request_id=${encodeURIComponent(requestId)}` : "";
                    logDebug("card_on_file_confirm_success", { bookingId, requestId });
                    window.location.href = `/book/success?booking_id=${bookingId}&card_on_file=1&org=${encodeURIComponent(orgSlug ?? "")}${requestParam}`;
                  } catch (err: any) {
                    logDebug(
                      "card_on_file_confirm_error",
                      { bookingId, message: err?.message, stack: err?.stack },
                      "error"
                    );
                    setError(err.message ?? "Something went wrong. Please try again.");
                    setStatus("error");
                  }
                }}
              >
                Continue with card on file
              </button>
              <button
                className="rounded-full border border-primary px-8 py-3 text-sm font-medium text-foreground hover:bg-muted/80"
                onClick={async () => {
                  if (!bookingId) {
                    setError("Missing booking information. Please try again.");
                    setStatus("error");
                    return;
                  }
                  await startCheckout(bookingId);
                }}
              >
                Use a different card
              </button>
            </div>
          </>
        )}

        {status === "redirecting" && (
          <>
            <div className="mb-6 flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <h1 className="text-2xl font-medium text-foreground">Redirecting to payment...</h1>
            <p className="mt-2 text-muted-foreground">You&apos;ll be redirected to Stripe to securely save your card.</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mb-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-medium text-foreground">Something went wrong</h1>
            <p className="mt-2 text-red-600">{error}</p>
            {debugEnabled && (
              <p className="mt-2 text-xs text-muted-foreground">Debug reference: {traceIdRef.current}</p>
            )}
            <a
              href="/"
              className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary/90"
            >
              Go Home
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
          <div className="w-full max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <h1 className="text-2xl font-medium text-foreground">Loading...</h1>
          </div>
        </div>
      }
    >
      <BookPageContent />
    </Suspense>
  );
}
