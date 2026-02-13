"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { hasLifecycleSchedule, type LifecycleRow, type LifecycleTimelineEvent } from "./types";
import { onboardingApi } from "@/lib/onboarding/api";
import { getConfirmRequestLink } from "@/lib/bookingLinks";
import { cn } from "@/lib/utils";

type BookingLifecycleSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: LifecycleRow | null;
  isAdmin: boolean;
  onRequestCancel: () => void;
  onRequestReschedule: () => void;
  onRequestOverride: () => void;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString();
}

function formatCurrency(value?: number | null) {
  if (!value) return "—";
  return `$${(value / 100).toLocaleString()}`;
}

function eventTypeLabel(eventType: string) {
  switch (eventType) {
    case "override_transition":
      return "Override transition";
    case "legacy_transition":
      return "Legacy transition";
    case "rescheduled":
      return "Rescheduled";
    case "baseline":
      return "Baseline";
    case "created":
      return "Created";
    case "transition":
      return "Transition";
    default:
      return eventType.replace(/_/g, " ");
  }
}

async function copyToClipboard(value: string) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

const statusAccent: Record<string, string> = {
  pending_card: "from-orange-500/20 to-orange-500/0 border-orange-300/40 dark:from-orange-500/10 dark:border-orange-500/20",
  card_saved: "from-green-500/20 to-green-500/0 border-green-300/40 dark:from-green-500/10 dark:border-green-500/20",
  scheduled: "from-yellow-500/15 to-yellow-500/0 border-yellow-300/40 dark:from-yellow-500/10 dark:border-yellow-500/20",
  in_progress: "from-cyan-500/20 to-cyan-500/0 border-cyan-300/40 dark:from-cyan-500/10 dark:border-cyan-500/20",
  completed: "from-emerald-500/15 to-emerald-500/0 border-emerald-300/40 dark:from-emerald-500/10 dark:border-emerald-500/20",
  charged: "from-emerald-500/15 to-emerald-500/0 border-emerald-300/40 dark:from-emerald-500/10 dark:border-emerald-500/20",
  payment_failed: "from-red-500/20 to-red-500/0 border-red-300/40 dark:from-red-500/10 dark:border-red-500/20",
  cancelled: "from-zinc-400/15 to-zinc-400/0 border-zinc-300/40 dark:from-zinc-500/10 dark:border-zinc-500/20",
  failed: "from-red-500/20 to-red-500/0 border-red-300/40 dark:from-red-500/10 dark:border-red-500/20",
};

const timelineDot: Record<string, string> = {
  created: "bg-blue-500",
  baseline: "bg-slate-400",
  transition: "bg-primary",
  override_transition: "bg-amber-500",
  legacy_transition: "bg-zinc-400",
  rescheduled: "bg-violet-500",
};

function DataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs tracking-wide text-muted-foreground/70 uppercase">{label}</span>
      <span className={cn("text-right text-sm text-foreground truncate", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total === 0 ? 100 : Math.round((completed / total) * 100);
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            pct === 100 ? "bg-emerald-500" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {completed}/{total}
      </span>
    </div>
  );
}

export default function BookingLifecycleSheet({
  open,
  onOpenChange,
  row,
  isAdmin,
  onRequestCancel,
  onRequestReschedule,
  onRequestOverride,
}: BookingLifecycleSheetProps) {
  const bookingId = row?.bookingId ?? null;
  const booking = useQuery(onboardingApi.getBooking, bookingId ? { id: bookingId } : "skip");
  const linkedRequestId = row?.bookingRequestId ?? booking?.bookingRequestId ?? null;
  const request = useQuery(
    onboardingApi.getRequestById,
    linkedRequestId ? { id: linkedRequestId } : "skip"
  );
  const assignments = useQuery(
    onboardingApi.getBookingAssignments,
    bookingId ? { bookingId } : "skip"
  );
  const tallyLinks = useQuery(onboardingApi.getTallyLinksForActiveOrganization, {});
  const markLinkSent = useMutation(onboardingApi.markLinkSent);
  const markConfirmLinkSent = useMutation(onboardingApi.markConfirmLinkSent);
  const sendConfirmEmail = useAction(onboardingApi.sendConfirmationEmail);
  const sendCardRequestEmail = useAction(onboardingApi.sendCardRequestEmail);

  const [cursor, setCursor] = useState<string | null>(null);
  const [events, setEvents] = useState<LifecycleTimelineEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cardEmailState, setCardEmailState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [confirmEmailState, setConfirmEmailState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [confirmCopyState, setConfirmCopyState] = useState<"idle" | "copied" | "error">("idle");

  const timeline = useQuery(
    onboardingApi.getBookingTimeline,
    bookingId
      ? {
          bookingId,
          limit: 20,
          cursor: cursor ?? undefined,
        }
      : "skip"
  );

  useEffect(() => {
    if (!open) {
      setCursor(null);
      setEvents([]);
      setHasMore(false);
      setCardEmailState("idle");
      setConfirmEmailState("idle");
      setConfirmCopyState("idle");
    }
  }, [open]);

  useEffect(() => {
    setCursor(null);
    setEvents([]);
    setHasMore(false);
  }, [bookingId]);

  useEffect(() => {
    setCardEmailState("idle");
    setConfirmEmailState("idle");
    setConfirmCopyState("idle");
  }, [linkedRequestId]);

  useEffect(() => {
    if (!timeline) return;

    const incoming = timeline.rows as LifecycleTimelineEvent[];

    setEvents((previous) => {
      if (!cursor) {
        return incoming;
      }

      const known = new Set(previous.map((event) => String(event._id)));
      const next = [...previous];
      for (const event of incoming) {
        if (!known.has(String(event._id))) {
          next.push(event);
        }
      }
      return next;
    });

    setHasMore(Boolean(timeline.nextCursor));
  }, [cursor, timeline]);

  const orderedAssignments = useMemo(() => {
    if (!assignments) return [];
    return [...assignments].sort((a, b) => a.assignedAt - b.assignedAt);
  }, [assignments]);
  const assignmentRollup = useMemo(() => {
    const activeAssignments = orderedAssignments.filter(
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

    return {
      activeAssignmentsCount: activeAssignments.length,
      checklistTotal,
      checklistCompleted,
      checklistComplete,
      allActiveAssignmentsCompleted,
    };
  }, [orderedAssignments]);

  if (!row || !bookingId) {
    return null;
  }

  const staleBooking = booking === null;
  const canonicalBookingHandle = request?.canonicalBookingHandle ?? null;
  const canSendCardEmail = !staleBooking && Boolean(linkedRequestId && canonicalBookingHandle);
  const canSendConfirmationEmail =
    !staleBooking && Boolean(linkedRequestId && tallyLinks?.confirmationFormUrl);
  const canCopyConfirmLink = Boolean(
    !staleBooking && linkedRequestId && canonicalBookingHandle && tallyLinks?.confirmationFormUrl
  );

  const accentGradient =
    statusAccent[row.operationalStatus ?? ""] ??
    "from-primary/10 to-primary/0 border-border";
  const scheduleActionLabel =
    hasLifecycleSchedule(row) || Boolean(booking?.serviceDate)
      ? "Reschedule"
      : "Schedule";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-lg tracking-tight">
            {row.customerName ?? row.email ?? "Booking"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Lifecycle timeline, scheduling metadata, and state actions
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8 pt-2">
          {/* ── stale banner ── */}
          {staleBooking ? (
            <div className="rounded-lg border border-red-300/60 bg-red-50/80 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-400">
              Booking no longer exists. Close this panel and refresh the list.
            </div>
          ) : null}

          {/* ── status header with gradient accent ── */}
          <section
            className={cn(
              "rounded-xl border bg-gradient-to-b p-4 transition-colors",
              accentGradient
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {row.operationalStatus ? <StatusBadge status={row.operationalStatus} /> : null}
              {row.funnelStage ? <StatusBadge status={row.funnelStage} context="funnel" /> : null}
              <Badge variant="secondary">booking</Badge>
            </div>

            <div className="mt-4 space-y-1.5">
              <DataRow label="Email" value={row.email ?? "—"} />
              <DataRow
                label="Service"
                value={formatDate(booking?.serviceDate ?? row.serviceDate)}
              />
              <DataRow
                label="Window"
                value={`${booking?.serviceWindowStart ?? "—"} – ${booking?.serviceWindowEnd ?? "—"}`}
              />
              <DataRow label="Type" value={booking?.serviceType ?? row.serviceType ?? "—"} />
              <DataRow label="Amount" value={formatCurrency(booking?.amount ?? row.amount)} />
            </div>

            <div className="mt-3 space-y-1">
              <DataRow label="Booking" value={String(row.bookingId)} mono />
              <DataRow label="Request" value={String(linkedRequestId ?? "—")} mono />
              {row.quoteRequestId ? (
                <DataRow label="Quote" value={String(row.quoteRequestId)} mono />
              ) : null}
            </div>
          </section>

          {/* ── communication actions ── */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
              Communication
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!canSendCardEmail || cardEmailState === "sending"}
                onClick={async () => {
                  if (!linkedRequestId || !canonicalBookingHandle) {
                    setCardEmailState("error");
                    setTimeout(() => setCardEmailState("idle"), 2000);
                    return;
                  }
                  setCardEmailState("sending");
                  try {
                    await sendCardRequestEmail({ requestId: linkedRequestId });
                    await markLinkSent({ requestId: linkedRequestId });
                    setCardEmailState("sent");
                    setTimeout(() => setCardEmailState("idle"), 2000);
                  } catch (error) {
                    console.error(error);
                    setCardEmailState("error");
                    setTimeout(() => setCardEmailState("idle"), 2500);
                  }
                }}
              >
                {cardEmailState === "sending"
                  ? "Sending..."
                  : cardEmailState === "sent"
                    ? "Email sent"
                    : cardEmailState === "error"
                      ? "Failed"
                      : "Card email"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canSendConfirmationEmail || confirmEmailState === "sending"}
                onClick={async () => {
                  if (!linkedRequestId) {
                    setConfirmEmailState("error");
                    setTimeout(() => setConfirmEmailState("idle"), 3000);
                    return;
                  }
                  setConfirmEmailState("sending");
                  try {
                    await sendConfirmEmail({ requestId: linkedRequestId });
                    setConfirmEmailState("sent");
                    setTimeout(() => setConfirmEmailState("idle"), 3000);
                  } catch (error) {
                    console.error(error);
                    setConfirmEmailState("error");
                    setTimeout(() => setConfirmEmailState("idle"), 3000);
                  }
                }}
              >
                {confirmEmailState === "sending"
                  ? "Sending..."
                  : confirmEmailState === "sent"
                    ? "Sent!"
                    : confirmEmailState === "error"
                      ? "Failed"
                      : "Confirmation email"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canCopyConfirmLink}
                onClick={async () => {
                  if (!linkedRequestId || !canonicalBookingHandle) {
                    setConfirmCopyState("error");
                    setTimeout(() => setConfirmCopyState("idle"), 2000);
                    return;
                  }
                  const link = getConfirmRequestLink(
                    tallyLinks?.confirmationFormUrl ?? null,
                    linkedRequestId,
                    canonicalBookingHandle
                  );
                  if (!link) {
                    setConfirmCopyState("error");
                    setTimeout(() => setConfirmCopyState("idle"), 2000);
                    return;
                  }
                  try {
                    await copyToClipboard(link);
                    await markConfirmLinkSent({ requestId: linkedRequestId });
                    setConfirmCopyState("copied");
                    setTimeout(() => setConfirmCopyState("idle"), 1500);
                  } catch (error) {
                    console.error(error);
                    setConfirmCopyState("error");
                    setTimeout(() => setConfirmCopyState("idle"), 2000);
                  }
                }}
              >
                {confirmCopyState === "copied"
                  ? "Copied"
                  : confirmCopyState === "error"
                    ? "Unavailable"
                    : "Copy link"}
              </Button>
            </div>

            {!linkedRequestId ? (
              <p className="rounded-md bg-amber-50/80 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                Email and link actions require a linked onboarding intake.
              </p>
            ) : null}
            {linkedRequestId && canonicalBookingHandle && !tallyLinks?.confirmationFormUrl ? (
              <p className="rounded-md bg-amber-50/80 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                Complete Integrations setup to enable confirmation link actions.
              </p>
            ) : null}
          </section>

          {/* ── lifecycle actions ── */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
              Lifecycle
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={staleBooking}
                onClick={onRequestReschedule}
              >
                {scheduleActionLabel}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  staleBooking ||
                  !row.operationalStatus ||
                  !["pending_card", "card_saved", "scheduled"].includes(row.operationalStatus)
                }
                onClick={onRequestCancel}
              >
                Cancel
              </Button>
              {isAdmin ? (
                <Button size="sm" disabled={staleBooking} onClick={onRequestOverride}>
                  Override status
                </Button>
              ) : null}
            </div>
          </section>

          {/* ── assignment snapshot ── */}
          <section className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                Assignments
              </h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {assignmentRollup.activeAssignmentsCount} active
              </span>
            </div>

            <div className="mt-3">
              <ProgressBar
                completed={assignmentRollup.checklistCompleted}
                total={assignmentRollup.checklistTotal}
              />
            </div>

            {row.operationalStatus === "in_progress" && !assignmentRollup.checklistComplete ? (
              <p className="mt-2.5 rounded-md bg-rose-50/80 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                Clock-out is blocked until all checklist items are completed.
              </p>
            ) : null}
            {row.operationalStatus === "in_progress" &&
            assignmentRollup.allActiveAssignmentsCompleted ? (
              <p className="mt-2.5 rounded-md bg-emerald-50/80 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                All active assignments completed. Ready to auto-complete.
              </p>
            ) : null}

            {!assignments ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
            ) : orderedAssignments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No assignments.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {orderedAssignments.map((assignment) => (
                  <div
                    key={assignment._id}
                    className="group/card rounded-lg border border-border/60 bg-background px-3 py-2.5 transition-colors hover:border-border"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {assignment.cleaner
                          ? `${assignment.cleaner.firstName} ${assignment.cleaner.lastName}`
                          : assignment.crew?.name ?? "Unassigned"}
                      </p>
                      <StatusBadge status={assignment.status} />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{assignment.role}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {assignment.checklist?.completed ?? 0}/{assignment.checklist?.total ?? 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── lifecycle timeline ── */}
          <section className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                Timeline
              </h3>
              <Badge variant="secondary">{events.length}</Badge>
            </div>

            {!timeline && events.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading lifecycle events...</p>
            ) : events.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No lifecycle events yet.</p>
            ) : (
              <div className="relative mt-4">
                {/* vertical connector */}
                <div className="absolute top-2 bottom-2 left-[5px] w-px bg-border" />

                <div className="space-y-4">
                  {events.map((event) => (
                    <div key={event._id} className="relative pl-6">
                      {/* dot */}
                      <div
                        className={cn(
                          "absolute left-0 top-1.5 size-[11px] rounded-full ring-2 ring-background",
                          timelineDot[event.eventType] ?? "bg-muted-foreground/50"
                        )}
                      />

                      <div className="space-y-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {eventTypeLabel(event.eventType)}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                            {formatTimestamp(event.createdAt)}
                          </span>
                        </div>

                        {(event.fromStatus || event.toStatus) && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{event.fromStatus ?? "—"}</span>
                            <span className="mx-1 text-muted-foreground/40">&rarr;</span>
                            <span className="font-mono">{event.toStatus ?? "—"}</span>
                          </p>
                        )}

                        {event.reason ? (
                          <p className="text-xs text-muted-foreground">
                            Reason: {event.reason}
                          </p>
                        ) : null}

                        <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground/60">
                          <span>{event.source}</span>
                          {event.actorName ? <span>{event.actorName}</span> : null}
                          {(event.fromServiceDate || event.toServiceDate) && (
                            <span>
                              {event.fromServiceDate ?? "—"} &rarr; {event.toServiceDate ?? "—"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {hasMore ? (
                  <div className="mt-4 pl-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCursor(timeline?.nextCursor ?? null)}
                      disabled={!timeline?.nextCursor}
                    >
                      Load more
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
