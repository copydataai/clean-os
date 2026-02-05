"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";

function CompletePaymentPageContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "processing" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const paymentIntent = searchParams.get("payment_intent");
  const clientSecret = searchParams.get("payment_intent_client_secret");

  useEffect(() => {
    if (!paymentIntent || !clientSecret) {
      setError("Invalid payment link. Please contact support.");
      setStatus("error");
      return;
    }

    // In production, you would use Stripe.js to confirm the payment
    // For now, we show instructions to the customer
    setStatus("processing");
  }, [paymentIntent, clientSecret]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-muted-foreground">Loading payment details...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-medium text-foreground">Payment Error</h1>
          <p className="mt-2 text-red-600">{error}</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (status === "success") {
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
          <h1 className="text-2xl font-medium text-foreground">Payment Complete!</h1>
          <p className="mt-2 text-muted-foreground">Thank you for your payment. Your transaction has been processed.</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Processing state - show payment form
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-medium text-foreground">Complete Your Payment</h1>
          <p className="mt-2 text-muted-foreground">
            Your bank requires additional verification for this payment.
          </p>
        </div>

        <div className="surface-card p-6">
          <div id="payment-element" className="mb-6">
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Payment verification form would appear here.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                In production, Stripe Elements handles 3DS authentication automatically.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setStatus("success")}
              className="w-full rounded-full bg-primary py-3 text-sm font-medium text-white hover:bg-primary/90"
            >
              Continue verification
            </button>
            <Link
              href="/"
              className="block w-full rounded-full border border-border py-3 text-center text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Secure payment powered by Stripe
        </p>
      </div>
    </div>
  );
}

export default function CompletePaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <CompletePaymentPageContent />
    </Suspense>
  );
}
