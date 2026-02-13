"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
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
import {
  FUNNEL_STAGES,
  OPERATIONS_STATUSES,
  hasLifecycleSchedule,
  type LifecycleRow,
} from "@/components/bookings/types";
import { cn } from "@/lib/utils";
import { useActiveOrganization } from "@/components/org/useActiveOrganization";
import { onboardingApi } from "@/lib/onboarding/api";
import RequestCreateSheet from "@/components/dashboard/RequestCreateSheet";
import type { OnboardingAlert, RowTypeFilter, OperationalStatusFilter, FunnelStageFilter } from "@/components/onboarding/types";
import { getErrorMessage, isAdminRole } from "@/components/onboarding/types";
import OnboardingKpiStrip from "@/components/onboarding/OnboardingKpiStrip";
import OnboardingAlertRail from "@/components/onboarding/OnboardingAlertRail";
import OnboardingQueueSection, { QueueSectionEmpty } from "@/components/onboarding/OnboardingQueueSection";
import OnboardingRowsSkeleton from "@/components/onboarding/OnboardingRowsSkeleton";
import PreBookingCard, { type QuickActionState } from "@/components/onboarding/PreBookingCard";
import BookingCard from "@/components/onboarding/BookingCard";
import {
  getOnboardingAttentionLevel,
  matchesAttentionFilter,
  rankAttention,
  type OnboardingAttentionFilter,
} from "@/lib/commsAttention";

const ATTENTION_PREVIEW_LIMIT = 8;

type IntakeRowWithAttention = LifecycleRow & {
  attentionLevel: ReturnType<typeof getOnboardingAttentionLevel>;
  stableKey: string;
};

function intakeRowKey(row: LifecycleRow): string {
  if (row.bookingRequestId) {
    return row.bookingRequestId;
  }

  if (row.quoteRequestId) {
    return row.quoteRequestId;
  }

  return `${row.createdAt}:${row.updatedAt}:${row.email ?? "no-email"}`;
}

const onboardingAttentionFilters: Array<{
  value: OnboardingAttentionFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "needs_attention", label: "Needs attention" },
  { value: "email_failed", label: "Email failed" },
  { value: "delivery_delayed", label: "Delayed" },
  { value: "undelivered_60m", label: "Undelivered 60m" },
];

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const { activeOrg } = useActiveOrganization();
  const isAdmin = Boolean(activeOrg && isAdminRole(activeOrg.role));
  const tallyLinks = useQuery(onboardingApi.getTallyLinksForActiveOrganization, {});

  const [rowType, setRowType] = useState<RowTypeFilter>("all");
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatusFilter>("all");
  const [funnelStage, setFunnelStage] = useState<FunnelStageFilter>("all");
  const [attentionFilter, setAttentionFilter] = useState<OnboardingAttentionFilter>("all");
  const [search, setSearch] = useState("");
  const [serviceDate, setServiceDate] = useState("");

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const markCompleted = useMutation(onboardingApi.markBookingCompleted);
  const chargeJob = useAction(onboardingApi.chargeBooking);
  const sendCardRequestEmail = useAction(onboardingApi.sendCardRequestEmail);
  const sendConfirmationEmail = useAction(onboardingApi.sendConfirmationEmail);
  const cancelBooking = useMutation(onboardingApi.cancelBooking);
  const rescheduleBooking = useMutation(onboardingApi.rescheduleBooking);
  const overrideBookingStatus = useMutation(onboardingApi.overrideBookingStatus);

  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [commsBusyByRequestId, setCommsBusyByRequestId] = useState<
    Record<string, { card: QuickActionState; confirm: QuickActionState }>
  >({});

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

  const nowMs = Date.now();
  const intakeRowsWithAttention = useMemo<IntakeRowWithAttention[]>(() => {
    return intakeRows.map((row) => ({
      ...row,
      attentionLevel: getOnboardingAttentionLevel(row, nowMs),
      stableKey: intakeRowKey(row),
    }));
  }, [intakeRows, nowMs]);

  const filteredIntakeRows = useMemo(() => {
    return intakeRowsWithAttention.filter((row) =>
      matchesAttentionFilter(row, attentionFilter, nowMs)
    );
  }, [attentionFilter, intakeRowsWithAttention, nowMs]);

  const attentionIntakeRows = useMemo(() => {
    return [...filteredIntakeRows]
      .filter((row) => row.attentionLevel !== "none")
      .sort((a, b) => {
        const rankDelta = rankAttention(b.attentionLevel) - rankAttention(a.attentionLevel);
        if (rankDelta !== 0) {
          return rankDelta;
        }
        return b.updatedAt - a.updatedAt;
      });
  }, [filteredIntakeRows]);

  const normalIntakeRows = useMemo(() => {
    if (attentionFilter === "all") {
      return intakeRowsWithAttention.filter((row) => row.attentionLevel === "none");
    }
    return filteredIntakeRows.filter((row) => row.attentionLevel === "none");
  }, [attentionFilter, filteredIntakeRows, intakeRowsWithAttention]);

  const attentionPreviewRows = attentionIntakeRows.slice(0, ATTENTION_PREVIEW_LIMIT);

  const deepLinkedBookingId =
    (searchParams.get("bookingId") as import("@clean-os/convex/data-model").Id<"bookings">) ?? null;
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [deepLinkResetAttempted, setDeepLinkResetAttempted] = useState(false);
  const [deepLinkAlert, setDeepLinkAlert] = useState<"needs_reset" | "not_found" | null>(null);

  const hasActiveFilters =
    rowType !== "all" ||
    operationalStatus !== "all" ||
    funnelStage !== "all" ||
    attentionFilter !== "all" ||
    search.trim().length > 0 ||
    serviceDate.length > 0 ||
    Boolean(cursor) ||
    cursorHistory.length > 0;
  const activeFilterCount = [
    rowType !== "all",
    operationalStatus !== "all",
    funnelStage !== "all",
    attentionFilter !== "all",
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
    setAttentionFilter("all");
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

  function readCommsState(requestId: string | null | undefined) {
    if (!requestId) {
      return { card: "idle", confirm: "idle" } as const;
    }

    return commsBusyByRequestId[requestId] ?? { card: "idle", confirm: "idle" };
  }

  function setCommsState(
    requestId: string,
    channel: "card" | "confirm",
    state: QuickActionState
  ) {
    setCommsBusyByRequestId((previous) => {
      const existing = previous[requestId] ?? { card: "idle", confirm: "idle" };
      return {
        ...previous,
        [requestId]: {
          ...existing,
          [channel]: state,
        },
      };
    });
  }

  function resetCommsStateLater(
    requestId: string,
    channel: "card" | "confirm",
    delayMs = 2200
  ) {
    window.setTimeout(() => {
      setCommsState(requestId, channel, "idle");
    }, delayMs);
  }

  const confirmationFormAvailable = Boolean(tallyLinks?.confirmationFormUrl);

  async function onSendCardEmail(requestId: NonNullable<LifecycleRow["bookingRequestId"]>) {
    setCommsState(requestId, "card", "sending");
    try {
      await sendCardRequestEmail({ requestId });
      setCommsState(requestId, "card", "sent");
      setFeedback({ type: "success", message: "Card email sent." });
      resetCommsStateLater(requestId, "card");
    } catch (error) {
      setCommsState(requestId, "card", "error");
      setFeedback({ type: "error", message: getErrorMessage(error) });
      resetCommsStateLater(requestId, "card", 2600);
    }
  }

  async function onSendConfirmEmail(requestId: NonNullable<LifecycleRow["bookingRequestId"]>) {
    if (!confirmationFormAvailable) {
      setCommsState(requestId, "confirm", "error");
      setFeedback({
        type: "error",
        message: "Confirmation form URL is not configured in Integrations.",
      });
      resetCommsStateLater(requestId, "confirm", 2600);
      return;
    }

    setCommsState(requestId, "confirm", "sending");
    try {
      await sendConfirmationEmail({ requestId });
      setCommsState(requestId, "confirm", "sent");
      setFeedback({ type: "success", message: "Confirmation email sent." });
      resetCommsStateLater(requestId, "confirm");
    } catch (error) {
      setCommsState(requestId, "confirm", "error");
      setFeedback({ type: "error", message: getErrorMessage(error) });
      resetCommsStateLater(requestId, "confirm", 2600);
    }
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

      <OnboardingKpiStrip rows={rows} intakeCount={intakeRows.length} activeJobsCount={activeJobRows.length} />

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
          <p className="text-xs text-muted-foreground">Quick filters</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {onboardingAttentionFilters.map((filter) => (
              <Button
                key={filter.value}
                size="xs"
                variant={attentionFilter === filter.value ? "secondary" : "outline"}
                onClick={() => setAttentionFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
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
                const copy = [...cursorHistory];
                const previousCursor = copy.pop();
                setCursorHistory(copy);
                setCursor(previousCursor || undefined);
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
          <OnboardingQueueSection
            title="Needs Attention"
            count={attentionIntakeRows.length}
            kind="intake"
          >
            {attentionIntakeRows.length === 0 ? (
              <QueueSectionEmpty copy="No communication issues need attention on this page." />
            ) : (
              <div className="space-y-2">
                {attentionIntakeRows.length > ATTENTION_PREVIEW_LIMIT ? (
                  <p className="text-xs text-muted-foreground">
                    Showing top {ATTENTION_PREVIEW_LIMIT} of {attentionIntakeRows.length} attention rows.
                  </p>
                ) : null}
                {attentionPreviewRows.map((row, index) => {
                  const commsState = readCommsState(row.bookingRequestId);
                  return (
                    <div
                      key={`pre:attention:${row.stableKey}`}
                      className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
                      style={{ animationDelay: `${Math.min(index * 20, 120)}ms` }}
                    >
                      <PreBookingCard
                        row={row}
                        attentionLevel={row.attentionLevel}
                        cardActionState={commsState.card}
                        confirmActionState={commsState.confirm}
                        confirmationEnabled={confirmationFormAvailable}
                        onSendCardEmail={onSendCardEmail}
                        onSendConfirmEmail={onSendConfirmEmail}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </OnboardingQueueSection>

          <OnboardingQueueSection title="Intake" count={normalIntakeRows.length} kind="intake">
            {normalIntakeRows.length === 0 ? (
              <QueueSectionEmpty
                copy={
                  attentionFilter === "all"
                    ? "No normal intake rows in this onboarding view."
                    : "No additional intake rows match this quick filter."
                }
              />
            ) : (
              <div className="space-y-2">
                {normalIntakeRows.map((row, index) => {
                  const commsState = readCommsState(row.bookingRequestId);
                  return (
                    <div
                      key={`pre:normal:${row.stableKey}`}
                      className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
                      style={{ animationDelay: `${Math.min(index * 20, 120)}ms` }}
                    >
                      <PreBookingCard
                        row={row}
                        attentionLevel={row.attentionLevel}
                        cardActionState={commsState.card}
                        confirmActionState={commsState.confirm}
                        confirmationEnabled={confirmationFormAvailable}
                        onSendCardEmail={onSendCardEmail}
                        onSendConfirmEmail={onSendConfirmEmail}
                      />
                    </div>
                  );
                })}
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
                          if (!row.amount) {
                            setFeedback({ type: "error", message: "Amount is required to charge." });
                            return;
                          }
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
          const wasScheduled = hasLifecycleSchedule(rescheduleRow);
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
            setFeedback({
              type: "success",
              message: wasScheduled ? "Booking rescheduled." : "Booking scheduled.",
            });
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
