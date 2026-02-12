"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { Id } from "@clean-os/convex/data-model";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import BookingCard from "./BookingCard";
import CleanerAvailabilityPanel from "./CleanerAvailabilityPanel";

type Booking = {
  _id: Id<"bookings">;
  customerName?: string | null;
  email: string;
  status: string;
  amount?: number | null;
  serviceType?: string | null;
  serviceDate?: string | null;
};

type DayDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  bookings: Booking[];
};

export default function DayDetailSheet({
  open,
  onOpenChange,
  selectedDate,
  bookings,
}: DayDetailSheetProps) {
  const [selectedBookingId, setSelectedBookingId] = useState<Id<"bookings"> | null>(null);

  const dateString = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;

  useEffect(() => {
    setSelectedBookingId(null);
  }, [dateString]);

  const dayBookings = useMemo(() => {
    if (!dateString) return [];
    return bookings.filter((booking) => booking.serviceDate === dateString);
  }, [bookings, dateString]);

  if (!selectedDate || !dateString) return null;

  const formattedDate = format(selectedDate, "EEEE, MMMM d, yyyy");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle>{formattedDate}</SheetTitle>
          <SheetDescription>
            {dayBookings.length} booking{dayBookings.length !== 1 ? "s" : ""} scheduled.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Bookings
              </h3>
              <span className="text-xs text-muted-foreground">Tap a card to assign</span>
            </div>

            {dayBookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 p-5 text-center">
                <p className="text-sm text-muted-foreground">No bookings for this day.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayBookings.map((booking) => (
                  <button
                    key={booking._id}
                    type="button"
                    className={`w-full rounded-2xl text-left transition ${
                      selectedBookingId === booking._id
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedBookingId(
                        selectedBookingId === booking._id ? null : booking._id
                      )
                    }
                  >
                    <BookingCard booking={booking} compact />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Available cleaners
            </h3>
            <CleanerAvailabilityPanel
              date={dateString}
              bookingId={selectedBookingId ?? undefined}
              onAssigned={() => setSelectedBookingId(null)}
            />
            {!selectedBookingId && dayBookings.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Select a booking card to enable assignment.
              </p>
            ) : null}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
