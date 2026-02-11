import type { Id } from "@clean-os/convex/data-model";

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

function appendQueryParam(url: string, key: string, value: string): string {
  if (!url) {
    return "";
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function getBookingRequestLink(
  requestId: Id<"bookingRequests">,
  canonicalHandle: string
): string {
  if (!canonicalHandle?.trim()) {
    return "";
  }
  const baseUrl = getBaseUrl();
  const path = `/book/${canonicalHandle}?request_id=${requestId}`;
  return baseUrl ? `${baseUrl}${path}` : path;
}

export function getConfirmRequestLink(
  confirmationFormUrl: string | null | undefined,
  requestId: Id<"bookingRequests">,
  canonicalHandle: string
): string {
  if (!confirmationFormUrl || !canonicalHandle?.trim()) {
    return "";
  }
  const withRequestId = appendQueryParam(confirmationFormUrl, "request_id", requestId);
  return appendQueryParam(withRequestId, "org_slug", canonicalHandle);
}
