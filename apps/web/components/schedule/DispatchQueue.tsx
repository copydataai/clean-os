"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Id } from "@clean-os/convex/data-model";
import { DispatchBooking, DispatchPriority } from "./types";
import DispatchBookingCard from "./DispatchBookingCard";

type DispatchQueueProps = {
  bookings: DispatchBooking[];
  selectedBookingId: Id<"bookings"> | null;
  savingBookingId: Id<"bookings"> | null;
  reordering: boolean;
  onSelectBooking: (bookingId: Id<"bookings">) => void;
  onOpenDetails: (bookingId: Id<"bookings">) => void;
  onAssigned: () => void;
  onSaveMeta: (
    bookingId: Id<"bookings">,
    values: {
      serviceWindowStart?: string;
      serviceWindowEnd?: string;
      estimatedDurationMinutes?: number;
      dispatchPriority?: DispatchPriority;
    }
  ) => Promise<void>;
  onReorder: (orderedBookingIds: Id<"bookings">[]) => Promise<void>;
};

type SortableBookingItemProps = {
  booking: DispatchBooking;
  selectedBookingId: Id<"bookings"> | null;
  savingBookingId: Id<"bookings"> | null;
  onSelectBooking: (bookingId: Id<"bookings">) => void;
  onOpenDetails: (bookingId: Id<"bookings">) => void;
  onAssigned: () => void;
  onSaveMeta: DispatchQueueProps["onSaveMeta"];
  onRef: (node: HTMLDivElement | null) => void;
};

function SortableBookingItem({
  booking,
  selectedBookingId,
  savingBookingId,
  onSelectBooking,
  onOpenDetails,
  onAssigned,
  onSaveMeta,
  onRef,
}: SortableBookingItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: booking._id,
  });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        onRef(node);
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? "opacity-70" : ""}
      {...attributes}
      {...listeners}
    >
      <DispatchBookingCard
        booking={booking}
        selected={selectedBookingId === booking._id}
        saving={savingBookingId === booking._id}
        onSelect={() => onSelectBooking(booking._id)}
        onOpenDetails={() => onOpenDetails(booking._id)}
        onAssigned={onAssigned}
        onSaveMeta={(values) => onSaveMeta(booking._id, values)}
      />
    </div>
  );
}

export default function DispatchQueue({
  bookings,
  selectedBookingId,
  savingBookingId,
  reordering,
  onSelectBooking,
  onOpenDetails,
  onAssigned,
  onSaveMeta,
  onReorder,
}: DispatchQueueProps) {
  const [orderedBookings, setOrderedBookings] = useState(bookings);
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setOrderedBookings(bookings);
  }, [bookings]);

  useEffect(() => {
    if (!selectedBookingId) return;
    const target = refs.current.get(selectedBookingId);
    target?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [selectedBookingId]);

  const ids = useMemo(() => orderedBookings.map((booking) => booking._id), [orderedBookings]);

  const queueSummary = useMemo(() => {
    const assigned = orderedBookings.filter((booking) => booking.assignments.assigned > 0).length;
    const priority = orderedBookings.filter(
      (booking) => booking.dispatchPriority === "urgent" || booking.dispatchPriority === "high"
    ).length;
    return {
      assigned,
      unassigned: orderedBookings.length - assigned,
      priority,
    };
  }, [orderedBookings]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedBookings.findIndex((booking) => booking._id === active.id);
    const newIndex = orderedBookings.findIndex((booking) => booking._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(orderedBookings, oldIndex, newIndex);
    setOrderedBookings(next);

    try {
      await onReorder(next.map((booking) => booking._id));
    } catch {
      setOrderedBookings(bookings);
    }
  };

  if (orderedBookings.length === 0) {
    return (
      <div className="surface-card flex min-h-[640px] items-center justify-center border-border/70 bg-[linear-gradient(150deg,color-mix(in_oklch,var(--card)_90%,white),color-mix(in_oklch,var(--muted)_35%,white))] p-6 text-center">
        <div>
          <p className="text-base font-semibold text-foreground">No bookings in this dispatch lane</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Shift the date or filter set to load active stops.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="surface-card min-h-[640px] border-border/80 bg-[linear-gradient(150deg,color-mix(in_oklch,var(--card)_92%,white),color-mix(in_oklch,var(--primary)_6%,white))] p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/80 px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Dispatch queue
          </p>
          <p className="text-sm font-semibold text-foreground">
            {orderedBookings.length} stops, {queueSummary.priority} high-priority
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-border/70 bg-background px-2 py-1 text-muted-foreground">
            Assigned {queueSummary.assigned}
          </span>
          <span className="rounded-full border border-border/70 bg-background px-2 py-1 text-muted-foreground">
            Unassigned {queueSummary.unassigned}
          </span>
          <span className="rounded-full border border-border/70 bg-background px-2 py-1 text-muted-foreground">
            Drag reorder {reordering ? "(saving)" : "(ready)"}
          </span>
        </div>
      </header>

      <div className="h-[560px] space-y-2 overflow-y-auto pr-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {orderedBookings.map((booking) => (
              <SortableBookingItem
                key={booking._id}
                booking={booking}
                selectedBookingId={selectedBookingId}
                savingBookingId={savingBookingId}
                onSelectBooking={onSelectBooking}
                onOpenDetails={onOpenDetails}
                onAssigned={onAssigned}
                onSaveMeta={onSaveMeta}
                onRef={(node) => {
                  if (!node) {
                    refs.current.delete(booking._id);
                    return;
                  }
                  refs.current.set(booking._id, node);
                }}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </section>
  );
}
