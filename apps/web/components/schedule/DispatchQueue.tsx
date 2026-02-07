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
import { Id } from "@/convex/_generated/dataModel";
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
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
      className={isDragging ? "opacity-60" : ""}
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
      <div className="surface-card flex h-[620px] items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">No bookings in this dispatch view</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Adjust date or filters to load bookings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card h-[620px] overflow-hidden p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">Dispatch Queue</h3>
        <span className="text-xs text-muted-foreground">
          Drag to reorder {reordering ? "(saving...)" : ""}
        </span>
      </div>

      <div className="h-[560px] overflow-y-auto space-y-2 pr-1">
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
    </div>
  );
}
