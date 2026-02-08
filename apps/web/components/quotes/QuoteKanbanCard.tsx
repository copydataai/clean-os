"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Id } from "@clean-os/convex/data-model";
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
    sentAt?: number | null;
    expiresAt?: number | null;
    hoursUntilExpiry?: number | null;
    urgencyLevel?: "normal" | "warning" | "critical" | "expired";
    createdAt: number;
  };
};

function urgencyLabel(quote: QuoteKanbanCardProps["quote"]): string | null {
  if (quote.urgencyLevel === "expired") {
    return "Expired";
  }
  if (quote.urgencyLevel === "critical") {
    return quote.hoursUntilExpiry !== null && quote.hoursUntilExpiry !== undefined
      ? `Critical · Expires in ${quote.hoursUntilExpiry}h`
      : "Critical";
  }
  if (quote.urgencyLevel === "warning") {
    if (quote.hoursUntilExpiry !== null && quote.hoursUntilExpiry !== undefined) {
      const days = Math.max(1, Math.ceil(quote.hoursUntilExpiry / 24));
      return `Warning · Expires in ${days}d`;
    }
    return "Warning";
  }
  return null;
}

function urgencyClass(urgencyLevel?: QuoteKanbanCardProps["quote"]["urgencyLevel"]): string {
  if (urgencyLevel === "expired") {
    return "bg-rose-100 text-rose-700";
  }
  if (urgencyLevel === "critical") {
    return "bg-red-100 text-red-700";
  }
  if (urgencyLevel === "warning") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

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
  const urgency = urgencyLabel(quote);

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
      {urgency ? (
        <p className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${urgencyClass(quote.urgencyLevel)}`}>
          {urgency}
        </p>
      ) : null}

      <p className="mt-2 text-[11px] text-muted-foreground">
        {timeAgo(quote.createdAt)}
      </p>
    </div>
  );
}
