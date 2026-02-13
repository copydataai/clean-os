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
import type { AttentionLevel } from "@/lib/commsAttention";
import QuoteKanbanColumn, { ColumnConfig, type QuoteKanbanColumnRow } from "./QuoteKanbanColumn";
import QuoteKanbanCard, {
  type QuoteActionState,
  type QuoteKanbanCardRow,
} from "./QuoteKanbanCard";

const COLUMNS: ColumnConfig[] = [
  { id: "requested", title: "Requested", color: "border-t-amber-500" },
  { id: "quoted", title: "Quoted", color: "border-t-purple-500" },
  { id: "confirmed", title: "Confirmed", color: "border-t-green-500" },
];

export type RequestStatus = "requested" | "quoted" | "confirmed";
const STATUS_SET = new Set<string>(["requested", "quoted", "confirmed"]);

export type QuoteBoardRow = QuoteKanbanCardRow & {
  service?: string | null;
  address?: string | null;
  addressLine2?: string | null;
  boardColumn: RequestStatus;
  attentionLevel?: AttentionLevel;
  deliveryContext?: string;
  canSendReminder?: boolean;
  canResendQuote?: boolean;
  reminderState?: QuoteActionState;
  resendState?: QuoteActionState;
};

type QuoteKanbanBoardProps = {
  quotes: QuoteBoardRow[];
  onSendReminder?: (quoteRequestId: Id<"quoteRequests">) => void;
  onResendQuote?: (quoteRequestId: Id<"quoteRequests">) => void;
};

export default function QuoteKanbanBoard({
  quotes,
  onSendReminder,
  onResendQuote,
}: QuoteKanbanBoardProps) {
  const moveBoardCard = useMutation(api.quotes.moveBoardCard);
  const [activeId, setActiveId] = useState<Id<"quoteRequests"> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const buckets = useMemo(() => {
    const map: Record<RequestStatus, QuoteKanbanColumnRow[]> = {
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

    let targetStatus: string;
    if (STATUS_SET.has(over.id as string)) {
      targetStatus = over.id as string;
    } else {
      const targetQuote = quotes.find((q) => q._id === over.id);
      targetStatus = targetQuote?.boardColumn ?? quote.boardColumn;
    }

    if (targetStatus !== quote.boardColumn) {
      if (targetStatus === "confirmed") return;
      void moveBoardCard({
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
            onSendReminder={onSendReminder}
            onResendQuote={onResendQuote}
          />
        ))}
      </div>

      <DragOverlay>
        {activeQuote ? (
          <div className="w-[320px]">
            <QuoteKanbanCard
              quote={activeQuote}
              attentionLevel={activeQuote.attentionLevel}
              deliveryContext={activeQuote.deliveryContext}
              showActions={false}
              showDragHandle={false}
              disableNavigation
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
