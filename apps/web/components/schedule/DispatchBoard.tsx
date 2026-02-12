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

function hasCoordinates(booking: DispatchDayPayload["bookings"][number]): boolean {
  return (
    typeof booking.location.latitude === "number" &&
    typeof booking.location.longitude === "number"
  );
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

  const dispatchInsights = useMemo(() => {
    if (!dispatchData) return null;

    const bookings = dispatchData.bookings;
    const urgentCount = bookings.filter((booking) => booking.dispatchPriority === "urgent").length;
    const highCount = bookings.filter((booking) => booking.dispatchPriority === "high").length;
    const mappedCount = bookings.filter((booking) => hasCoordinates(booking)).length;
    const missingWindow = bookings.filter(
      (booking) => !booking.serviceWindowStart || !booking.serviceWindowEnd
    ).length;
    const blockedChecklist = bookings.filter(
      (booking) => booking.status === "in_progress" && !booking.checklist.complete
    ).length;
    const bookingsWithDuration = bookings.filter(
      (booking) => typeof booking.estimatedDurationMinutes === "number"
    );
    const averageDuration =
      bookingsWithDuration.length === 0
        ? null
        : Math.round(
            bookingsWithDuration.reduce(
              (total, booking) => total + (booking.estimatedDurationMinutes ?? 0),
              0
            ) / bookingsWithDuration.length
          );

    return {
      urgentCount,
      highCount,
      mappedCount,
      missingWindow,
      blockedChecklist,
      averageDuration,
      assignedRate:
        bookings.length === 0
          ? 0
          : Math.round((dispatchData.totals.assigned / bookings.length) * 100),
    };
  }, [dispatchData]);

  if (!dispatchData || !dispatchInsights) {
    return (
      <div className="surface-card space-y-4 p-6">
        <div className="h-12 w-52 animate-pulse rounded-xl bg-muted/80" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl border border-border/60 bg-muted/70" />
          ))}
        </div>
        <div className="h-[560px] animate-pulse rounded-2xl border border-border/60 bg-muted/60" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="surface-card border-border/80 bg-[linear-gradient(150deg,color-mix(in_oklch,var(--card)_88%,white),color-mix(in_oklch,var(--primary)_10%,white))] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Assignment Health
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {dispatchInsights.assignedRate}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {dispatchData.totals.assigned} assigned / {dispatchData.totals.total} stops
          </p>
        </article>

        <article className="surface-card border-border/80 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Priority Pressure
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {dispatchInsights.urgentCount + dispatchInsights.highCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {dispatchInsights.urgentCount} urgent and {dispatchInsights.highCount} high
          </p>
        </article>

        <article className="surface-card border-border/80 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Route Readiness
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {dispatchInsights.mappedCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            mapped stops, {dispatchData.totals.missingLocation} missing coordinates
          </p>
        </article>

        <article className="surface-card border-border/80 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Service Windows
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {dispatchInsights.missingWindow}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            missing windows, avg duration {dispatchInsights.averageDuration ?? 0} min
          </p>
          {dispatchInsights.blockedChecklist > 0 ? (
            <p className="mt-2 rounded-lg bg-rose-100/80 px-2 py-1 text-[11px] font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {dispatchInsights.blockedChecklist} in-progress jobs blocked by checklist
            </p>
          ) : null}
        </article>
      </section>

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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
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

        <div className="hidden xl:block">
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
          <SheetHeader className="border-b border-border px-4 py-4">
            <SheetTitle>Dispatch map</SheetTitle>
            <SheetDescription>
              Tap any stop to focus it in the queue and open dispatch details.
            </SheetDescription>
          </SheetHeader>
          <div className="h-[calc(100dvh-96px)] p-4">
            <DispatchMap
              bookings={dispatchData.bookings}
              selectedBookingId={selectedBookingId}
              onSelectBooking={(bookingId) => {
                setSelectedBookingId(bookingId);
                setMobileMapOpen(false);
                setDetailsOpen(true);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
