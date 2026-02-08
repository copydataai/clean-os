"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const overrideStatuses = [
  "pending_card",
  "card_saved",
  "scheduled",
  "in_progress",
  "completed",
  "payment_failed",
  "charged",
  "cancelled",
] as const;

type OverrideStatusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: LifecycleRow | null;
  submitting: boolean;
  errorMessage?: string | null;
  onConfirm: (values: { toStatus: (typeof overrideStatuses)[number]; reason: string }) => Promise<void>;
};

export default function OverrideStatusDialog({
  open,
  onOpenChange,
  booking,
  submitting,
  errorMessage,
  onConfirm,
}: OverrideStatusDialogProps) {
  const [toStatus, setToStatus] = useState<(typeof overrideStatuses)[number] | "">("");
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const statusOptions = useMemo(
    () => overrideStatuses.filter((status) => status !== booking?.operationalStatus),
    [booking?.operationalStatus]
  );

  useEffect(() => {
    if (!open) {
      setToStatus("");
      setReason("");
      setLocalError(null);
      return;
    }

    setToStatus((statusOptions[0] ?? "") as (typeof overrideStatuses)[number] | "");
    setReason("");
    setLocalError(null);
  }, [open, statusOptions]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Admin override status</AlertDialogTitle>
          <AlertDialogDescription>
            Overrides bypass transition rules and are always audited. Reason is required.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Current status: <strong>{booking?.operationalStatus ?? "unknown"}</strong>
          </p>

          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">New status</p>
            <Select
              value={toStatus || undefined}
              onValueChange={(value) => setToStatus((value as (typeof overrideStatuses)[number]) ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">Reason</p>
            <Textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for override"
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
              if (!toStatus) {
                setLocalError("Select a target status.");
                return;
              }
              if (!trimmedReason) {
                setLocalError("Override reason is required.");
                return;
              }

              setLocalError(null);
              await onConfirm({ toStatus, reason: trimmedReason });
            }}
          >
            {submitting ? "Applying..." : "Apply override"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
