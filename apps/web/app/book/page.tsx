"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";

function BookCompatibilityContent() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request_id") as Id<"bookingRequests"> | null;
  const route = useQuery(
    api.bookingRequests.resolvePublicBookingRoute,
    requestId ? { requestId } : "skip"
  );

  useEffect(() => {
    if (!requestId || !route?.handle) {
      return;
    }
    window.location.replace(`/book/${route.handle}?request_id=${requestId}`);
  }, [requestId, route?.handle]);

  if (!requestId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Organization Link Required</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This booking flow requires an organization-specific link in the format
            <code> /book/&lt;org-handle&gt;</code>.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  if (route === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!route?.handle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Booking Link Invalid</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We could not resolve the organization for this booking request. Please contact support for a new link.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Redirecting to your organization booking page...</p>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <BookCompatibilityContent />
    </Suspense>
  );
}
