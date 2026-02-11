"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import PageHeader from "@/components/dashboard/PageHeader";
import StatusBadge from "@/components/dashboard/StatusBadge";
import EmptyState from "@/components/dashboard/EmptyState";
import AssignCleanerSheet from "@/components/cleaners/AssignCleanerSheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BookingLifecycleSheet from "@/components/bookings/BookingLifecycleSheet";
import CancelBookingDialog from "@/components/bookings/CancelBookingDialog";
import RescheduleBookingDialog from "@/components/bookings/RescheduleBookingDialog";
import OverrideStatusDialog from "@/components/bookings/OverrideStatusDialog";
import { FUNNEL_STAGES, OPERATIONS_STATUSES, type LifecycleRow } from "@/components/bookings/types";
import { cn } from "@/lib/utils";
import { useActiveOrganization } from "@/components/org/useActiveOrganization";

/* ─── Constants & Helpers ──────────────────────────────────── */

const FUNNEL_UI_ENABLED = process.env.NEXT_PUBLIC_BOOKING_FUNNEL_UI === "true";
type RowTypeFilter = "all" | "booking" | "pre_booking";
type OperationalStatusFilter = "all" | (typeof OPERATIONS_STATUSES)[number];
type FunnelStageFilter = "all" | (typeof FUNNEL_STAGES)[number];

function formatCurrency(cents?: number | null) {
  if (!cents) return "---";
  return `$${(cents / 100).toLocaleString()}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong. Please try again.";
}

function isAdminRole(role?: string | null) {
  const normalized = (role ?? "").toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "owner" ||
    normalized.endsWith(":admin") ||
    normalized.endsWith(":owner") ||
    normalized.includes("admin")
  );
}

const operationalStatusColors: Record<string, string> = {
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

/* ─── Legacy Booking Card ──────────────────────────────────── */

type LegacyBookingCardProps = {
  booking: {
    _id: Id<"bookings">;
    customerName?: string | null;
    email: string;
    status: string;
    amount?: number | null;
    serviceDate?: string | null;
    serviceType?: string | null;
  };
  isBusy: boolean;
  onMarkCompleted: () => Promise<void>;
  onCharge: () => Promise<void>;
};

function LegacyBookingCard({ booking, isBusy, onMarkCompleted, onCharge }: LegacyBookingCardProps) {
  const assignments = useQuery(api.cleaners.getBookingAssignments, {
    bookingId: booking._id,
  });

  const indicatorColor = operationalStatusColors[booking.status] ?? "bg-gray-400";

  return (
    <div className="space-y-4 rounded-xl border border-border/50 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", indicatorColor)} />
          <div>
            <p className="text-sm font-medium text-foreground">{booking.customerName ?? booking.email}</p>
            <p className="text-xs text-muted-foreground">{booking.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={booking.status} />
          <span className="font-mono text-sm font-semibold text-foreground">{formatCurrency(booking.amount)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Date</span>
          <span className="font-mono text-foreground">{booking.serviceDate ?? "TBD"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Type</span>
          <span className="text-foreground">{booking.serviceType ?? "Standard"}</span>
        </div>
      </div>

      {assignments && assignments.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Assigned Cleaners</p>
          <div className="flex flex-wrap gap-1.5">
            {assignments.map((assignment) => (
              <div
                key={assignment._id}
                className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1"
              >
                {assignment.cleaner ? (
                  <>
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-[9px] font-medium text-white">
                      {assignment.cleaner.firstName.charAt(0)}
                      {assignment.cleaner.lastName.charAt(0)}
                    </div>
                    <span className="text-xs text-foreground">
                      {assignment.cleaner.firstName} {assignment.cleaner.lastName}
                    </span>
                  </>
                ) : assignment.crew ? (
                  <span className="text-xs text-foreground">{assignment.crew.name}</span>
                ) : null}
                <Badge variant="outline" className="text-[9px]">{assignment.role}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Separator />

      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="xs"
          disabled={isBusy || booking.status !== "in_progress"}
          onClick={onMarkCompleted}
        >
          Mark completed
        </Button>
        <Button
          size="xs"
          disabled={
            isBusy ||
            !booking.amount ||
            (booking.status !== "completed" && booking.status !== "payment_failed")
          }
          onClick={onCharge}
        >
          Charge now
        </Button>
        <AssignCleanerSheet bookingId={booking._id} />
      </div>
    </div>
  );
}

/* ─── Legacy Bookings View ─────────────────────────────────── */

function LegacyBookingsView() {
  const bookings = useQuery(api.bookings.listBookings, { limit: 50 });
  const markCompleted = useMutation(api.bookings.markJobCompleted);
  const chargeJob = useAction(api.bookings.chargeCompletedJob);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!bookings) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading bookings...</p>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        title="No bookings yet"
        description="Bookings linked to requests will appear here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {bookings.map((booking) => {
        const isBusy = busyId === booking._id;
        return (
          <LegacyBookingCard
            key={booking._id}
            booking={booking}
            isBusy={isBusy}
            onMarkCompleted={async () => {
              setBusyId(booking._id);
              try {
                await markCompleted({ bookingId: booking._id });
              } finally {
                setBusyId(null);
              }
            }}
            onCharge={async () => {
              if (!booking.amount) return;
              setBusyId(booking._id);
              try {
                await chargeJob({
                  bookingId: booking._id,
                  amount: booking.amount,
                  description: booking.serviceType ?? "Cleaning service",
                });
              } finally {
                setBusyId(null);
              }
            }}
          />
        );
      })}
    </div>
  );
}

/* ─── Checklist Readiness ──────────────────────────────────── */

function BookingChecklistReadiness({
  bookingId,
  operationalStatus,
}: {
  bookingId: Id<"bookings">;
  operationalStatus: string | null;
}) {
  const assignments = useQuery(api.cleaners.getBookingAssignments, { bookingId });
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
  const checklistComplete =
    checklistTotal === 0 || checklistCompleted === checklistTotal;
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
        <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 text-[10px]">Clock-out blocked</Badge>
      ) : null}
      {operationalStatus === "in_progress" && allActiveAssignmentsCompleted ? (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px]">Ready to auto-complete</Badge>
      ) : null}
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────── */

export default function BookingsPage() {
  const { activeOrg } = useActiveOrganization();
  const isAdmin = Boolean(activeOrg && isAdminRole(activeOrg.role));

  const [rowType, setRowType] = useState<RowTypeFilter>("all");
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatusFilter>("all");
  const [funnelStage, setFunnelStage] = useState<FunnelStageFilter>("all");
  const [search, setSearch] = useState("");
  const [serviceDate, setServiceDate] = useState("");

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const markCompleted = useMutation(api.bookings.markJobCompleted);
  const chargeJob = useAction(api.bookings.chargeCompletedJob);
  const cancelBooking = useMutation(api.bookings.cancelBooking);
  const rescheduleBooking = useMutation(api.bookings.rescheduleBooking);
  const overrideBookingStatus = useMutation(api.bookings.adminOverrideBookingStatus);

  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [detailRow, setDetailRow] = useState<LifecycleRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [cancelRow, setCancelRow] = useState<LifecycleRow | null>(null);
  const [rescheduleRow, setRescheduleRow] = useState<LifecycleRow | null>(null);
  const [overrideRow, setOverrideRow] = useState<LifecycleRow | null>(null);
  const [actionBusy, setActionBusy] = useState<"cancel" | "reschedule" | "override" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const lifecyclePage = useQuery(
    api.bookingLifecycle.listUnifiedLifecycleRows,
    FUNNEL_UI_ENABLED
      ? {
          cursor,
          limit: 30,
          rowType: rowType === "all" ? undefined : rowType,
          operationalStatus: operationalStatus === "all" ? undefined : operationalStatus,
          funnelStage: funnelStage === "all" ? undefined : funnelStage,
          search: search.trim() ? search.trim() : undefined,
          serviceDate: serviceDate || undefined,
        }
      : "skip"
  );

  const rows = (lifecyclePage?.rows as LifecycleRow[] | undefined) ?? [];
  const nextCursor = lifecyclePage?.nextCursor ?? null;

  useEffect(() => {
    setCursor(undefined);
    setCursorHistory([]);
  }, [funnelStage, operationalStatus, rowType, search, serviceDate]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const canGoBack = cursorHistory.length > 0;

  const subtitle = useMemo(() => {
    if (!FUNNEL_UI_ENABLED) {
      return "Track booking progress and take quick actions.";
    }
    return "Unified operations view for pre-booking funnel and live booking lifecycle.";
  }, []);

  /* ─── Legacy view ─── */

  if (!FUNNEL_UI_ENABLED) {
    return (
      <div className="space-y-8">
        <PageHeader title="Bookings" subtitle={subtitle} />
        <div className="surface-card overflow-hidden rounded-2xl p-4">
          <LegacyBookingsView />
        </div>
      </div>
    );
  }

  /* ─── Funnel view ─── */

  return (
    <div className="space-y-8">
      <PageHeader title="Bookings" subtitle={subtitle} />

      {feedback ? (
        <div
          className={cn(
            "overflow-hidden rounded-2xl border p-4 text-sm",
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50/50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-red-200 bg-red-50/50 text-red-800 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300"
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {/* Filters */}
      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <Select value={rowType} onValueChange={(value) => value && setRowType(value as RowTypeFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Row type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All row types</SelectItem>
                <SelectItem value="booking">Bookings</SelectItem>
                <SelectItem value="pre_booking">Pre-booking</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={operationalStatus}
              onValueChange={(value) => value && setOperationalStatus(value as OperationalStatusFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Operational status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All operational statuses</SelectItem>
                {OPERATIONS_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === "failed" ? "failed (legacy)" : status.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={funnelStage}
              onValueChange={(value) => value && setFunnelStage(value as FunnelStageFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Funnel stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All funnel stages</SelectItem>
                {FUNNEL_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={serviceDate}
              onChange={(event) => setServiceDate(event.target.value)}
            />

            <Input
              placeholder="Search name, email, IDs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{rows.length}</span> rows on this page
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              disabled={!canGoBack}
              onClick={() => {
                setCursorHistory((previous) => {
                  if (previous.length === 0) return previous;
                  const copy = [...previous];
                  const previousCursor = copy.pop();
                  setCursor(previousCursor || undefined);
                  return copy;
                });
              }}
            >
              Previous
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={!nextCursor}
              onClick={() => {
                if (!nextCursor) return;
                setCursorHistory((previous) => [...previous, cursor ?? ""]);
                setCursor(nextCursor);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Rows */}
      {!lifecyclePage ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading lifecycle rows...</p>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No lifecycle rows"
          description="Try relaxing filters or clearing search terms."
        />
      ) : (
        <div className="surface-card overflow-hidden rounded-2xl p-4">
          <div className="space-y-2">
            {rows.map((row) => {
              if (row.rowType === "pre_booking") {
                return (
                  <PreBookingCard
                    key={`pre:${row.bookingRequestId ?? row.quoteRequestId}`}
                    row={row}
                  />
                );
              }

              if (!row.bookingId) return null;

              return (
                <BookingCard
                  key={row.bookingId}
                  row={row}
                  isBusy={busyRowId === row.bookingId}
                  isAdmin={isAdmin}
                  onMarkCompleted={async () => {
                    setBusyRowId(row.bookingId);
                    try {
                      await markCompleted({ bookingId: row.bookingId! });
                      setFeedback({ type: "success", message: "Booking marked completed." });
                    } catch (error) {
                      setFeedback({ type: "error", message: getErrorMessage(error) });
                    } finally {
                      setBusyRowId(null);
                    }
                  }}
                  onCharge={async () => {
                    if (!row.amount) return;
                    setBusyRowId(row.bookingId);
                    try {
                      await chargeJob({
                        bookingId: row.bookingId!,
                        amount: row.amount,
                        description: row.serviceType ?? "Cleaning service",
                      });
                      setFeedback({ type: "success", message: "Charge action submitted." });
                    } catch (error) {
                      setFeedback({ type: "error", message: getErrorMessage(error) });
                    } finally {
                      setBusyRowId(null);
                    }
                  }}
                  onCancel={() => {
                    setActionError(null);
                    setCancelRow(row);
                  }}
                  onReschedule={() => {
                    setActionError(null);
                    setRescheduleRow(row);
                  }}
                  onOverride={() => {
                    setActionError(null);
                    setOverrideRow(row);
                  }}
                  onDetails={() => {
                    setDetailRow(row);
                    setDetailOpen(true);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      <BookingLifecycleSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        row={detailRow}
        isAdmin={isAdmin}
        onRequestCancel={() => {
          if (!detailRow) return;
          setActionError(null);
          setCancelRow(detailRow);
        }}
        onRequestReschedule={() => {
          if (!detailRow) return;
          setActionError(null);
          setRescheduleRow(detailRow);
        }}
        onRequestOverride={() => {
          if (!detailRow) return;
          setActionError(null);
          setOverrideRow(detailRow);
        }}
      />

      <CancelBookingDialog
        open={Boolean(cancelRow)}
        onOpenChange={(open) => {
          if (!open) {
            setCancelRow(null);
            setActionError(null);
          }
        }}
        booking={cancelRow}
        submitting={actionBusy === "cancel"}
        errorMessage={actionError}
        onConfirm={async (reason) => {
          if (!cancelRow?.bookingId) return;
          setActionBusy("cancel");
          setActionError(null);
          try {
            await cancelBooking({ bookingId: cancelRow.bookingId, reason });
            setCancelRow(null);
            setFeedback({ type: "success", message: "Booking cancelled." });
          } catch (error) {
            setActionError(getErrorMessage(error));
          } finally {
            setActionBusy(null);
          }
        }}
      />

      <RescheduleBookingDialog
        open={Boolean(rescheduleRow)}
        onOpenChange={(open) => {
          if (!open) {
            setRescheduleRow(null);
            setActionError(null);
          }
        }}
        booking={rescheduleRow}
        submitting={actionBusy === "reschedule"}
        errorMessage={actionError}
        onConfirm={async (values) => {
          if (!rescheduleRow?.bookingId) return;
          setActionBusy("reschedule");
          setActionError(null);
          try {
            await rescheduleBooking({
              bookingId: rescheduleRow.bookingId,
              newServiceDate: values.newServiceDate,
              newWindowStart: values.newWindowStart,
              newWindowEnd: values.newWindowEnd,
              reason: values.reason,
            });
            setRescheduleRow(null);
            setFeedback({ type: "success", message: "Booking rescheduled." });
          } catch (error) {
            setActionError(getErrorMessage(error));
          } finally {
            setActionBusy(null);
          }
        }}
      />

      <OverrideStatusDialog
        open={Boolean(overrideRow)}
        onOpenChange={(open) => {
          if (!open) {
            setOverrideRow(null);
            setActionError(null);
          }
        }}
        booking={overrideRow}
        submitting={actionBusy === "override"}
        errorMessage={actionError}
        onConfirm={async ({ toStatus, reason }) => {
          if (!overrideRow?.bookingId) return;
          setActionBusy("override");
          setActionError(null);
          try {
            await overrideBookingStatus({
              bookingId: overrideRow.bookingId,
              toStatus,
              reason,
            });
            setOverrideRow(null);
            setFeedback({ type: "success", message: "Override applied." });
          } catch (error) {
            setActionError(getErrorMessage(error));
          } finally {
            setActionBusy(null);
          }
        }}
      />
    </div>
  );
}

/* ─── Pre-Booking Card ─────────────────────────────────────── */

function PreBookingCard({ row }: { row: LifecycleRow }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/60 bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {row.customerName ?? row.email ?? "Pre-booking lead"}
            </p>
            <p className="text-xs text-muted-foreground">{row.email ?? "No email"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">pre-booking</Badge>
          {row.funnelStage ? <StatusBadge status={row.funnelStage} context="funnel" /> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {row.bookingRequestId ? (
          <Link
            href={`/dashboard/requests/${row.bookingRequestId}`}
            className={cn(buttonVariants({ size: "xs", variant: "outline" }))}
          >
            Open request
          </Link>
        ) : null}
        {row.quoteRequestId ? (
          <Link
            href={`/dashboard/quotes/${row.quoteRequestId}`}
            className={cn(buttonVariants({ size: "xs", variant: "outline" }))}
          >
            Open quote
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Booking Card ─────────────────────────────────────────── */

function BookingCard({
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

  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-card p-4">
      {/* Row 1: Identity + status + amount */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", indicatorColor)} />
          <div>
            <p className="text-sm font-medium text-foreground">
              {row.customerName ?? row.email ?? row.bookingId}
            </p>
            <p className="text-xs text-muted-foreground">{row.email ?? "No email"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {row.operationalStatus ? <StatusBadge status={row.operationalStatus} /> : null}
          {row.funnelStage ? <StatusBadge status={row.funnelStage} context="funnel" /> : null}
          <span className="font-mono text-sm font-semibold text-foreground">{formatCurrency(row.amount)}</span>
        </div>
      </div>

      {/* Row 2: Metrics strip */}
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

      {/* Row 3: Checklist readiness */}
      <BookingChecklistReadiness
        bookingId={row.bookingId!}
        operationalStatus={row.operationalStatus}
      />

      <Separator />

      {/* Row 4: Actions */}
      <div className="flex flex-wrap gap-1.5">
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
          disabled={
            isBusy ||
            !row.amount ||
            (row.operationalStatus !== "completed" &&
              row.operationalStatus !== "payment_failed")
          }
          onClick={onCharge}
        >
          Charge now
        </Button>
        <AssignCleanerSheet bookingId={row.bookingId!} />
        <Button
          size="xs"
          variant="outline"
          disabled={isBusy || !canCancel}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={isBusy || row.operationalStatus === "cancelled"}
          onClick={onReschedule}
        >
          Reschedule
        </Button>
        {isAdmin ? (
          <Button size="xs" variant="outline" onClick={onOverride}>
            Override
          </Button>
        ) : null}
        <Button size="xs" variant="ghost" onClick={onDetails}>
          Details
        </Button>
      </div>
    </div>
  );
}
