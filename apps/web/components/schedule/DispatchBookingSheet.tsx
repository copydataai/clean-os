"use client";

import StatusBadge from "@/components/dashboard/StatusBadge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import CleanerAvailabilityPanel from "./CleanerAvailabilityPanel";
import { DispatchBooking } from "./types";

type DispatchBookingSheetProps = {
  open: boolean;
  booking: DispatchBooking | null;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
};

function formatCurrency(cents?: number | null): string {
  if (!cents) return "—";
  return `$${(cents / 100).toLocaleString()}`;
}

export default function DispatchBookingSheet({
  open,
  booking,
  onOpenChange,
  onAssigned,
}: DispatchBookingSheetProps) {
  if (!booking) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{booking.customerName ?? booking.email}</SheetTitle>
          <SheetDescription>Dispatch details and assignment tools</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <StatusBadge status={booking.status} />
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(booking.amount)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{booking.serviceType ?? "Standard"}</p>
            <p className="text-sm text-muted-foreground">
              {booking.location.addressLine || "No address available"}
            </p>
          </section>

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Assignment
            </h3>
            {booking.assignments.cleaners.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No cleaner assigned yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {booking.assignments.cleaners.map((cleaner) => (
                  <div
                    key={`${cleaner.cleanerId}-${cleaner.role}`}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <p className="text-sm font-medium text-foreground">{cleaner.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cleaner.role} · {cleaner.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Available Cleaners
            </h3>
            {booking.serviceDate ? (
              <div className="mt-2">
                <CleanerAvailabilityPanel
                  date={booking.serviceDate}
                  bookingId={booking._id}
                  onAssigned={onAssigned}
                />
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Service date is missing, cannot load availability.
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
