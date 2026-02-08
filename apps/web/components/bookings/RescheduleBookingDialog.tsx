"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { LifecycleRow } from "./types";

type RescheduleBookingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: LifecycleRow | null;
  submitting: boolean;
  errorMessage?: string | null;
  onConfirm: (values: {
    newServiceDate: string;
    newWindowStart?: string;
    newWindowEnd?: string;
    reason: string;
  }) => Promise<void>;
};

export default function RescheduleBookingDialog({
  open,
  onOpenChange,
  booking,
  submitting,
  errorMessage,
  onConfirm,
}: RescheduleBookingDialogProps) {
  const [newServiceDate, setNewServiceDate] = useState("");
  const [newWindowStart, setNewWindowStart] = useState("");
  const [newWindowEnd, setNewWindowEnd] = useState("");
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNewServiceDate(booking?.serviceDate ?? "");
      setNewWindowStart("");
      setNewWindowEnd("");
      setReason("");
      setLocalError(null);
      return;
    }

    setLocalError(null);
  }, [booking?.serviceDate, open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Reschedule booking</AlertDialogTitle>
          <AlertDialogDescription>
            This updates service date/window and appends a rescheduled lifecycle event.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {booking?.customerName ?? booking?.email ?? "Selected booking"}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <p className="mb-1 text-xs uppercase text-muted-foreground">Date</p>
              <Input
                type="date"
                value={newServiceDate}
                onChange={(event) => setNewServiceDate(event.target.value)}
              />
            </div>
            <div className="sm:col-span-1">
              <p className="mb-1 text-xs uppercase text-muted-foreground">Window start</p>
              <Input
                type="time"
                value={newWindowStart}
                onChange={(event) => setNewWindowStart(event.target.value)}
              />
            </div>
            <div className="sm:col-span-1">
              <p className="mb-1 text-xs uppercase text-muted-foreground">Window end</p>
              <Input
                type="time"
                value={newWindowEnd}
                onChange={(event) => setNewWindowEnd(event.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">Reason</p>
            <Textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for reschedule"
            />
          </div>

          {localError ? <p className="text-sm text-red-600">{localError}</p> : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Close</AlertDialogCancel>
          <Button
            disabled={submitting}
            onClick={async () => {
              const trimmedReason = reason.trim();
              if (!newServiceDate) {
                setLocalError("New service date is required.");
                return;
              }
              if (!trimmedReason) {
                setLocalError("Reschedule reason is required.");
                return;
              }

              setLocalError(null);
              await onConfirm({
                newServiceDate,
                newWindowStart: newWindowStart || undefined,
                newWindowEnd: newWindowEnd || undefined,
                reason: trimmedReason,
              });
            }}
          >
            {submitting ? "Saving..." : "Save reschedule"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
