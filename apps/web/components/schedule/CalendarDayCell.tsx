"use client";

import { cn } from "@/lib/utils";

type BookingStatus = string;

type BookingIndicator = {
  id: string;
  status: BookingStatus;
};

type CalendarDayCellProps = {
  date: Date;
  bookings: BookingIndicator[];
  isToday: boolean;
  isSelected: boolean;
  isOutsideMonth: boolean;
  onClick: () => void;
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  in_progress: "bg-cyan-500",
  card_saved: "bg-emerald-500",
  completed: "bg-emerald-500",
  payment_failed: "bg-red-500",
  pending_card: "bg-amber-500",
  pending: "bg-amber-500",
  charged: "bg-slate-500",
  cancelled: "bg-zinc-500",
  failed: "bg-red-500",
};

function getStatusColor(status: string): string {
  return statusColors[status] ?? "bg-gray-400";
}

export default function CalendarDayCell({
  date,
  bookings,
  isToday,
  isSelected,
  isOutsideMonth,
  onClick,
}: CalendarDayCellProps) {
  const dayNumber = date.getDate();
  const maxDots = 4;
  const displayBookings = bookings.slice(0, maxDots);
  const extraCount = bookings.length - maxDots;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex min-h-[92px] w-full flex-col justify-between rounded-xl border p-2 text-left transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isOutsideMonth && "opacity-45",
        isSelected
          ? "border-primary bg-primary text-primary-foreground shadow-[0_12px_30px_-18px_rgba(15,61,143,0.75)]"
          : "border-border/70 bg-background hover:border-primary/45 hover:bg-muted/50",
        isToday && !isSelected && "border-primary/70"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "text-sm font-semibold",
            isSelected ? "text-primary-foreground" : "text-foreground"
          )}
        >
          {dayNumber}
        </span>
        {bookings.length > 0 ? (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              isSelected
                ? "bg-primary-foreground/18 text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {bookings.length}
          </span>
        ) : null}
      </div>

      <div className="space-y-1">
        {bookings.length === 0 ? (
          <p
            className={cn(
              "text-[10px]",
              isSelected ? "text-primary-foreground/75" : "text-muted-foreground"
            )}
          >
            No jobs
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {displayBookings.map((booking) => (
              <span
                key={booking.id}
                className={cn(
                  "h-2 w-2 rounded-full",
                  getStatusColor(booking.status),
                  isSelected && "ring-1 ring-primary-foreground/60"
                )}
              />
            ))}
            {extraCount > 0 ? (
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isSelected ? "text-primary-foreground/85" : "text-muted-foreground"
                )}
              >
                +{extraCount}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {isToday ? (
        <span
          className={cn(
            "pointer-events-none absolute inset-x-2 bottom-1 h-[2px] rounded-full",
            isSelected ? "bg-primary-foreground/85" : "bg-primary"
          )}
        />
      ) : null}
    </button>
  );
}
