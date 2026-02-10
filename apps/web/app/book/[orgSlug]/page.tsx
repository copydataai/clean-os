"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import { Suspense, useEffect, useRef, useState } from "react";
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

  const existingBookingId = searchParams.get("booking_id") as Id<"bookings"> | null;
  const requestId = searchParams.get("request_id") as Id<"bookingRequests"> | null;
  const organization = useQuery(
    api.payments.getOrganizationByPublicHandle,
    orgSlug ? { handle: orgSlug } : "skip"
  );
  const existingBooking = useQuery(
    api.bookings.getBooking,
    existingBookingId ? { id: existingBookingId } : "skip"
  );

  const createBooking = useMutation(api.bookings.createBookingFromTally);
  const createBookingFromRequest = useMutation(api.bookings.createBookingFromRequest);
  const createCheckoutSession = useAction(api.stripeActions.createCheckoutSession);
  const getCardOnFileStatus = useAction(api.stripeActions.getCardOnFileStatus);
  const markCardOnFile = useMutation(api.bookings.markCardOnFile);

  const checkoutStartedRef = useRef(false);
  const cardCheckStartedRef = useRef(false);

  const startCheckout = async (resolvedBookingId: Id<"bookings">) => {
    if (checkoutStartedRef.current) {
      return;
    }
    checkoutStartedRef.current = true;
    try {
      const baseUrl = window.location.origin;
      const { checkoutUrl } = await createCheckoutSession({
        bookingId: resolvedBookingId,
        organizationId: organization?._id ?? undefined,
        successUrl: `${baseUrl}/book/success?booking_id=${resolvedBookingId}&org=${encodeURIComponent(orgSlug ?? "")}`,
        cancelUrl: `${baseUrl}/book/cancel?booking_id=${resolvedBookingId}&org=${encodeURIComponent(orgSlug ?? "")}`,
      });

      setStatus("redirecting");
      window.location.href = checkoutUrl;
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err.message ?? "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  useEffect(() => {
    if (bookingId) {
      return;
    }
    async function initBooking() {
      try {
        let resolvedBookingId: Id<"bookings">;
        if (!orgSlug) {
          setError("Missing organization in booking link.");
          setStatus("error");
          return;
        }
        if (organization === undefined) {
          return;
        }
        if (organization === null) {
          setError("Organization not found. Please contact support.");
          setStatus("error");
          return;
        }

        // Check if booking_id was provided (from Tally webhook)
        if (existingBookingId) {
          // Wait for the booking query to load
          if (existingBooking === undefined) {
            return; // Still loading
          }
          if (existingBooking === null) {
            setError("Booking not found. Please try again.");
            setStatus("error");
            return;
          }
          if (existingBooking.organizationId && existingBooking.organizationId !== organization._id) {
            setError("Booking does not belong to this organization.");
            setStatus("error");
            return;
          }
          resolvedBookingId = existingBookingId;
        } else if (requestId) {
          resolvedBookingId = await createBookingFromRequest({
            requestId,
            organizationId: organization._id,
          });
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
            setError("Missing email parameter. Please complete the booking form first.");
            setStatus("error");
            return;
          }

          // Create booking in database
          resolvedBookingId = await createBooking({
            organizationId: organization._id,
            email,
            customerName: name ?? undefined,
            serviceType: serviceType ?? undefined,
            serviceDate: serviceDate ?? undefined,
            amount: amount ? parseInt(amount) * 100 : undefined,
            notes: notes ?? undefined,
            tallyResponseId: tallyResponseId ?? undefined,
          });
        }

        setBookingId(resolvedBookingId);
      } catch (err: any) {
        console.error("Booking error:", err);
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
    existingBookingId,
    existingBooking,
    requestId,
    createBooking,
    createBookingFromRequest,
  ]);

  useEffect(() => {
    if (!bookingId || cardCheckStartedRef.current) {
      return;
    }
    cardCheckStartedRef.current = true;

    async function checkCardOnFile() {
      try {
        const cardStatus = await getCardOnFileStatus({ bookingId: bookingId! });
        if (cardStatus.hasCard) {
          setStripeCustomerId(cardStatus.stripeCustomerId ?? null);
          setCardSummary(cardStatus.cardSummary ?? null);
          setStatus("confirm");
          return;
        }
        await startCheckout(bookingId!);
      } catch (err: any) {
        console.error("Card check error:", err);
        setError(err.message ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    }

    checkCardOnFile();
  }, [bookingId, getCardOnFileStatus]);

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
            Secure by Stripe
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
                    await markCardOnFile({ bookingId, stripeCustomerId });
                    window.location.href = `/book/success?booking_id=${bookingId}&card_on_file=1&org=${encodeURIComponent(orgSlug ?? "")}`;
                  } catch (err: any) {
                    console.error("Card confirmation error:", err);
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
