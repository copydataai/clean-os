"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import DispatchFilters from "./DispatchFilters";
import DispatchMap from "./DispatchMap";
import DispatchQueue from "./DispatchQueue";
import DispatchBookingSheet from "./DispatchBookingSheet";
import { DispatchDayPayload, DispatchFiltersState, DispatchPriority } from "./types";

const DEFAULT_FILTERS: DispatchFiltersState = {
  assignmentState: "all",
  priority: "all",
};

function todayIsoDate(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export default function DispatchBoard() {
  const [date, setDate] = useState(todayIsoDate);
  const [filters, setFilters] = useState<DispatchFiltersState>(DEFAULT_FILTERS);
  const [selectedBookingId, setSelectedBookingId] = useState<Id<"bookings"> | null>(
    null
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [savingBookingId, setSavingBookingId] = useState<Id<"bookings"> | null>(null);
  const [reordering, setReordering] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const dispatchData = useQuery(api.schedule.getDispatchDay, {
    date,
    status: filters.status,
    cleanerId: filters.cleanerId,
    assignmentState: filters.assignmentState,
    priority: filters.priority,
  }) as DispatchDayPayload | undefined;

  const updateDispatchMeta = useMutation(api.schedule.updateDispatchMeta);
  const reorderDispatch = useMutation(api.schedule.reorderDispatch);
  const backfillDispatchLocations = useAction(api.schedule.backfillDispatchLocations);

  useEffect(() => {
    if (!dispatchData) return;
    if (dispatchData.bookings.length === 0) {
      setSelectedBookingId(null);
      setDetailsOpen(false);
      return;
    }

    if (
      !selectedBookingId ||
      !dispatchData.bookings.some((booking) => booking._id === selectedBookingId)
    ) {
      setSelectedBookingId(dispatchData.bookings[0]._id);
    }
  }, [dispatchData, selectedBookingId]);

  const selectedBooking = useMemo(() => {
    if (!dispatchData || !selectedBookingId) return null;
    return dispatchData.bookings.find((booking) => booking._id === selectedBookingId) ?? null;
  }, [dispatchData, selectedBookingId]);

  if (!dispatchData) {
    return (
      <div className="surface-card p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-3 text-sm text-muted-foreground">Loading dispatch board...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DispatchFilters
        date={date}
        filters={filters}
        cleaners={dispatchData.cleaners}
        totals={dispatchData.totals}
        backfilling={backfilling}
        onDateChange={setDate}
        onFiltersChange={setFilters}
        onBackfillLocations={async () => {
          setBackfilling(true);
          try {
            await backfillDispatchLocations({ limit: 100, dryRun: false });
          } finally {
            setBackfilling(false);
          }
        }}
        onOpenMobileMap={() => setMobileMapOpen(true)}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DispatchQueue
          bookings={dispatchData.bookings}
          selectedBookingId={selectedBookingId}
          savingBookingId={savingBookingId}
          reordering={reordering}
          onSelectBooking={(bookingId) => {
            setSelectedBookingId(bookingId);
            setDetailsOpen(true);
          }}
          onOpenDetails={(bookingId) => {
            setSelectedBookingId(bookingId);
            setDetailsOpen(true);
          }}
          onAssigned={() => {
            setDetailsOpen(false);
          }}
          onSaveMeta={async (
            bookingId,
            values: {
              serviceWindowStart?: string;
              serviceWindowEnd?: string;
              estimatedDurationMinutes?: number;
              dispatchPriority?: DispatchPriority;
            }
          ) => {
            setSavingBookingId(bookingId);
            try {
              await updateDispatchMeta({
                bookingId,
                ...values,
              });
            } finally {
              setSavingBookingId(null);
            }
          }}
          onReorder={async (orderedBookingIds) => {
            setReordering(true);
            try {
              await reorderDispatch({
                date,
                orderedBookingIds,
              });
            } finally {
              setReordering(false);
            }
          }}
        />

        <div className="hidden lg:block">
          <DispatchMap
            bookings={dispatchData.bookings}
            selectedBookingId={selectedBookingId}
            onSelectBooking={setSelectedBookingId}
          />
        </div>
      </div>

      <DispatchBookingSheet
        open={detailsOpen}
        booking={selectedBooking}
        onOpenChange={setDetailsOpen}
        onAssigned={() => {
          setDetailsOpen(false);
        }}
      />

      <Sheet open={mobileMapOpen} onOpenChange={setMobileMapOpen}>
        <SheetContent
          side="bottom"
          className="h-[100dvh] w-full max-w-none overflow-hidden p-0 sm:max-w-none"
          showCloseButton
        >
          <SheetHeader className="border-b border-border">
            <SheetTitle>Dispatch Map</SheetTitle>
            <SheetDescription>Tap a pin to focus a booking in the queue.</SheetDescription>
          </SheetHeader>
          <div className="h-[calc(100dvh-80px)] p-4">
            <DispatchMap
              bookings={dispatchData.bookings}
              selectedBookingId={selectedBookingId}
              onSelectBooking={(bookingId) => {
                setSelectedBookingId(bookingId);
                setMobileMapOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
