"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function BookSuccessPageContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");
  const cardOnFile = searchParams.get("card_on_file") === "1";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-medium text-foreground">
          {cardOnFile ? "Card Already On File" : "Card Saved Successfully!"}
        </h1>
        
        <p className="mt-4 text-lg text-muted-foreground">
          {cardOnFile
            ? "Thank you for booking with us. We'll use the card you already have on file."
            : "Thank you for booking with us. Your payment method has been securely saved."}
        </p>

        <div className="mt-6 surface-card p-5 text-left">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Booking summary</p>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <p>Booking ID: {bookingId ?? "—"}</p>
            <p>Next step: We will confirm your cleaning schedule.</p>
            <p>
              Payment: {cardOnFile ? "Card on file, charged after service." : "Card saved, charged after service."}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-card p-6 shadow-sm">
          <h2 className="font-medium text-foreground">What happens next?</h2>
          <ul className="mt-4 space-y-3 text-left text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-white">1</span>
              <span>Our team will confirm your cleaning appointment</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-white">2</span>
              <span>We&apos;ll send you a reminder before your scheduled cleaning</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-white">3</span>
              <span>After the job is completed, we&apos;ll charge your saved card automatically</span>
            </li>
          </ul>
        </div>

        {bookingId && (
          <p className="mt-4 text-xs text-muted-foreground">
            Booking reference: {bookingId}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/"
            className="inline-block rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary/90"
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

export default function BookSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <BookSuccessPageContent />
    </Suspense>
  );
}
