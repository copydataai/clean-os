"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
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
import type { LifecycleRow, LifecycleTimelineEvent } from "./types";

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
  const booking = useQuery(api.bookings.getBooking, bookingId ? { id: bookingId } : "skip");
  const assignments = useQuery(
    api.cleaners.getBookingAssignments,
    bookingId ? { bookingId } : "skip"
  );

  const [cursor, setCursor] = useState<string | null>(null);
  const [events, setEvents] = useState<LifecycleTimelineEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const timeline = useQuery(
    api.bookingLifecycle.getBookingLifecycleTimeline,
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
    }
  }, [open]);

  useEffect(() => {
    setCursor(null);
    setEvents([]);
    setHasMore(false);
  }, [bookingId]);

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

  if (!row || !bookingId) {
    return null;
  }

  const staleBooking = booking === null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{row.customerName ?? row.email ?? "Booking"}</SheetTitle>
          <SheetDescription>Lifecycle timeline, scheduling metadata, and state actions</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4">
          {staleBooking ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Booking no longer exists. Close this panel and refresh the list.
            </div>
          ) : null}

          <section className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              {row.operationalStatus ? <StatusBadge status={row.operationalStatus} /> : null}
              {row.funnelStage ? <StatusBadge status={row.funnelStage} context="funnel" /> : null}
              <Badge className="bg-muted text-muted-foreground">booking</Badge>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <p>Email: {row.email ?? "—"}</p>
              <p>Service date: {formatDate(booking?.serviceDate ?? row.serviceDate)}</p>
              <p>
                Window: {booking?.serviceWindowStart ?? "—"} - {booking?.serviceWindowEnd ?? "—"}
              </p>
              <p>Service type: {booking?.serviceType ?? row.serviceType ?? "—"}</p>
              <p>Amount: {formatCurrency(booking?.amount ?? row.amount)}</p>
              <p>Booking ID: {row.bookingId}</p>
              <p>Request ID: {row.bookingRequestId ?? "—"}</p>
              <p>Quote Request ID: {row.quoteRequestId ?? "—"}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={staleBooking}
                onClick={onRequestReschedule}
              >
                Reschedule
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

          <section className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">Assignment Snapshot</h3>
            {!assignments ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading assignments...</p>
            ) : orderedAssignments.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No assignments.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {orderedAssignments.map((assignment) => (
                  <div
                    key={assignment._id}
                    className="rounded-md border border-border bg-background p-2 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {assignment.cleaner
                        ? `${assignment.cleaner.firstName} ${assignment.cleaner.lastName}`
                        : assignment.crew?.name ?? "Unassigned"}
                    </p>
                    <p className="text-muted-foreground">
                      {assignment.role} · {assignment.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Lifecycle Timeline</h3>
              <Badge className="bg-muted text-muted-foreground">{events.length} events</Badge>
            </div>

            {!timeline && events.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading lifecycle events...</p>
            ) : events.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No lifecycle events yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {events.map((event) => (
                  <div key={event._id} className="rounded-md border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {eventTypeLabel(event.eventType)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatTimestamp(event.createdAt)}</p>
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                      <p>
                        {event.fromStatus ?? "—"} → {event.toStatus ?? "—"}
                      </p>
                      {event.reason ? <p>Reason: {event.reason}</p> : null}
                      <p>Source: {event.source}</p>
                      {event.actorName ? <p>Actor: {event.actorName}</p> : null}
                      {(event.fromServiceDate || event.toServiceDate) && (
                        <p>
                          Date: {event.fromServiceDate ?? "—"} → {event.toServiceDate ?? "—"}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {hasMore ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCursor(timeline?.nextCursor ?? null)}
                    disabled={!timeline?.nextCursor}
                  >
                    Load more
                  </Button>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
