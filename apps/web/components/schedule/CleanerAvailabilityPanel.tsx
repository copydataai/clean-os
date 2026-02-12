"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Doc, Id } from "@clean-os/convex/data-model";
import { Button } from "@/components/ui/button";

type AvailableCleaner = {
  cleaner: Doc<"cleaners">;
  availability: {
    startTime: string;
    endTime: string;
    timezone?: string;
  };
  assignmentCount: number;
};

type CleanerAvailabilityPanelProps = {
  date: string;
  bookingId?: Id<"bookings">;
  onAssigned?: () => void;
};

function workloadLabel(count: number): string {
  if (count >= 5) return "High load";
  if (count >= 3) return "Moderate load";
  if (count >= 1) return "Light load";
  return "Open capacity";
}

function workloadTone(count: number): string {
  if (count >= 5) return "text-rose-700 dark:text-rose-300";
  if (count >= 3) return "text-amber-700 dark:text-amber-300";
  if (count >= 1) return "text-cyan-700 dark:text-cyan-300";
  return "text-emerald-700 dark:text-emerald-300";
}

export default function CleanerAvailabilityPanel({
  date,
  bookingId,
  onAssigned,
}: CleanerAvailabilityPanelProps) {
  const availableCleaners = useQuery(api.schedule.getAvailableCleanersForDate, {
    date,
  });
  const assignMutation = useMutation(api.cleaners.assignToBooking);
  const [assigningId, setAssigningId] = useState<Id<"cleaners"> | null>(null);

  const handleAssign = async (cleanerId: Id<"cleaners">) => {
    if (!bookingId) return;

    setAssigningId(cleanerId);
    try {
      await assignMutation({
        bookingId,
        cleanerId,
        role: "primary",
      });
      onAssigned?.();
    } catch (error) {
      console.error("Failed to assign cleaner:", error);
    } finally {
      setAssigningId(null);
    }
  };

  if (!availableCleaners) {
    return <div className="text-sm text-muted-foreground">Loading cleaner availability...</div>;
  }

  if (availableCleaners.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-background/70 p-4 text-center">
        <p className="text-sm text-muted-foreground">No cleaners available on this date.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Check weekly availability entries and approved time off.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {availableCleaners.map(({ cleaner, availability, assignmentCount }: AvailableCleaner) => (
        <article
          key={cleaner._id}
          className="rounded-xl border border-border/80 bg-[linear-gradient(145deg,color-mix(in_oklch,var(--card)_92%,white),color-mix(in_oklch,var(--primary)_7%,white))] p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {cleaner.firstName} {cleaner.lastName}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {availability.startTime} - {availability.endTime}
                {availability.timezone ? ` (${availability.timezone})` : ""}
              </p>
              <p className={`mt-1 text-xs font-medium ${workloadTone(assignmentCount)}`}>
                {workloadLabel(assignmentCount)} ({assignmentCount} assigned)
              </p>
            </div>

            {bookingId ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAssign(cleaner._id)}
                disabled={assigningId === cleaner._id}
              >
                {assigningId === cleaner._id ? "Assigning..." : "Assign"}
              </Button>
            ) : (
              <span className="text-[11px] text-muted-foreground">Select booking first</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
