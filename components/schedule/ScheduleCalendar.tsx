"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { format, startOfMonth, endOfMonth, subDays, addDays } from "date-fns";
import CalendarMonth from "./CalendarMonth";
import ScheduleFilters from "./ScheduleFilters";
import DayDetailSheet from "./DayDetailSheet";

type Filters = {
  status?: string;
  cleanerId?: Id<"cleaners">;
};

export default function ScheduleCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  // Calculate date range for query (current month with buffer)
  const dateRange = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return {
      startDate: format(subDays(monthStart, 7), "yyyy-MM-dd"),
      endDate: format(addDays(monthEnd, 7), "yyyy-MM-dd"),
    };
  }, [currentMonth]);

  // Fetch bookings for the date range
  const bookings = useQuery(api.schedule.getBookingsByDateRange, {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    status: filters.status,
    cleanerId: filters.cleanerId,
  });

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSheetOpen(true);
  };

  const handleMonthChange = (date: Date) => {
    setCurrentMonth(date);
  };

  const handleFiltersChange = (newFilters: Filters) => {
    setFilters(newFilters);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ScheduleFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />
        {bookings && (
          <p className="text-sm text-muted-foreground">
            {bookings.length} booking{bookings.length !== 1 ? "s" : ""} in view
          </p>
        )}
      </div>

      {/* Loading state */}
      {!bookings && (
        <div className="surface-card p-8 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading schedule...</p>
        </div>
      )}

      {/* Calendar */}
      {bookings && (
        <CalendarMonth
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          bookings={bookings}
          onMonthChange={handleMonthChange}
          onDateSelect={handleDateSelect}
        />
      )}

      {/* Day Detail Sheet */}
      <DayDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedDate={selectedDate}
        bookings={bookings ?? []}
      />
    </div>
  );
}
