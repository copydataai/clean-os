"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";

function BookPageContent() {
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
        successUrl: `${baseUrl}/book/success?booking_id=${resolvedBookingId}`,
        cancelUrl: `${baseUrl}/book/cancel?booking_id=${resolvedBookingId}`,
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
          resolvedBookingId = existingBookingId;
        } else if (requestId) {
          resolvedBookingId = await createBookingFromRequest({ requestId });
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
        const cardStatus = await getCardOnFileStatus({ bookingId });
        if (cardStatus.hasCard) {
          setStripeCustomerId(cardStatus.stripeCustomerId ?? null);
          setCardSummary(cardStatus.cardSummary ?? null);
          setStatus("confirm");
          return;
        }
        await startCheckout(bookingId);
      } catch (err: any) {
        console.error("Card check error:", err);
        setError(err.message ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    }

    checkCardOnFile();
  }, [bookingId, getCardOnFileStatus]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] p-8">
      <div className="w-full max-w-xl text-center">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#999999]">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#1A1A1A]" />
              Request received
            </span>
            <span className="h-px w-6 bg-[#DDDDDD]" />
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#DDDDDD]" />
              Card saved
            </span>
            <span className="h-px w-6 bg-[#DDDDDD]" />
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#DDDDDD]" />
              Scheduled
            </span>
          </div>
          <div className="rounded-full border border-[#E5E5E5] bg-white px-4 py-1 text-xs text-[#666666]">
            Secure by Stripe
          </div>
        </div>

        {status === "loading" && (
          <>
            <div className="mb-6 flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1A1A1A] border-t-transparent" />
            </div>
            <h1 className="text-2xl font-medium text-[#1A1A1A]">Setting up your booking...</h1>
            <p className="mt-2 text-[#666666]">Please wait while we prepare your secure payment page.</p>
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
            <h1 className="text-2xl font-medium text-[#1A1A1A]">Card on file</h1>
            <p className="mt-2 text-[#666666]">
              {cardSummary?.last4
                ? `We already have a card on file ending ${cardSummary.last4}${
                    cardSummary.brand ? ` (${cardSummary.brand})` : ""
                  }.`
                : "We already have a card on file for your account."}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                className="rounded-full bg-[#1A1A1A] px-8 py-3 text-sm font-medium text-white hover:bg-[#333333]"
                onClick={async () => {
                  if (!bookingId || !stripeCustomerId) {
                    setError("Unable to confirm card on file. Please try again.");
                    setStatus("error");
                    return;
                  }
                  try {
                    setStatus("redirecting");
                    await markCardOnFile({ bookingId, stripeCustomerId });
                    window.location.href = `/book/success?booking_id=${bookingId}&card_on_file=1`;
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
                className="rounded-full border border-[#1A1A1A] px-8 py-3 text-sm font-medium text-[#1A1A1A] hover:bg-[#F2F2F2]"
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
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1A1A1A] border-t-transparent" />
            </div>
            <h1 className="text-2xl font-medium text-[#1A1A1A]">Redirecting to payment...</h1>
            <p className="mt-2 text-[#666666]">You&apos;ll be redirected to Stripe to securely save your card.</p>
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
            <h1 className="text-2xl font-medium text-[#1A1A1A]">Something went wrong</h1>
            <p className="mt-2 text-red-600">{error}</p>
            <a
              href="/"
              className="mt-6 inline-block rounded-full bg-[#1A1A1A] px-8 py-3 text-sm font-medium text-white hover:bg-[#333333]"
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
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] p-8">
          <div className="w-full max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1A1A1A] border-t-transparent" />
            </div>
            <h1 className="text-2xl font-medium text-[#1A1A1A]">Loading...</h1>
          </div>
        </div>
      }
    >
      <BookPageContent />
    </Suspense>
  );
}
