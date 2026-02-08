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
import type { Id } from "@clean-os/convex/data-model";
import { api } from "@clean-os/convex/api";
import QuoteKanbanColumn, { ColumnConfig } from "./QuoteKanbanColumn";
import QuoteKanbanCard from "./QuoteKanbanCard";

const COLUMNS: ColumnConfig[] = [
  { id: "requested", title: "Requested", color: "border-t-amber-500" },
  { id: "quoted", title: "Quoted", color: "border-t-purple-500" },
  { id: "confirmed", title: "Confirmed", color: "border-t-green-500" },
];

type RequestStatus = "requested" | "quoted" | "confirmed";
const STATUS_SET = new Set<string>(["requested", "quoted", "confirmed"]);

type QuoteBoardRow = {
  _id: Id<"quoteRequests">;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  service?: string | null;
  serviceType?: string | null;
  frequency?: string | null;
  squareFootage?: number | null;
  sentAt?: number | null;
  expiresAt?: number | null;
  hoursUntilExpiry?: number | null;
  urgencyLevel?: "normal" | "warning" | "critical" | "expired";
  createdAt: number;
  requestStatus: string;
  boardColumn: RequestStatus;
  quoteStatus?: string | null;
};

type QuoteKanbanBoardProps = {
  quotes: QuoteBoardRow[];
};

export default function QuoteKanbanBoard({ quotes }: QuoteKanbanBoardProps) {
  const moveBoardCard = useMutation(api.quotes.moveBoardCard);
  const [activeId, setActiveId] = useState<Id<"quoteRequests"> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const buckets = useMemo(() => {
    const map: Record<RequestStatus, QuoteBoardRow[]> = {
      requested: [],
      quoted: [],
      confirmed: [],
    };
    for (const q of quotes) {
      const status = q.boardColumn as RequestStatus;
      if (map[status]) {
        map[status].push(q);
      } else {
        map.requested.push(q);
      }
    }
    map.quoted.sort((a, b) => {
      const aExpires = typeof a.expiresAt === "number" ? a.expiresAt : Number.MAX_SAFE_INTEGER;
      const bExpires = typeof b.expiresAt === "number" ? b.expiresAt : Number.MAX_SAFE_INTEGER;
      if (aExpires !== bExpires) return aExpires - bExpires;
      const aSent = typeof a.sentAt === "number" ? a.sentAt : Number.MAX_SAFE_INTEGER;
      const bSent = typeof b.sentAt === "number" ? b.sentAt : Number.MAX_SAFE_INTEGER;
      if (aSent !== bSent) return aSent - bSent;
      return b.createdAt - a.createdAt;
    });
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
    if (quote.boardColumn === "confirmed") return;

    // Determine target status: over.id could be a column ID or another card ID
    let targetStatus: string;
    if (STATUS_SET.has(over.id as string)) {
      targetStatus = over.id as string;
    } else {
      // It's a card ID — find which bucket that card is in
      const targetQuote = quotes.find((q) => q._id === over.id);
      targetStatus = targetQuote?.boardColumn ?? quote.boardColumn;
    }

    if (targetStatus !== quote.boardColumn) {
      if (targetStatus === "confirmed") return;
      moveBoardCard({
        quoteRequestId: quoteId,
        targetColumn: targetStatus as RequestStatus,
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
