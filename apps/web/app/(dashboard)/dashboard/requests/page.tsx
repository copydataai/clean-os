"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import PageHeader from "@/components/dashboard/PageHeader";
import RequestCard from "@/components/dashboard/RequestCard";
import QuickFilters from "@/components/dashboard/QuickFilters";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";

type StatusFilter = "all" | "requested" | "confirmed";

export default function RequestsPage() {
  const requests = useQuery(api.bookingRequests.listRecent, { limit: 50 });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [hasBooking, setHasBooking] = useState(false);
  const [hasCard, setHasCard] = useState(false);

  const filteredRequests = useMemo(() => {
    if (!requests) {
      return [];
    }

    return requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) {
        return false;
      }
      if (hasBooking && !request.bookingId) {
        return false;
      }
      if (hasCard) {
        const bookingStatus = request.bookingStatus ?? "";
        if (!["card_saved", "charged", "completed"].includes(bookingStatus)) {
          return false;
        }
      }
      return true;
    });
  }, [requests, statusFilter, hasBooking, hasCard]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking Requests"
        subtitle="Review incoming cleaning requests and prepare bookings."
      >
        <Button variant="outline" size="sm">
          Export
        </Button>
      </PageHeader>

      <div className="surface-card p-4">
        <QuickFilters
          options={[
            {
              key: "all",
              label: "All",
              active: statusFilter === "all",
              onClick: () => setStatusFilter("all"),
            },
            {
              key: "requested",
              label: "Requested",
              active: statusFilter === "requested",
              onClick: () => setStatusFilter("requested"),
            },
            {
              key: "confirmed",
              label: "Confirmed",
              active: statusFilter === "confirmed",
              onClick: () => setStatusFilter("confirmed"),
            },
            {
              key: "has-booking",
              label: "Has booking",
              active: hasBooking,
              onClick: () => setHasBooking((prev) => !prev),
            },
            {
              key: "has-card",
              label: "Has card",
              active: hasCard,
              onClick: () => setHasCard((prev) => !prev),
            },
          ]}
        />
      </div>

      {!requests ? (
        <div className="surface-card p-8 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          title="No requests match your filters"
          description="Try adjusting the status or booking filters to see more requests."
          action={
            <Button variant="outline" onClick={() => {
              setStatusFilter("all");
              setHasBooking(false);
              setHasCard(false);
            }}>
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((request) => (
            <RequestCard key={request._id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
