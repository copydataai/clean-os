"use client";

import { Id } from "@/convex/_generated/dataModel";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/utils";

type BookingCardProps = {
  booking: {
    _id: Id<"bookings">;
    customerName?: string | null;
    email: string;
    status: string;
    amount?: number | null;
    serviceType?: string | null;
    serviceDate?: string | null;
  };
  compact?: boolean;
};

function formatCurrency(cents?: number | null) {
  if (!cents) return "—";
  return `$${(cents / 100).toLocaleString()}`;
}

export default function BookingCard({ booking, compact = false }: BookingCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#E5E5E5] bg-white transition-colors hover:border-[#CCCCCC]",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-medium text-[#1A1A1A] truncate",
              compact ? "text-sm" : "text-base"
            )}
          >
            {booking.customerName ?? booking.email}
          </p>
          {!compact && (
            <p className="text-xs text-[#666666] truncate mt-0.5">
              {booking.email}
            </p>
          )}
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 text-[#666666]",
          compact ? "mt-2 text-xs" : "mt-3 text-sm"
        )}
      >
        {booking.serviceType && <span>{booking.serviceType}</span>}
        <span className="font-medium text-[#1A1A1A]">
          {formatCurrency(booking.amount)}
        </span>
      </div>
    </div>
  );
}
