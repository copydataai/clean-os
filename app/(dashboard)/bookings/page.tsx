"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import PageHeader from "@/components/dashboard/PageHeader";
import StatusBadge from "@/components/dashboard/StatusBadge";
import EmptyState from "@/components/dashboard/EmptyState";
import AssignCleanerSheet from "@/components/cleaners/AssignCleanerSheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatCurrency(cents?: number | null) {
  if (!cents) {
    return "—";
  }
  return `$${(cents / 100).toLocaleString()}`;
}

type BookingCardProps = {
  booking: {
    _id: Id<"bookings">;
    customerName?: string | null;
    email: string;
    status: string;
    amount?: number | null;
    serviceDate?: string | null;
    serviceType?: string | null;
  };
  isBusy: boolean;
  onMarkCompleted: () => Promise<void>;
  onCharge: () => Promise<void>;
};

function BookingCard({
  booking,
  isBusy,
  onMarkCompleted,
  onCharge,
}: BookingCardProps) {
  const assignments = useQuery(api.cleaners.getBookingAssignments, {
    bookingId: booking._id,
  });

  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-[#1A1A1A]">
            {booking.customerName ?? booking.email}
          </p>
          <p className="text-sm text-[#666666]">{booking.email}</p>
          <p className="mt-1 text-xs text-[#999999]">
            Booking ID: {booking._id}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={booking.status} />
          <span className="text-sm font-semibold text-[#1A1A1A]">
            {formatCurrency(booking.amount)}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#666666]">
        <span>Service date: {booking.serviceDate ?? "TBD"}</span>
        <span>Service type: {booking.serviceType ?? "Standard"}</span>
      </div>

      {/* Assigned Cleaners */}
      {assignments && assignments.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs uppercase text-[#999999] mb-2">
            Assigned Cleaners
          </p>
          <div className="flex flex-wrap gap-2">
            {assignments.map((assignment) => (
              <div
                key={assignment._id}
                className="flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-1.5"
              >
                {assignment.cleaner ? (
                  <>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1A1A1A] text-[10px] font-medium text-white">
                      {assignment.cleaner.firstName.charAt(0)}
                      {assignment.cleaner.lastName.charAt(0)}
                    </div>
                    <span className="text-sm text-[#1A1A1A]">
                      {assignment.cleaner.firstName}{" "}
                      {assignment.cleaner.lastName}
                    </span>
                  </>
                ) : assignment.crew ? (
                  <span className="text-sm text-[#1A1A1A]">
                    {assignment.crew.name}
                  </span>
                ) : null}
                <Badge className="bg-[#F5F5F5] text-[#555555] text-xs">
                  {assignment.role}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={
            isBusy ||
            booking.status === "completed" ||
            booking.status === "charged"
          }
          onClick={onMarkCompleted}
        >
          Mark completed
        </Button>
        <Button
          size="sm"
          disabled={isBusy || !booking.amount}
          onClick={onCharge}
        >
          Charge now
        </Button>
        <AssignCleanerSheet bookingId={booking._id} />
      </div>
    </div>
  );
}

export default function BookingsPage() {
  const bookings = useQuery(api.bookings.listBookings, { limit: 50 });
  const markCompleted = useMutation(api.bookings.markJobCompleted);
  const chargeJob = useAction(api.bookings.chargeCompletedJob);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!bookings) {
    return (
      <div className="rounded-2xl border border-[#E5E5E5] bg-white p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1A1A1A] border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-[#666666]">Loading bookings...</p>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        title="No bookings yet"
        description="Bookings linked to requests will appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        subtitle="Track booking progress and take quick actions."
      />

      <div className="grid gap-4">
        {bookings.map((booking) => {
          const isBusy = busyId === booking._id;
          return (
            <BookingCard
              key={booking._id}
              booking={booking}
              isBusy={isBusy}
              onMarkCompleted={async () => {
                setBusyId(booking._id);
                try {
                  await markCompleted({ bookingId: booking._id });
                } finally {
                  setBusyId(null);
                }
              }}
              onCharge={async () => {
                if (!booking.amount) return;
                setBusyId(booking._id);
                try {
                  await chargeJob({
                    bookingId: booking._id,
                    amount: booking.amount,
                    description: booking.serviceType ?? "Cleaning service",
                  });
                } finally {
                  setBusyId(null);
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
