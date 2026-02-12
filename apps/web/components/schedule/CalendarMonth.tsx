"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeftIcon, ArrowRightIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import type { Id } from "@clean-os/convex/data-model";
import CalendarDayCell from "./CalendarDayCell";

type Booking = {
  _id: Id<"bookings">;
  status: string;
  serviceDate?: string | null;
};

type CalendarMonthProps = {
  currentMonth: Date;
  selectedDate: Date | null;
  bookings: Booking[];
  onMonthChange: (date: Date) => void;
  onDateSelect: (date: Date) => void;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarMonth({
  currentMonth,
  selectedDate,
  bookings,
  onMonthChange,
  onDateSelect,
}: CalendarMonthProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = new Date();

  const bookingsByDate = new Map<string, Booking[]>();
  for (const booking of bookings) {
    if (!booking.serviceDate) continue;
    const existing = bookingsByDate.get(booking.serviceDate) ?? [];
    existing.push(booking);
    bookingsByDate.set(booking.serviceDate, existing);
  }

  return (
    <section className="surface-card overflow-hidden border-border/80">
      <header className="flex items-center justify-between border-b border-border/70 bg-[linear-gradient(150deg,color-mix(in_oklch,var(--card)_92%,white),color-mix(in_oklch,var(--primary)_7%,white))] px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Calendar
          </p>
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            aria-label="Previous month"
          >
            <HugeiconsIcon icon={ArrowLeftIcon} strokeWidth={2} className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMonthChange(today)}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            aria-label="Next month"
          >
            <HugeiconsIcon icon={ArrowRightIcon} strokeWidth={2} className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="rounded-lg border border-border/60 bg-muted/45 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayBookings = bookingsByDate.get(dateKey) ?? [];

            return (
              <CalendarDayCell
                key={dateKey}
                date={day}
                bookings={dayBookings.map((booking) => ({
                  id: booking._id,
                  status: booking.status,
                }))}
                isToday={isSameDay(day, today)}
                isSelected={selectedDate ? isSameDay(day, selectedDate) : false}
                isOutsideMonth={!isSameMonth(day, currentMonth)}
                onClick={() => onDateSelect(day)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
