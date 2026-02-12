import type { Id } from "@clean-os/convex/data-model";

export function onboardingListPath(options?: {
  bookingId?: Id<"bookings"> | string | null;
}) {
  const bookingId = options?.bookingId;
  if (!bookingId) {
    return "/dashboard/onboarding";
  }

  const params = new URLSearchParams({ bookingId: String(bookingId) });
  return `/dashboard/onboarding?${params.toString()}`;
}

export function onboardingRequestPath(requestId: Id<"bookingRequests"> | string) {
  return `/dashboard/onboarding/requests/${requestId}`;
}
