"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMutation } from "convex/react";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import QuoteKanbanColumn, { ColumnConfig } from "./QuoteKanbanColumn";
import QuoteKanbanCard from "./QuoteKanbanCard";

const COLUMNS: ColumnConfig[] = [
  { id: "requested", title: "Requested", color: "border-t-amber-500" },
  { id: "quoted", title: "Quoted", color: "border-t-purple-500" },
  { id: "confirmed", title: "Confirmed", color: "border-t-green-500" },
];

type RequestStatus = "requested" | "quoted" | "confirmed";
const STATUS_SET = new Set<string>(["requested", "quoted", "confirmed"]);

type QuoteKanbanBoardProps = {
  quotes: Doc<"quoteRequests">[];
};

export default function QuoteKanbanBoard({ quotes }: QuoteKanbanBoardProps) {
  const updateStatus = useMutation(api.quoteRequests.updateRequestStatus);
  const [activeId, setActiveId] = useState<Id<"quoteRequests"> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const buckets = useMemo(() => {
    const map: Record<RequestStatus, Doc<"quoteRequests">[]> = {
      requested: [],
      quoted: [],
      confirmed: [],
    };
    for (const q of quotes) {
      const status = q.requestStatus as RequestStatus;
      if (map[status]) {
        map[status].push(q);
      } else {
        map.requested.push(q);
      }
    }
    return map;
  }, [quotes]);

  const activeQuote = useMemo(
    () => (activeId ? quotes.find((q) => q._id === activeId) ?? null : null),
    [activeId, quotes]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as Id<"quoteRequests">);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const quoteId = active.id as Id<"quoteRequests">;
    const quote = quotes.find((q) => q._id === quoteId);
    if (!quote) return;

    // Determine target status: over.id could be a column ID or another card ID
    let targetStatus: string;
    if (STATUS_SET.has(over.id as string)) {
      targetStatus = over.id as string;
    } else {
      // It's a card ID — find which bucket that card is in
      const targetQuote = quotes.find((q) => q._id === over.id);
      targetStatus = targetQuote?.requestStatus ?? quote.requestStatus;
    }

    if (targetStatus !== quote.requestStatus) {
      updateStatus({
        quoteRequestId: quoteId,
        requestStatus: targetStatus as RequestStatus,
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <QuoteKanbanColumn
            key={col.id}
            config={col}
            quotes={buckets[col.id as RequestStatus]}
          />
        ))}
      </div>

      <DragOverlay>
        {activeQuote ? <QuoteKanbanCard quote={activeQuote} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
