"use client";

import { useEffect, useMemo, useState } from "react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import AssignCleanerSheet from "@/components/cleaners/AssignCleanerSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DispatchBooking, DispatchPriority } from "./types";

type DispatchBookingCardProps = {
  booking: DispatchBooking;
  selected: boolean;
  saving: boolean;
  onSelect: () => void;
  onOpenDetails: () => void;
  onAssigned: () => void;
  onSaveMeta: (values: {
    serviceWindowStart?: string;
    serviceWindowEnd?: string;
    estimatedDurationMinutes?: number;
    dispatchPriority?: DispatchPriority;
  }) => Promise<void>;
};

function formatCurrency(cents?: number | null): string {
  if (!cents) return "—";
  return `$${(cents / 100).toLocaleString()}`;
}

function priorityBadge(priority: DispatchPriority): string {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-700";
    case "high":
      return "bg-amber-100 text-amber-700";
    case "normal":
      return "bg-blue-100 text-blue-700";
    case "low":
      return "bg-zinc-100 text-zinc-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

export default function DispatchBookingCard({
  booking,
  selected,
  saving,
  onSelect,
  onOpenDetails,
  onAssigned,
  onSaveMeta,
}: DispatchBookingCardProps) {
  const [priority, setPriority] = useState<DispatchPriority>(booking.dispatchPriority);
  const [windowStart, setWindowStart] = useState(booking.serviceWindowStart ?? "");
  const [windowEnd, setWindowEnd] = useState(booking.serviceWindowEnd ?? "");
  const [duration, setDuration] = useState(
    booking.estimatedDurationMinutes ? String(booking.estimatedDurationMinutes) : ""
  );

  useEffect(() => {
    setPriority(booking.dispatchPriority);
    setWindowStart(booking.serviceWindowStart ?? "");
    setWindowEnd(booking.serviceWindowEnd ?? "");
    setDuration(
      booking.estimatedDurationMinutes ? String(booking.estimatedDurationMinutes) : ""
    );
  }, [
    booking.dispatchPriority,
    booking.estimatedDurationMinutes,
    booking.serviceWindowEnd,
    booking.serviceWindowStart,
  ]);

  const hasChanges = useMemo(() => {
    const currentDuration = duration ? Number(duration) : undefined;
    const initialDuration = booking.estimatedDurationMinutes ?? undefined;
    return (
      priority !== booking.dispatchPriority ||
      windowStart !== (booking.serviceWindowStart ?? "") ||
      windowEnd !== (booking.serviceWindowEnd ?? "") ||
      currentDuration !== initialDuration
    );
  }, [
    booking.dispatchPriority,
    booking.estimatedDurationMinutes,
    booking.serviceWindowEnd,
    booking.serviceWindowStart,
    duration,
    priority,
    windowEnd,
    windowStart,
  ]);

  const assignmentLabel =
    booking.assignments.assigned > 0
      ? `${booking.assignments.assigned} assigned`
      : "Unassigned";
  const checklistLabel =
    booking.checklist.total === 0
      ? "No checklist"
      : `Checklist ${booking.checklist.completed}/${booking.checklist.total}`;
  const checklistBlocked = booking.status === "in_progress" && !booking.checklist.complete;

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      )}
    >
      <button type="button" className="w-full text-left" onClick={onSelect}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {booking.customerName ?? booking.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">{booking.email}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={cn("rounded-full px-2 py-1 font-medium", priorityBadge(priority))}>
            {priority}
          </span>
          <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
            {assignmentLabel}
          </span>
          <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
            {booking.location.addressLine ? "Mapped address" : "Needs address"}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-1",
              booking.checklist.complete
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            )}
          >
            {checklistLabel}
          </span>
        </div>

        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>{booking.serviceType ?? "Standard cleaning"}</p>
          <p>{formatCurrency(booking.amount)}</p>
          <p>{booking.location.addressLine || "No address on file"}</p>
          {checklistBlocked ? (
            <p className="font-medium text-rose-700">
              Clock-out blocked until checklist is complete.
            </p>
          ) : null}
        </div>
      </button>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Priority
          </p>
          <Select
            value={priority}
            onValueChange={(value) => {
              if (!value) return;
              setPriority(value as DispatchPriority);
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Est. Duration (min)
          </p>
          <Input
            type="number"
            min={30}
            step={15}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className="h-8"
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Window Start
          </p>
          <Input
            type="time"
            value={windowStart}
            onChange={(event) => setWindowStart(event.target.value)}
            className="h-8"
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Window End
          </p>
          <Input
            type="time"
            value={windowEnd}
            onChange={(event) => setWindowEnd(event.target.value)}
            className="h-8"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!hasChanges || saving}
          onClick={async () => {
            await onSaveMeta({
              dispatchPriority: priority,
              serviceWindowStart: windowStart || undefined,
              serviceWindowEnd: windowEnd || undefined,
              estimatedDurationMinutes: duration ? Number(duration) : undefined,
            });
          }}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
        <AssignCleanerSheet
          bookingId={booking._id}
          onAssigned={onAssigned}
          trigger={
            <Button size="sm" variant="outline">
              Assign
            </Button>
          }
        />
        <Button size="sm" variant="ghost" onClick={onOpenDetails}>
          Details
        </Button>
      </div>
    </article>
  );
}
