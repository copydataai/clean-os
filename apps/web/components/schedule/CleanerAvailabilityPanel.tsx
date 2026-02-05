"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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
  date: string; // ISO date string "YYYY-MM-DD"
  bookingId?: Id<"bookings">;
  onAssigned?: () => void;
};

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
    return (
      <div className="text-sm text-muted-foreground">Loading availability...</div>
    );
  }

  if (availableCleaners.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-4 text-center">
        <p className="text-sm text-muted-foreground">
          No cleaners available on this date
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Check cleaner availability settings or time off requests
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {availableCleaners.map(({ cleaner, availability, assignmentCount }: AvailableCleaner) => (
        <div
          key={cleaner._id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-white">
              {cleaner.firstName.charAt(0)}
              {cleaner.lastName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {cleaner.firstName} {cleaner.lastName}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {availability.startTime} - {availability.endTime}
                </span>
                {assignmentCount > 0 && (
                  <span className="text-muted-foreground">
                    ({assignmentCount} job{assignmentCount !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
            </div>
          </div>

          {bookingId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAssign(cleaner._id)}
              disabled={assigningId === cleaner._id}
            >
              {assigningId === cleaner._id ? "Assigning..." : "Assign"}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
