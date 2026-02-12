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
  if (!cents) return "-";
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
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle>{booking.customerName ?? booking.email}</SheetTitle>
          <SheetDescription>
            Dispatch details, assignment context, and same-day cleaner availability.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4">
          <section className="rounded-2xl border border-border/70 bg-[linear-gradient(145deg,color-mix(in_oklch,var(--card)_92%,white),color-mix(in_oklch,var(--primary)_8%,white))] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={booking.status} />
              <span className="text-lg font-semibold text-foreground">
                {formatCurrency(booking.amount)}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2">
                <p className="uppercase tracking-[0.15em] text-muted-foreground">Service</p>
                <p className="mt-1 font-medium text-foreground">
                  {booking.serviceType ?? "Standard cleaning"}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2">
                <p className="uppercase tracking-[0.15em] text-muted-foreground">Window</p>
                <p className="mt-1 font-medium text-foreground">
                  {booking.serviceWindowStart && booking.serviceWindowEnd
                    ? `${booking.serviceWindowStart} - ${booking.serviceWindowEnd}`
                    : "Not set"}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 sm:col-span-2">
                <p className="uppercase tracking-[0.15em] text-muted-foreground">Address</p>
                <p className="mt-1 font-medium text-foreground">
                  {booking.location.addressLine || "No address available"}
                </p>
              </div>
            </div>

            <p
              className={`mt-3 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                booking.checklist.complete
                  ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300"
                  : "bg-rose-100/80 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300"
              }`}
            >
              Checklist: {booking.checklist.completed}/{booking.checklist.total}
              {booking.status === "in_progress" && !booking.checklist.complete
                ? " (clock-out blocked)"
                : ""}
            </p>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Current assignment
            </h3>
            {booking.assignments.cleaners.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-border/80 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                No cleaner is assigned yet.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {booking.assignments.cleaners.map((cleaner) => (
                  <div
                    key={`${cleaner.cleanerId}-${cleaner.role}`}
                    className="rounded-xl border border-border/80 bg-card px-3 py-2.5"
                  >
                    <p className="text-sm font-semibold text-foreground">{cleaner.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Role: {cleaner.role} | Status: {cleaner.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Available cleaners
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
              <p className="mt-2 rounded-xl border border-dashed border-border/80 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                Service date is missing, so availability cannot be loaded.
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
