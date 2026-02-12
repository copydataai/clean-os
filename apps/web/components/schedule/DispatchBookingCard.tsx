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
  if (!cents) return "-";
  return `$${(cents / 100).toLocaleString()}`;
}

function priorityBadge(priority: DispatchPriority): string {
  switch (priority) {
    case "urgent":
      return "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700/60 dark:bg-rose-950/35 dark:text-rose-300";
    case "high":
      return "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/35 dark:text-amber-300";
    case "normal":
      return "border-cyan-300 bg-cyan-100 text-cyan-700 dark:border-cyan-700/60 dark:bg-cyan-950/35 dark:text-cyan-300";
    case "low":
      return "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700/60 dark:bg-zinc-900/40 dark:text-zinc-300";
    default:
      return "border-zinc-300 bg-zinc-100 text-zinc-700";
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
        "rounded-2xl border p-4 transition-all",
        selected
          ? "border-primary bg-primary/5 shadow-[0_16px_48px_-36px_rgba(15,61,143,0.65)]"
          : "border-border/80 bg-card/95 hover:border-border"
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

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={cn("rounded-full border px-2 py-1 font-semibold", priorityBadge(priority))}>
            {priority}
          </span>
          <span className="rounded-full border border-border/70 bg-background/85 px-2 py-1 text-muted-foreground">
            {assignmentLabel}
          </span>
          <span className="rounded-full border border-border/70 bg-background/85 px-2 py-1 text-muted-foreground">
            {booking.location.addressLine ? "Address mapped" : "Needs address"}
          </span>
          <span
            className={cn(
              "rounded-full border px-2 py-1",
              booking.checklist.complete
                ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/35 dark:text-emerald-300"
                : "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700/60 dark:bg-rose-950/35 dark:text-rose-300"
            )}
          >
            {checklistLabel}
          </span>
        </div>

        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em]">Service</p>
            <p className="mt-1 font-medium text-foreground">{booking.serviceType ?? "Standard"}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em]">Amount</p>
            <p className="mt-1 font-medium text-foreground">{formatCurrency(booking.amount)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em]">Window</p>
            <p className="mt-1 font-medium text-foreground">
              {booking.serviceWindowStart && booking.serviceWindowEnd
                ? `${booking.serviceWindowStart} - ${booking.serviceWindowEnd}`
                : "Not set"}
            </p>
          </div>
        </div>

        <p className="mt-3 truncate text-xs text-muted-foreground">
          {booking.location.addressLine || "No address on file"}
        </p>

        {checklistBlocked ? (
          <p className="mt-2 rounded-lg bg-rose-100/80 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-950/35 dark:text-rose-300">
            Clock-out is blocked until checklist completion.
          </p>
        ) : null}
      </button>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Priority</p>
          <Select
            value={priority}
            onValueChange={(value) => {
              if (!value) return;
              setPriority(value as DispatchPriority);
            }}
          >
            <SelectTrigger className="h-8 bg-background">
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
          <p className="mb-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Duration (min)
          </p>
          <Input
            type="number"
            min={30}
            step={15}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className="h-8 bg-background"
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Window start
          </p>
          <Input
            type="time"
            value={windowStart}
            onChange={(event) => setWindowStart(event.target.value)}
            className="h-8 bg-background"
          />
        </div>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Window end
          </p>
          <Input
            type="time"
            value={windowEnd}
            onChange={(event) => setWindowEnd(event.target.value)}
            className="h-8 bg-background"
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
          {saving ? "Saving..." : "Save plan"}
        </Button>
        <AssignCleanerSheet
          bookingId={booking._id}
          onAssigned={onAssigned}
          trigger={
            <Button size="sm" variant="outline">
              Assign cleaner
            </Button>
          }
        />
        <Button size="sm" variant="ghost" onClick={onOpenDetails}>
          Open details
        </Button>
      </div>
    </article>
  );
}
