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
  card_saved: "bg-green-500",
  completed: "bg-green-500",
  pending_card: "bg-amber-500",
  pending: "bg-amber-500",
  charged: "bg-purple-500",
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
  const maxDots = 3;
  const displayBookings = bookings.slice(0, maxDots);
  const extraCount = bookings.length - maxDots;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-start p-1 min-h-[72px] w-full rounded-lg transition-colors",
        "hover:bg-[#F0F0F0] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A] focus:ring-offset-1",
        isOutsideMonth && "opacity-40",
        isToday && !isSelected && "bg-[#FAFAFA]",
        isSelected && "bg-[#1A1A1A] text-white hover:bg-[#333333]"
      )}
    >
      <span
        className={cn(
          "text-sm",
          isToday && !isSelected && "font-semibold",
          isSelected && "font-semibold"
        )}
      >
        {dayNumber}
      </span>

      {bookings.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-0.5 mt-1">
          {displayBookings.map((booking) => (
            <span
              key={booking.id}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                getStatusColor(booking.status),
                isSelected && "ring-1 ring-white/50"
              )}
            />
          ))}
          {extraCount > 0 && (
            <span
              className={cn(
                "text-[10px] leading-none",
                isSelected ? "text-white/80" : "text-[#666666]"
              )}
            >
              +{extraCount}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
