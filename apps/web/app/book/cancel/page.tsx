"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";

function BookCancelPageContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");
  const setupIntentId = searchParams.get("setup_intent");
  const setupIntentClientSecret = searchParams.get("setup_intent_client_secret");
  const orgHandle = searchParams.get("org");
  const possibleFailure = Boolean(setupIntentId || setupIntentClientSecret);
  const tallyLinks = useQuery(
    api.integrations.getTallyFormLinksByOrgHandlePublic,
    orgHandle ? { handle: orgHandle } : "skip"
  );
  const tallyUrl = tallyLinks?.requestFormUrl ?? null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-medium text-foreground">
          {possibleFailure ? "Card Setup Failed" : "Booking Incomplete"}
        </h1>
        
        <p className="mt-4 text-lg text-muted-foreground">
          {possibleFailure
            ? "We couldn&apos;t save your card. Please try again or use a different card."
            : "You cancelled the payment process. Your booking hasn&apos;t been confirmed yet."}
        </p>

        <div className="mt-6 rounded-lg bg-card p-6 shadow-sm">
          <h2 className="font-medium text-foreground">Want to try again?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {possibleFailure
              ? "Restart the booking flow to open a fresh secure card setup session."
              : "You can restart the booking process by filling out the form again."}{" "}
            We won&apos;t charge your card until after the cleaning is completed.
          </p>
        </div>

        {bookingId && (
          <p className="mt-4 text-xs text-muted-foreground">
            Booking reference: {bookingId}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {tallyUrl ? (
            <a
              href={tallyUrl}
              className="inline-block rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary/90"
            >
              Resume booking
            </a>
          ) : (
            <div className="rounded-full border border-amber-300 bg-amber-50 px-8 py-3 text-sm font-medium text-amber-800">
              Resume booking is unavailable until Tally request form setup is complete.
            </div>
          )}
          <Link
            href="/"
            className="inline-block rounded-full border border-border px-8 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Return Home
          </Link>
          <a
            href="mailto:support@cleanos.com"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Need help? Contact support
          </a>
        </div>
      </div>
    </div>
  );
}

export default function BookCancelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <BookCancelPageContent />
    </Suspense>
  );
}
