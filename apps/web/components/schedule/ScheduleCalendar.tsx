"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import { addDays, endOfMonth, format, startOfMonth, subDays } from "date-fns";
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

  const dateRange = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return {
      startDate: format(subDays(monthStart, 7), "yyyy-MM-dd"),
      endDate: format(addDays(monthEnd, 7), "yyyy-MM-dd"),
    };
  }, [currentMonth]);

  const bookings = useQuery(api.schedule.getBookingsByDateRange, {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    status: filters.status,
    cleanerId: filters.cleanerId,
  });

  const insights = useMemo(() => {
    if (!bookings) return null;

    const completed = bookings.filter((booking) => booking.status === "completed").length;
    const inProgress = bookings.filter((booking) => booking.status === "in_progress").length;
    const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;

    const countByDate = new Map<string, number>();
    bookings.forEach((booking) => {
      if (!booking.serviceDate) return;
      countByDate.set(booking.serviceDate, (countByDate.get(booking.serviceDate) ?? 0) + 1);
    });

    let busiestDate: string | null = null;
    let busiestCount = 0;
    countByDate.forEach((count, date) => {
      if (count > busiestCount) {
        busiestCount = count;
        busiestDate = date;
      }
    });

    return {
      total: bookings.length,
      completed,
      inProgress,
      cancelled,
      busiestDate,
      busiestCount,
    };
  }, [bookings]);

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
      <section className="surface-card border-border/80 bg-[linear-gradient(145deg,color-mix(in_oklch,var(--card)_90%,white),color-mix(in_oklch,var(--chart-2)_14%,white))] p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Month Planner
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              Plan capacity by date, then jump into same-day assignment details.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Filters apply directly to live Convex schedule data for this calendar range.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Bookings in view</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{insights?.total ?? "-"}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Busiest day</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {insights?.busiestDate ? `${insights.busiestDate} (${insights.busiestCount})` : "No data"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-border/70 pt-4">
          <ScheduleFilters filters={filters} onFiltersChange={handleFiltersChange} />
        </div>
      </section>

      {!bookings ? (
        <div className="surface-card p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading schedule calendar...</p>
        </div>
      ) : (
        <CalendarMonth
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          bookings={bookings}
          onMonthChange={handleMonthChange}
          onDateSelect={handleDateSelect}
        />
      )}

      <DayDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        selectedDate={selectedDate}
        bookings={bookings ?? []}
      />
    </div>
  );
}
