import type { Id } from "@clean-os/convex/data-model";

export type LifecycleRow = {
  rowType: "booking" | "pre_booking";
  bookingId: Id<"bookings"> | null;
  bookingRequestId: Id<"bookingRequests"> | null;
  quoteRequestId: Id<"quoteRequests"> | null;
  customerName: string | null;
  email: string | null;
  operationalStatus: string | null;
  funnelStage:
    | "requested"
    | "quoted"
    | "confirmed"
    | "card_saved"
    | "scheduled"
    | "in_progress"
    | "service_completed"
    | "payment_failed"
    | "charged"
    | "cancelled"
    | null;
  serviceDate: string | null;
  serviceType: string | null;
  amount: number | null;
  cardRequestEmailDelivery: {
    sendId: Id<"emailSends">;
    status:
      | "queued"
      | "sent"
      | "delivered"
      | "delivery_delayed"
      | "failed"
      | "skipped";
    provider: string;
    updatedAt: number;
    errorCode?: string;
    errorMessage?: string;
  } | null;
  confirmationEmailDelivery: {
    sendId: Id<"emailSends">;
    status:
      | "queued"
      | "sent"
      | "delivered"
      | "delivery_delayed"
      | "failed"
      | "skipped";
    provider: string;
    updatedAt: number;
    errorCode?: string;
    errorMessage?: string;
  } | null;
  createdAt: number;
  updatedAt: number;
};

export function hasLifecycleSchedule(
  row: Pick<LifecycleRow, "serviceDate" | "operationalStatus" | "funnelStage"> | null | undefined
) {
  if (!row) {
    return false;
  }

  return Boolean(
    row.serviceDate ||
      row.operationalStatus === "scheduled" ||
      row.funnelStage === "scheduled"
  );
}

export type LifecycleTimelineEvent = {
  _id: Id<"bookingLifecycleEvents">;
  bookingId: Id<"bookings">;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  source: string;
  actorUserId: Id<"users"> | null;
  actorName: string | null;
  fromServiceDate: string | null;
  toServiceDate: string | null;
  metadata: unknown;
  createdAt: number;
};

export const OPERATIONS_STATUSES = [
  "pending_card",
  "card_saved",
  "scheduled",
  "in_progress",
  "completed",
  "payment_failed",
  "charged",
  "cancelled",
  "failed",
] as const;

export const FUNNEL_STAGES = [
  "requested",
  "quoted",
  "confirmed",
  "card_saved",
  "scheduled",
  "in_progress",
  "service_completed",
  "payment_failed",
  "charged",
  "cancelled",
] as const;
