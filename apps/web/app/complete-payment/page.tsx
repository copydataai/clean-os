"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { api } from "@clean-os/convex/api";

type RecoveryState = "loading" | "ready" | "processing" | "success" | "error";

function CompletePaymentPageContent() {
  const searchParams = useSearchParams();
  const paymentIntent = searchParams.get("payment_intent");
  const clientSecret = searchParams.get("payment_intent_client_secret");
  const orgHandle = searchParams.get("org");

  const [status, setStatus] = useState<RecoveryState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [intentStatus, setIntentStatus] = useState<string | null>(null);
  const stripePromiseRef = useRef<Promise<Stripe | null> | null>(null);

  const recoveryConfig = useQuery(
    api.payments.getPublicStripeRecoveryConfig,
    orgHandle ? { handle: orgHandle } : "skip"
  );

  const hasRequiredParams = useMemo(
    () => Boolean(paymentIntent && clientSecret && orgHandle),
    [paymentIntent, clientSecret, orgHandle]
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      if (!hasRequiredParams) {
        setStatus("error");
        setError("Invalid payment link. Missing payment intent or organization information.");
        return;
      }

      if (recoveryConfig === undefined) {
        return;
      }

      if (!recoveryConfig?.publishableKey) {
        setStatus("error");
        setError(
          "This organization is not configured for card authentication recovery yet. Please contact support to complete payment manually."
        );
        return;
      }

      stripePromiseRef.current = loadStripe(recoveryConfig.publishableKey);
      const stripe = await stripePromiseRef.current;
      if (!stripe || cancelled) {
        if (!cancelled) {
          setStatus("error");
          setError("Unable to initialize Stripe recovery flow.");
        }
        return;
      }

      const result = await stripe.retrievePaymentIntent(clientSecret!);
      if (cancelled) {
        return;
      }

      const currentStatus = result.paymentIntent?.status ?? "unknown";
      setIntentStatus(currentStatus);

      if (currentStatus === "succeeded" || currentStatus === "processing") {
        setStatus("success");
        return;
      }

      if (currentStatus === "requires_action" || currentStatus === "requires_confirmation") {
        setStatus("ready");
        return;
      }

      setStatus("error");
      setError(`Payment cannot be recovered from status: ${currentStatus}. Please contact support.`);
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [clientSecret, hasRequiredParams, recoveryConfig]);

  async function pollIntentStatus(stripe: Stripe) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await stripe.retrievePaymentIntent(clientSecret!);
      const currentStatus = result.paymentIntent?.status ?? "unknown";
      setIntentStatus(currentStatus);

      if (currentStatus === "succeeded" || currentStatus === "processing") {
        setStatus("success");
        return;
      }

      if (currentStatus === "requires_payment_method" || currentStatus === "canceled") {
        setStatus("error");
        setError("Authentication failed. Please contact support so we can send a new payment recovery link.");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    setStatus("error");
    setError("Authentication timed out. Please retry or contact support.");
  }

  async function handleAuthenticate() {
    setStatus("processing");
    setError(null);

    const stripe = await stripePromiseRef.current;
    if (!stripe) {
      setStatus("error");
      setError("Unable to initialize Stripe.");
      return;
    }

    const result = await stripe.confirmCardPayment(clientSecret!);
    if (result.error) {
      setStatus("error");
      setError(result.error.message ?? "Card authentication failed.");
      return;
    }

    await pollIntentStatus(stripe);
  }

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
          <h1 className="text-2xl font-medium text-foreground">Payment Recovery Failed</h1>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">Current status: {intentStatus ?? "unknown"}</p>
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
          <h1 className="text-2xl font-medium text-foreground">Authentication Complete</h1>
          <p className="mt-2 text-muted-foreground">
            Your bank authentication was successful. We&apos;ll continue processing this payment.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Current status: {intentStatus ?? "processing"}</p>
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-7 w-7 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 11c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11h10" />
            </svg>
          </div>
        </div>
        <h1 className="text-xl font-medium text-foreground">Additional Verification Required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your bank requires one more authentication step to complete this payment.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Current status: {intentStatus ?? "requires_action"}</p>

        <button
          onClick={handleAuthenticate}
          className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-medium text-white hover:bg-primary/90"
        >
          Authenticate Payment
        </button>

        <Link
          href="/"
          className="mt-3 inline-block text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Cancel and contact support
        </Link>
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
