import type { ReactNode } from "react";
import type { OPERATIONS_STATUSES, FUNNEL_STAGES } from "@/components/bookings/types";

export type RowTypeFilter = "all" | "booking" | "pre_booking";
export type OperationalStatusFilter = "all" | (typeof OPERATIONS_STATUSES)[number];
export type FunnelStageFilter = "all" | (typeof FUNNEL_STAGES)[number];
export type AlertTone = "success" | "error" | "warning";

export type OnboardingAlert = {
  id: string;
  tone: AlertTone;
  content: ReactNode;
  action?: ReactNode;
};

export const operationalStatusColors: Record<string, string> = {
  pending_card: "bg-orange-500",
  card_saved: "bg-green-500",
  scheduled: "bg-yellow-500",
  in_progress: "bg-cyan-500",
  completed: "bg-green-500",
  payment_failed: "bg-red-500",
  charged: "bg-green-500",
  cancelled: "bg-zinc-400",
  failed: "bg-red-500",
};

export function formatCurrency(cents?: number | null) {
  if (cents == null) return "---";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong. Please try again.";
}

export function isAdminRole(role?: string | null) {
  const normalized = (role ?? "").toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "owner" ||
    normalized.endsWith(":admin") ||
    normalized.endsWith(":owner") ||
    normalized.includes("admin")
  );
}
