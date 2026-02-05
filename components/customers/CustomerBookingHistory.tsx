"use client";

import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";

type Booking = {
  _id: Id<"bookings">;
  serviceType?: string | null;
  serviceDate?: string | null;
  status: string;
  amount?: number | null;
  createdAt: number;
};

type CustomerBookingHistoryProps = {
  bookings: Booking[];
  limit?: number;
};

const statusStyles: Record<string, string> = {
  pending_card: "bg-amber-100 text-amber-700",
  card_saved: "bg-blue-100 text-blue-700",
  scheduled: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  charged: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

function formatDate(dateString?: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString();
}

function formatCurrency(amountCents?: number | null): string {
  if (!amountCents) return "—";
  return `$${(amountCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CustomerBookingHistory({
  bookings,
  limit,
}: CustomerBookingHistoryProps) {
  const displayBookings = limit ? bookings.slice(0, limit) : bookings;

  if (displayBookings.length === 0) {
    return (
      <p className="text-sm text-[#666666]">No booking history yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {displayBookings.map((booking) => (
        <div
          key={booking._id}
          className="flex items-center justify-between rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#1A1A1A]">
                {booking.serviceType ?? "Cleaning"}
              </span>
              <Badge
                className={
                  statusStyles[booking.status] ?? "bg-gray-100 text-gray-700"
                }
              >
                {booking.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-xs text-[#666666]">
              {formatDate(booking.serviceDate)}
            </p>
          </div>
          <span className="text-sm font-medium text-[#1A1A1A]">
            {formatCurrency(booking.amount)}
          </span>
        </div>
      ))}
      {limit && bookings.length > limit && (
        <p className="text-xs text-[#999999]">
          + {bookings.length - limit} more bookings
        </p>
      )}
    </div>
  );
}
