"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Id } from "@clean-os/convex/data-model";
import QuoteKanbanCard from "./QuoteKanbanCard";

export type ColumnConfig = {
  id: string;
  title: string;
  color: string;
};

type QuoteKanbanColumnProps = {
  config: ColumnConfig;
  quotes: {
    _id: Id<"quoteRequests">;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    requestStatus: string;
    quoteStatus?: string | null;
    serviceType?: string | null;
    frequency?: string | null;
    squareFootage?: number | null;
    sentAt?: number | null;
    expiresAt?: number | null;
    hoursUntilExpiry?: number | null;
    urgencyLevel?: "normal" | "warning" | "critical" | "expired";
    createdAt: number;
  }[];
};

export default function QuoteKanbanColumn({
  config,
  quotes,
}: QuoteKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: config.id });

  return (
    <div className={`min-w-[300px] flex-1 rounded-lg border-t-4 ${config.color} bg-muted/30`}>
      <div className="flex items-center gap-2 px-3 py-3">
        <h3 className="text-sm font-semibold text-foreground">{config.title}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {quotes.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`min-h-[200px] space-y-2 px-2 pb-3 overflow-y-auto transition-colors ${
          isOver ? "bg-muted/60 rounded-b-lg" : ""
        }`}
      >
        <SortableContext
          items={quotes.map((q) => q._id)}
          strategy={verticalListSortingStrategy}
        >
          {quotes.map((quote) => (
            <QuoteKanbanCard key={quote._id} quote={quote} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
