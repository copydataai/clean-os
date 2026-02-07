"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Id } from "@/convex/_generated/dataModel";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { useRouter } from "next/navigation";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type QuoteKanbanCardProps = {
  quote: {
    _id: Id<"quoteRequests">;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    requestStatus: string;
    quoteStatus?: string | null;
    serviceType?: string | null;
    frequency?: string | null;
    squareFootage?: number | null;
    createdAt: number;
  };
};

export default function QuoteKanbanCard({ quote }: QuoteKanbanCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: quote._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayName =
    quote.firstName || quote.lastName
      ? `${quote.firstName ?? ""} ${quote.lastName ?? ""}`.trim()
      : quote.email ?? "Unknown";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) {
          router.push(`/dashboard/quotes/${quote._id}`);
        }
      }}
      className={`surface-card p-3 cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground truncate">
          {displayName}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge status={quote.requestStatus} className="text-[10px]" />
          {quote.quoteStatus === "expired" || quote.quoteStatus === "send_failed" ? (
            <StatusBadge status={quote.quoteStatus} className="text-[10px]" />
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {quote.serviceType && <span>{quote.serviceType}</span>}
        {quote.frequency && <span>{quote.frequency}</span>}
        {quote.squareFootage && <span>{quote.squareFootage} sqft</span>}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {timeAgo(quote.createdAt)}
      </p>
    </div>
  );
}
