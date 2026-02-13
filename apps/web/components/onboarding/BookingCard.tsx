import { useQuery } from "convex/react";
import type { Id } from "@clean-os/convex/data-model";
import StatusBadge from "@/components/dashboard/StatusBadge";
import AssignCleanerSheet from "@/components/cleaners/AssignCleanerSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { hasLifecycleSchedule, type LifecycleRow } from "@/components/bookings/types";
import { cn } from "@/lib/utils";
import { onboardingApi } from "@/lib/onboarding/api";
import { operationalStatusColors, formatCurrency } from "@/components/onboarding/types";

function BookingChecklistReadiness({
  bookingId,
  operationalStatus,
}: {
  bookingId: Id<"bookings">;
  operationalStatus: string | null;
}) {
  const assignments = useQuery(onboardingApi.getBookingAssignments, { bookingId });
  if (!assignments) {
    return <p className="text-xs text-muted-foreground">Loading assignment readiness...</p>;
  }

  const activeAssignments = assignments.filter(
    (assignment) => !["declined", "cancelled", "no_show"].includes(assignment.status)
  );
  const checklistTotal = activeAssignments.reduce(
    (sum, assignment) => sum + (assignment.checklist?.total ?? 0),
    0
  );
  const checklistCompleted = activeAssignments.reduce(
    (sum, assignment) => sum + (assignment.checklist?.completed ?? 0),
    0
  );
  const checklistComplete = checklistTotal === 0 || checklistCompleted === checklistTotal;
  const allActiveAssignmentsCompleted =
    activeAssignments.length > 0 &&
    activeAssignments.every((assignment) => assignment.status === "completed");

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Badge variant="outline" className="text-[10px]">
        Checklist {checklistCompleted}/{checklistTotal}
      </Badge>
      <Badge variant="outline" className="text-[10px]">
        Active {activeAssignments.length}
      </Badge>
      {operationalStatus === "in_progress" && !checklistComplete ? (
        <Badge className="bg-rose-100 text-rose-700 text-[10px] dark:bg-rose-900/40 dark:text-rose-400">
          Clock-out blocked
        </Badge>
      ) : operationalStatus === "in_progress" && allActiveAssignmentsCompleted ? (
        <Badge className="bg-emerald-100 text-emerald-700 text-[10px] dark:bg-emerald-900/40 dark:text-emerald-400">
          Ready to auto-complete
        </Badge>
      ) : null}
    </div>
  );
}

export default function BookingCard({
  row,
  isBusy,
  isAdmin,
  onMarkCompleted,
  onCharge,
  onCancel,
  onReschedule,
  onOverride,
  onDetails,
}: {
  row: LifecycleRow;
  isBusy: boolean;
  isAdmin: boolean;
  onMarkCompleted: () => Promise<void>;
  onCharge: () => Promise<void>;
  onCancel: () => void;
  onReschedule: () => void;
  onOverride: () => void;
  onDetails: () => void;
}) {
  const indicatorColor = operationalStatusColors[row.operationalStatus ?? ""] ?? "bg-gray-400";
  const canCancel =
    row.operationalStatus === "pending_card" ||
    row.operationalStatus === "card_saved" ||
    row.operationalStatus === "scheduled";
  const isActionCriticalState =
    row.operationalStatus === "in_progress" ||
    row.operationalStatus === "payment_failed" ||
    row.operationalStatus === "cancelled";
  const scheduleActionLabel = hasLifecycleSchedule(row) ? "Reschedule" : "Schedule";

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border bg-card p-4",
        isActionCriticalState
          ? "border-[color:var(--onboarding-danger-bg)]"
          : "border-border/50"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", indicatorColor)} />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {row.customerName ?? row.email ?? row.bookingId}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{row.email ?? "No email provided"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.operationalStatus ? <StatusBadge status={row.operationalStatus} /> : null}
          {row.funnelStage ? <StatusBadge status={row.funnelStage} context="funnel" /> : null}
          <span className="rounded-md bg-muted/55 px-2 py-1 font-mono text-sm font-semibold text-foreground">
            {formatCurrency(row.amount)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Date</span>
            <span className="font-mono text-foreground">{row.serviceDate ?? "TBD"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Type</span>
            <span className="text-foreground">{row.serviceType ?? "Standard"}</span>
          </div>
        </div>
        {row.bookingId ? (
          <BookingChecklistReadiness
            bookingId={row.bookingId}
            operationalStatus={row.operationalStatus}
          />
        ) : null}
      </div>

      <Separator />

      <div className="flex flex-wrap gap-1.5">
        <Button size="xs" onClick={onDetails}>
          Details
        </Button>
        {row.bookingId ? (
          <AssignCleanerSheet
            bookingId={row.bookingId}
            trigger={
              <Button size="xs" variant="outline">
                Assign
              </Button>
            }
          />
        ) : null}
        <Button
          size="xs"
          variant="outline"
          disabled={isBusy || row.operationalStatus === "cancelled"}
          onClick={onReschedule}
        >
          {scheduleActionLabel}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            disabled={isBusy || row.operationalStatus !== "in_progress"}
            onClick={onMarkCompleted}
          >
            Mark completed
          </Button>
          <Button
            size="xs"
            variant="outline"
            disabled={
              isBusy ||
              !row.amount ||
              (row.operationalStatus !== "completed" &&
                row.operationalStatus !== "payment_failed")
            }
            onClick={onCharge}
          >
            Charge
          </Button>
        </div>
        <Button
          size="xs"
          variant="ghost"
          disabled={isBusy || !canCancel}
          onClick={onCancel}
        >
          Cancel
        </Button>
        {isAdmin ? (
          <Button size="xs" variant="ghost" onClick={onOverride}>
            Override
          </Button>
        ) : null}
      </div>
    </div>
  );
}
