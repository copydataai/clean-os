"use client";

import { format } from "date-fns";
import type { Id } from "@clean-os/convex/data-model";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import BookingCard from "./BookingCard";
import CleanerAvailabilityPanel from "./CleanerAvailabilityPanel";
import { useState } from "react";

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

  if (!selectedDate) return null;

  const dateString = format(selectedDate, "yyyy-MM-dd");
  const dayBookings = bookings.filter((b) => b.serviceDate === dateString);
  const formattedDate = format(selectedDate, "EEEE, MMMM d, yyyy");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{formattedDate}</SheetTitle>
          <SheetDescription>
            {dayBookings.length} booking{dayBookings.length !== 1 ? "s" : ""} scheduled
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Bookings Section */}
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Bookings ({dayBookings.length})
            </h3>

            {dayBookings.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background p-4 text-center">
                <p className="text-sm text-muted-foreground">No bookings for this day</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayBookings.map((booking) => (
                  <button
                    key={booking._id}
                    type="button"
                    className={`w-full text-left rounded-xl transition-all ${
                      selectedBookingId === booking._id
                        ? "ring-2 ring-primary ring-offset-2"
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

          {/* Available Cleaners Section */}
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Available Cleaners
            </h3>
            <CleanerAvailabilityPanel
              date={dateString}
              bookingId={selectedBookingId ?? undefined}
              onAssigned={() => setSelectedBookingId(null)}
            />
            {!selectedBookingId && dayBookings.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Select a booking above to assign a cleaner
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
