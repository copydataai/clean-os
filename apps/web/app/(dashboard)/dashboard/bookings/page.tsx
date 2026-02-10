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

const FUNNEL_UI_ENABLED = process.env.NEXT_PUBLIC_BOOKING_FUNNEL_UI === "true";
type RowTypeFilter = "all" | "booking" | "pre_booking";
type OperationalStatusFilter = "all" | (typeof OPERATIONS_STATUSES)[number];
type FunnelStageFilter = "all" | (typeof FUNNEL_STAGES)[number];

function formatCurrency(cents?: number | null) {
  if (!cents) {
    return "—";
  }
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

  return (
    <div className="surface-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-foreground">{booking.customerName ?? booking.email}</p>
          <p className="text-sm text-muted-foreground">{booking.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Booking ID: {booking._id}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={booking.status} />
          <span className="text-sm font-semibold text-foreground">{formatCurrency(booking.amount)}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>Service date: {booking.serviceDate ?? "TBD"}</span>
        <span>Service type: {booking.serviceType ?? "Standard"}</span>
      </div>

      {assignments && assignments.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase text-muted-foreground">Assigned Cleaners</p>
          <div className="flex flex-wrap gap-2">
            {assignments.map((assignment) => (
              <div
                key={assignment._id}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5"
              >
                {assignment.cleaner ? (
                  <>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-white">
                      {assignment.cleaner.firstName.charAt(0)}
                      {assignment.cleaner.lastName.charAt(0)}
                    </div>
                    <span className="text-sm text-foreground">
                      {assignment.cleaner.firstName} {assignment.cleaner.lastName}
                    </span>
                  </>
                ) : assignment.crew ? (
                  <span className="text-sm text-foreground">{assignment.crew.name}</span>
                ) : null}
                <Badge className="bg-muted text-xs text-muted-foreground">{assignment.role}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={isBusy || booking.status !== "in_progress"}
          onClick={onMarkCompleted}
        >
          Mark completed
        </Button>
        <Button
          size="sm"
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

function LegacyBookingsView() {
  const bookings = useQuery(api.bookings.listBookings, { limit: 50 });
  const markCompleted = useMutation(api.bookings.markJobCompleted);
  const chargeJob = useAction(api.bookings.chargeCompletedJob);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!bookings) {
    return (
      <div className="surface-card p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
    <div className="grid gap-4">
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
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <Badge className="bg-muted text-muted-foreground">
        Checklist {checklistCompleted}/{checklistTotal}
      </Badge>
      <Badge className="bg-muted text-muted-foreground">
        Active assignments {activeAssignments.length}
      </Badge>
      {operationalStatus === "in_progress" && !checklistComplete ? (
        <Badge className="bg-rose-100 text-rose-700">Clock-out blocked</Badge>
      ) : null}
      {operationalStatus === "in_progress" && allActiveAssignmentsCompleted ? (
        <Badge className="bg-emerald-100 text-emerald-700">Ready to auto-complete</Badge>
      ) : null}
    </div>
  );
}

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
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

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

  if (!FUNNEL_UI_ENABLED) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bookings" subtitle={subtitle} />
        <LegacyBookingsView />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" subtitle={subtitle} />

      {feedback ? (
        <div
          className={
            feedback.type === "success"
              ? "rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
              : "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          }
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="surface-card space-y-3 p-4">
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{rows.length} rows on this page</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
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
              Previous page
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!nextCursor}
              onClick={() => {
                if (!nextCursor) return;
                setCursorHistory((previous) => [...previous, cursor ?? ""]);
                setCursor(nextCursor);
              }}
            >
              Next page
            </Button>
          </div>
        </div>
      </div>

      {!lifecyclePage ? (
        <div className="surface-card p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading lifecycle rows...</p>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No lifecycle rows"
          description="Try relaxing filters or clearing search terms."
        />
      ) : (
        <div className="grid gap-4">
          {rows.map((row) => {
            if (row.rowType === "pre_booking") {
              return (
                <div key={`pre:${row.bookingRequestId ?? row.quoteRequestId}`} className="surface-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        {row.customerName ?? row.email ?? "Pre-booking lead"}
                      </p>
                      <p className="text-sm text-muted-foreground">{row.email ?? "No email"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-slate-100 text-slate-700">pre-booking</Badge>
                      {row.funnelStage ? <StatusBadge status={row.funnelStage} context="funnel" /> : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Request ID: {row.bookingRequestId ?? "—"}</span>
                    <span>Quote Request ID: {row.quoteRequestId ?? "—"}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {row.bookingRequestId ? (
                      <Link
                        href={`/dashboard/requests/${row.bookingRequestId}`}
                        className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                      >
                        Open request
                      </Link>
                    ) : null}
                    {row.quoteRequestId ? (
                      <Link
                        href={`/dashboard/quotes/${row.quoteRequestId}`}
                        className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                      >
                        Open quote request
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            }

            if (!row.bookingId) return null;

            const isBusy = busyRowId === row.bookingId;
            const canCancel =
              row.operationalStatus === "pending_card" ||
              row.operationalStatus === "card_saved" ||
              row.operationalStatus === "scheduled";

            return (
              <div key={row.bookingId} className="surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      {row.customerName ?? row.email ?? row.bookingId}
                    </p>
                    <p className="text-sm text-muted-foreground">{row.email ?? "No email"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Booking ID: {row.bookingId}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.operationalStatus ? <StatusBadge status={row.operationalStatus} /> : null}
                    {row.funnelStage ? <StatusBadge status={row.funnelStage} context="funnel" /> : null}
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(row.amount)}</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Service date: {row.serviceDate ?? "TBD"}</span>
                  <span>Service type: {row.serviceType ?? "Standard"}</span>
                </div>
                <BookingChecklistReadiness
                  bookingId={row.bookingId}
                  operationalStatus={row.operationalStatus}
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isBusy || row.operationalStatus !== "in_progress"}
                    onClick={async () => {
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
                  >
                    Mark completed
                  </Button>

                  <Button
                    size="sm"
                    disabled={
                      isBusy ||
                      !row.amount ||
                      (row.operationalStatus !== "completed" &&
                        row.operationalStatus !== "payment_failed")
                    }
                    onClick={async () => {
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
                  >
                    Charge now
                  </Button>

                  <AssignCleanerSheet bookingId={row.bookingId} />

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy || !canCancel}
                    onClick={() => {
                      setActionError(null);
                      setCancelRow(row);
                    }}
                  >
                    Cancel
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy || row.operationalStatus === "cancelled"}
                    onClick={() => {
                      setActionError(null);
                      setRescheduleRow(row);
                    }}
                  >
                    Reschedule
                  </Button>

                  {isAdmin ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActionError(null);
                        setOverrideRow(row);
                      }}
                    >
                      Override status
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDetailRow(row);
                      setDetailOpen(true);
                    }}
                  >
                    Details
                  </Button>
                </div>
              </div>
            );
          })}
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
