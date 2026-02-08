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

export function getBookingRequestLink(requestId: Id<"bookingRequests">): string {
  const baseUrl = getBaseUrl();
  return baseUrl ? `${baseUrl}/book?request_id=${requestId}` : `/book?request_id=${requestId}`;
}

export function getConfirmRequestLink(requestId: Id<"bookingRequests">): string {
  const confirmUrl = process.env.NEXT_PUBLIC_TALLY_CONFIRM_URL ?? "";
  return appendQueryParam(confirmUrl, "request_id", requestId);
}
