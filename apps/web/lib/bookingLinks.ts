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
  orgHandle?: string | null
): string {
  if (!orgHandle) {
    return "";
  }
  const baseUrl = getBaseUrl();
  const path = `/book/${orgHandle}?request_id=${requestId}`;
  return baseUrl ? `${baseUrl}${path}` : path;
}

export function getConfirmRequestLink(
  requestId: Id<"bookingRequests">,
  orgHandle?: string | null
): string {
  const confirmUrl = process.env.NEXT_PUBLIC_TALLY_CONFIRM_URL ?? "";
  if (!confirmUrl || !orgHandle) {
    return "";
  }
  const withRequestId = appendQueryParam(confirmUrl, "request_id", requestId);
  return appendQueryParam(withRequestId, "org_slug", orgHandle);
}
