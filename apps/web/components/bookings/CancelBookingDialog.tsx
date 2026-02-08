"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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

type CancelBookingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: LifecycleRow | null;
  submitting: boolean;
  errorMessage?: string | null;
  onConfirm: (reason: string) => Promise<void>;
};

export default function CancelBookingDialog({
  open,
  onOpenChange,
  booking,
  submitting,
  errorMessage,
  onConfirm,
}: CancelBookingDialogProps) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setLocalError(null);
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel booking</AlertDialogTitle>
          <AlertDialogDescription>
            This will move the booking to <strong>cancelled</strong>. Add a reason for the
            lifecycle audit trail.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {booking?.customerName ?? booking?.email ?? "Selected booking"}
          </p>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for cancellation"
            rows={4}
          />
          {localError ? <p className="text-sm text-red-600">{localError}</p> : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Close</AlertDialogCancel>
          <Button
            disabled={submitting}
            variant="destructive"
            onClick={async () => {
              const trimmedReason = reason.trim();
              if (!trimmedReason) {
                setLocalError("Cancellation reason is required.");
                return;
              }
              setLocalError(null);
              await onConfirm(trimmedReason);
            }}
          >
            {submitting ? "Cancelling..." : "Cancel booking"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
