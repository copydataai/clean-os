import { Id } from "@/convex/_generated/dataModel";

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export function getBookingRequestLink(requestId: Id<"bookingRequests">): string {
  const baseUrl = getBaseUrl();
  return baseUrl ? `${baseUrl}/book?request_id=${requestId}` : `/book?request_id=${requestId}`;
}
