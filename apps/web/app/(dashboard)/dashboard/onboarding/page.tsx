"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
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
import { onboardingApi } from "@/lib/onboarding/api";
import { onboardingRequestPath } from "@/lib/onboarding/routes";
import RequestCreateSheet from "@/components/dashboard/RequestCreateSheet";

type RowTypeFilter = "all" | "booking" | "pre_booking";
type OperationalStatusFilter = "all" | (typeof OPERATIONS_STATUSES)[number];
type FunnelStageFilter = "all" | (typeof FUNNEL_STAGES)[number];
type AlertTone = "success" | "error" | "warning";

type OnboardingAlert = {
  id: string;
  tone: AlertTone;
  content: ReactNode;
  action?: ReactNode;
};

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
      ) : null}
      {operationalStatus === "in_progress" && allActiveAssignmentsCompleted ? (
        <Badge className="bg-emerald-100 text-emerald-700 text-[10px] dark:bg-emerald-900/40 dark:text-emerald-400">
          Ready to auto-complete
        </Badge>
      ) : null}
    </div>
  );
}

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const { activeOrg } = useActiveOrganization();
  const isAdmin = Boolean(activeOrg && isAdminRole(activeOrg.role));
  const tallyLinks = useQuery(onboardingApi.getTallyLinksForActiveOrganization, {});

  const [rowType, setRowType] = useState<RowTypeFilter>("all");
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatusFilter>("all");
  const [funnelStage, setFunnelStage] = useState<FunnelStageFilter>("all");
  const [search, setSearch] = useState("");
  const [serviceDate, setServiceDate] = useState("");

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const markCompleted = useMutation(onboardingApi.markBookingCompleted);
  const chargeJob = useAction(onboardingApi.chargeBooking);
  const cancelBooking = useMutation(onboardingApi.cancelBooking);
  const rescheduleBooking = useMutation(onboardingApi.rescheduleBooking);
  const overrideBookingStatus = useMutation(onboardingApi.overrideBookingStatus);

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

  const lifecyclePage = useQuery(onboardingApi.listRows, {
    cursor,
    limit: 30,
    rowType: rowType === "all" ? undefined : rowType,
    operationalStatus: operationalStatus === "all" ? undefined : operationalStatus,
    funnelStage: funnelStage === "all" ? undefined : funnelStage,
    search: search.trim() ? search.trim() : undefined,
    serviceDate: serviceDate || undefined,
  });

  const rows = (lifecyclePage?.rows as LifecycleRow[] | undefined) ?? [];
  const nextCursor = lifecyclePage?.nextCursor ?? null;
  const intakeRows = rows.filter((row) => row.rowType === "pre_booking");
  const activeJobRows = rows.filter((row) => row.rowType === "booking" && Boolean(row.bookingId));

  const deepLinkedBookingIdRaw = searchParams.get("bookingId");
  const deepLinkedBookingId =
    deepLinkedBookingIdRaw && /^[a-z0-9]+$/.test(deepLinkedBookingIdRaw)
      ? (deepLinkedBookingIdRaw as Id<"bookings">)
      : null;
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [deepLinkResetAttempted, setDeepLinkResetAttempted] = useState(false);
  const [deepLinkAlert, setDeepLinkAlert] = useState<"needs_reset" | "not_found" | null>(null);

  const hasActiveFilters =
    rowType !== "all" ||
    operationalStatus !== "all" ||
    funnelStage !== "all" ||
    search.trim().length > 0 ||
    serviceDate.length > 0 ||
    Boolean(cursor) ||
    cursorHistory.length > 0;
  const activeFilterCount = [
    rowType !== "all",
    operationalStatus !== "all",
    funnelStage !== "all",
    search.trim().length > 0,
    serviceDate.length > 0,
    Boolean(cursor) || cursorHistory.length > 0,
  ].filter(Boolean).length;

  useEffect(() => {
    setCursor(undefined);
    setCursorHistory([]);
  }, [funnelStage, operationalStatus, rowType, search, serviceDate]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!deepLinkedBookingId) {
      setDeepLinkHandled(false);
      setDeepLinkResetAttempted(false);
      setDeepLinkAlert(null);
      return;
    }

    setDeepLinkHandled(false);
    setDeepLinkResetAttempted(false);
    setDeepLinkAlert(null);
  }, [deepLinkedBookingId]);

  useEffect(() => {
    if (!deepLinkedBookingId || deepLinkHandled) {
      return;
    }

    if (!lifecyclePage) {
      return;
    }

    const row = rows.find((candidate) => candidate.bookingId === deepLinkedBookingId);
    if (row) {
      setDetailRow(row);
      setDetailOpen(true);
      setDeepLinkAlert(null);
      setDeepLinkHandled(true);
      return;
    }

    if (hasActiveFilters && !deepLinkResetAttempted) {
      setDeepLinkAlert("needs_reset");
      return;
    }

    setDeepLinkAlert("not_found");
  }, [
    deepLinkedBookingId,
    deepLinkHandled,
    deepLinkResetAttempted,
    hasActiveFilters,
    lifecyclePage,
    rows,
  ]);

  const canGoBack = cursorHistory.length > 0;

  function resetFilters(markDeepLinkResetAttempt: boolean) {
    setRowType("all");
    setOperationalStatus("all");
    setFunnelStage("all");
    setSearch("");
    setServiceDate("");
    setCursor(undefined);
    setCursorHistory([]);
    setDeepLinkResetAttempted(markDeepLinkResetAttempt);
    setDeepLinkAlert(null);
    setDeepLinkHandled(false);
  }

  function clearFiltersForDeepLink() {
    resetFilters(true);
  }

  function clearAllFilters() {
    resetFilters(false);
  }

  const alerts: OnboardingAlert[] = [];
  if (tallyLinks !== undefined && !tallyLinks?.confirmationFormUrl) {
    alerts.push({
      id: "integration-warning",
      tone: "warning",
      content: "Confirmation links are unavailable until Integrations setup is complete.",
      action: (
        <Link
          href="/dashboard/settings/integrations"
          className={cn(buttonVariants({ size: "xs", variant: "outline" }))}
        >
          Open Integrations
        </Link>
      ),
    });
  }
  if (feedback) {
    alerts.push({
      id: "feedback",
      tone: feedback.type,
      content: feedback.message,
    });
  }
  if (deepLinkedBookingId && deepLinkAlert) {
    alerts.push(
      deepLinkAlert === "needs_reset"
        ? {
            id: "deep-link-needs-reset",
            tone: "warning",
            content: (
              <>
                Booking <span className="font-mono">{deepLinkedBookingId}</span> isn&apos;t visible with current
                filters.
              </>
            ),
            action: (
              <Button size="xs" onClick={clearFiltersForDeepLink}>
                Clear filters
              </Button>
            ),
          }
        : {
            id: "deep-link-not-found",
            tone: "warning",
            content: (
              <>
                Booking <span className="font-mono">{deepLinkedBookingId}</span> wasn&apos;t found on this onboarding
                page. It may be outside the recent lifecycle window.
              </>
            ),
          }
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Onboarding"
        subtitle="Unified intake and active job lifecycle in one operator queue."
      >
        <RequestCreateSheet triggerLabel="New onboarding" />
      </PageHeader>

      <OnboardingKpiStrip rows={rows} />

      <OnboardingAlertRail alerts={alerts} />

      <div className="surface-card sticky top-20 z-10 overflow-hidden rounded-2xl">
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <Select value={rowType} onValueChange={(value) => value && setRowType(value as RowTypeFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Row type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All row types</SelectItem>
                <SelectItem value="booking">Active jobs</SelectItem>
                <SelectItem value="pre_booking">Intake</SelectItem>
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-mono font-medium text-foreground">{rows.length}</span> rows on this page
            </p>
            <Badge variant="outline" className="text-[10px] font-medium">
              {activeFilterCount} active filters
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="ghost"
              disabled={!hasActiveFilters}
              onClick={clearAllFilters}
            >
              Clear all
            </Button>
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

      {!lifecyclePage ? (
        <OnboardingRowsSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No onboarding rows"
          description={
            hasActiveFilters
              ? "No rows match your current filters. Clear filters or create a new onboarding intake."
              : "No onboarding activity yet. Create onboarding to start intake and active job tracking."
          }
          action={
            <RequestCreateSheet
              triggerLabel="Create onboarding"
              triggerVariant="outline"
            />
          }
        />
      ) : (
        <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
          <OnboardingQueueSection title="Intake" count={intakeRows.length} kind="intake">
            {intakeRows.length === 0 ? (
              <QueueSectionEmpty copy="No intake rows in this onboarding view." />
            ) : (
              <div className="space-y-2">
                {intakeRows.map((row, index) => (
                  <div
                    key={`pre:${row.bookingRequestId ?? row.quoteRequestId}`}
                    className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
                    style={{ animationDelay: `${Math.min(index * 20, 120)}ms` }}
                  >
                    <PreBookingCard row={row} />
                  </div>
                ))}
              </div>
            )}
          </OnboardingQueueSection>

          <OnboardingQueueSection title="Active jobs" count={activeJobRows.length} kind="job">
            {activeJobRows.length === 0 ? (
              <QueueSectionEmpty copy="No active jobs in this onboarding view." />
            ) : (
              <div className="space-y-2">
                {activeJobRows.map((row, index) => {
                  if (!row.bookingId) return null;

                  return (
                    <div
                      key={row.bookingId}
                      className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
                      style={{ animationDelay: `${Math.min(index * 20, 120)}ms` }}
                    >
                      <BookingCard
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
                    </div>
                  );
                })}
              </div>
            )}
          </OnboardingQueueSection>
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

function OnboardingKpiStrip({ rows }: { rows: LifecycleRow[] }) {
  const intakeCount = rows.filter((row) => row.rowType === "pre_booking").length;
  const activeJobsCount = rows.filter((row) => row.rowType === "booking" && Boolean(row.bookingId)).length;
  const inProgressCount = rows.filter(
    (row) => row.rowType === "booking" && row.operationalStatus === "in_progress"
  ).length;
  const kpis = [
    { label: "Total rows", value: rows.length },
    { label: "Intake", value: intakeCount },
    { label: "Active jobs", value: activeJobsCount },
    { label: "In progress", value: inProgressCount },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="surface-card rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {kpi.label}
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{kpi.value}</p>
        </div>
      ))}
    </div>
  );
}

function OnboardingAlertRail({ alerts }: { alerts: OnboardingAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
      {alerts.map((alert) => (
        <OnboardingAlertCard key={alert.id} tone={alert.tone} action={alert.action}>
          {alert.content}
        </OnboardingAlertCard>
      ))}
    </div>
  );
}

function OnboardingAlertCard({
  tone,
  children,
  action,
}: {
  tone: AlertTone;
  children: ReactNode;
  action?: ReactNode;
}) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200"
      : tone === "error"
      ? "border-red-200 bg-red-50/70 text-red-900 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-200"
      : "border-amber-200 bg-[var(--onboarding-warning-bg)] text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200";

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm", toneClasses)}>
      <p>{children}</p>
      {action}
    </div>
  );
}

function OnboardingQueueSection({
  title,
  count,
  kind,
  children,
}: {
  title: string;
  count: number;
  kind: "intake" | "job";
  children: ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-medium",
            kind === "intake"
              ? "border-[color:var(--onboarding-intake-accent)]/45 text-[color:var(--onboarding-intake-accent)]"
              : "border-[color:var(--onboarding-job-accent)]/45 text-[color:var(--onboarding-job-accent)]"
          )}
        >
          {count}
        </Badge>
      </div>
      <Separator />
      <div className="p-4">{children}</div>
    </section>
  );
}

function QueueSectionEmpty({ copy }: { copy: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
      {copy}
    </div>
  );
}

function OnboardingRowsSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="surface-card overflow-hidden rounded-2xl p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-44 rounded bg-muted/70" />
            <div className="h-3 w-72 rounded bg-muted/50" />
            <div className="h-3 w-56 rounded bg-muted/40" />
            <div className="h-7 w-28 rounded bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PreBookingCard({ row }: { row: LifecycleRow }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--onboarding-intake-accent)" }}
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {row.customerName ?? row.email ?? "Intake lead"}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{row.email ?? "No email provided"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="border-[color:var(--onboarding-intake-accent)]/40 text-[10px] text-[color:var(--onboarding-intake-accent)]"
          >
            intake
          </Badge>
          {row.funnelStage ? <StatusBadge status={row.funnelStage} context="funnel" /> : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {row.bookingRequestId ? (
          <Link
            href={onboardingRequestPath(row.bookingRequestId)}
            className={cn(buttonVariants({ size: "xs", variant: "outline" }))}
          >
            Open intake
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
  const isActionCriticalState =
    row.operationalStatus === "in_progress" ||
    row.operationalStatus === "payment_failed" ||
    row.operationalStatus === "cancelled";

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
        <BookingChecklistReadiness
          bookingId={row.bookingId!}
          operationalStatus={row.operationalStatus}
        />
      </div>

      <Separator />

      <div className="flex flex-wrap gap-1.5">
        <Button size="xs" onClick={onDetails}>
          Details
        </Button>
        <AssignCleanerSheet
          bookingId={row.bookingId!}
          trigger={
            <Button size="xs" variant="outline">
              Assign
            </Button>
          }
        />
        <Button
          size="xs"
          variant="outline"
          disabled={isBusy || row.operationalStatus === "cancelled"}
          onClick={onReschedule}
        >
          Reschedule
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
