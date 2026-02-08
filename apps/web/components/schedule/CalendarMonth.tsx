"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
  subMonths,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeftIcon, ArrowRightIcon } from "@hugeicons/core-free-icons";
import CalendarDayCell from "./CalendarDayCell";
import type { Id } from "@clean-os/convex/data-model";

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

  // Group bookings by date
  const bookingsByDate = new Map<string, Booking[]>();
  for (const booking of bookings) {
    if (booking.serviceDate) {
      const existing = bookingsByDate.get(booking.serviceDate) ?? [];
      existing.push(booking);
      bookingsByDate.set(booking.serviceDate, existing);
    }
  }

  return (
    <div className="surface-card p-4">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          aria-label="Previous month"
        >
          <HugeiconsIcon icon={ArrowLeftIcon} strokeWidth={2} className="h-4 w-4" />
        </Button>

        <h2 className="text-lg font-semibold text-foreground">
          {format(currentMonth, "MMMM yyyy")}
        </h2>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          aria-label="Next month"
        >
          <HugeiconsIcon icon={ArrowRightIcon} strokeWidth={2} className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayBookings = bookingsByDate.get(dateKey) ?? [];

          return (
            <CalendarDayCell
              key={dateKey}
              date={day}
              bookings={dayBookings.map((b) => ({
                id: b._id,
                status: b.status,
              }))}
              isToday={isSameDay(day, today)}
              isSelected={selectedDate ? isSameDay(day, selectedDate) : false}
              isOutsideMonth={!isSameMonth(day, currentMonth)}
              onClick={() => onDateSelect(day)}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="text-xs text-muted-foreground">Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-xs text-muted-foreground">Pending</span>
        </div>
      </div>
    </div>
  );
}
