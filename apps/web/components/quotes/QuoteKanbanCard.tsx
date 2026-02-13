"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Id } from "@clean-os/convex/data-model";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAttentionBadgeClass,
  getAttentionLabel,
  type AttentionLevel,
} from "@/lib/commsAttention";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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

function actionLabel(base: string, state: QuoteActionState) {
  if (state === "sending") {
    return "Sending...";
  }

  if (state === "sent") {
    return "Sent";
  }

  if (state === "error") {
    return "Failed";
  }

  return base;
}

export type QuoteActionState = "idle" | "sending" | "sent" | "error";

export type QuoteKanbanCardRow = {
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
  latestEmailDelivery?: {
    status:
      | "queued"
      | "sent"
      | "delivered"
      | "delivery_delayed"
      | "failed"
      | "skipped";
    errorMessage?: string;
  } | null;
  createdAt: number;
};

type QuoteKanbanCardProps = {
  quote: QuoteKanbanCardRow;
  reminderState?: QuoteActionState;
  resendState?: QuoteActionState;
  canSendReminder?: boolean;
  canResendQuote?: boolean;
  deliveryContext?: string;
  attentionLevel?: AttentionLevel;
  onSendReminder?: (quoteRequestId: Id<"quoteRequests">) => void;
  onResendQuote?: (quoteRequestId: Id<"quoteRequests">) => void;
  showActions?: boolean;
  showDragHandle?: boolean;
  disableNavigation?: boolean;
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

export default function QuoteKanbanCard({
  quote,
  reminderState = "idle",
  resendState = "idle",
  canSendReminder = false,
  canResendQuote = false,
  deliveryContext,
  attentionLevel = "none",
  onSendReminder,
  onResendQuote,
  showActions = true,
  showDragHandle = true,
  disableNavigation = false,
}: QuoteKanbanCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
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
  const requestBusy = reminderState === "sending" || resendState === "sending";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => {
        if (!disableNavigation && !isDragging) {
          router.push(`/dashboard/quotes/${quote._id}`);
        }
      }}
      className={cn("surface-card p-3 cursor-pointer", isDragging ? "opacity-50" : "")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
          <p className="text-[11px] text-muted-foreground truncate">{quote.email ?? "No email"}</p>
        </div>
        <div className="flex items-start gap-1.5 shrink-0">
          {showDragHandle ? (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition hover:bg-muted/60 cursor-grab active:cursor-grabbing"
              aria-label="Drag quote card"
            >
              <span className="text-xs leading-none">::</span>
            </button>
          ) : null}
          <div className="flex flex-wrap justify-end gap-1">
            <StatusBadge status={quote.requestStatus} className="text-[10px]" />
            {quote.quoteStatus === "expired" || quote.quoteStatus === "send_failed" ? (
              <StatusBadge status={quote.quoteStatus} className="text-[10px]" />
            ) : null}
            {quote.latestEmailDelivery ? (
              <span
                title={
                  quote.latestEmailDelivery.status === "failed"
                    ? quote.latestEmailDelivery.errorMessage ?? undefined
                    : undefined
                }
              >
                <StatusBadge
                  status={quote.latestEmailDelivery.status}
                  label={`email ${quote.latestEmailDelivery.status.replace(/_/g, " ")}`}
                  className="text-[10px]"
                />
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {quote.serviceType && <span>{quote.serviceType}</span>}
        {quote.frequency && <span>{quote.frequency}</span>}
        {quote.squareFootage && <span>{quote.squareFootage} sqft</span>}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {attentionLevel !== "none" ? (
          <Badge
            variant="outline"
            className={cn("text-[10px] font-medium", getAttentionBadgeClass(attentionLevel))}
          >
            {getAttentionLabel(attentionLevel)}
          </Badge>
        ) : null}
        {urgency ? (
          <p className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${urgencyClass(quote.urgencyLevel)}`}>
            {urgency}
          </p>
        ) : null}
      </div>

      {deliveryContext ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{deliveryContext}</p>
      ) : null}

      {showActions ? (
        <div className="mt-3 flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
          <Button
            size="xs"
            variant="outline"
            disabled={!canSendReminder || requestBusy}
            onClick={(event) => {
              event.stopPropagation();
              if (!onSendReminder) {
                return;
              }
              onSendReminder(quote._id);
            }}
          >
            {actionLabel("Send reminder", reminderState)}
          </Button>
          <Button
            size="xs"
            variant="outline"
            disabled={!canResendQuote || requestBusy}
            onClick={(event) => {
              event.stopPropagation();
              if (!onResendQuote) {
                return;
              }
              onResendQuote(quote._id);
            }}
          >
            {actionLabel("Resend quote", resendState)}
          </Button>
        </div>
      ) : null}

      <p className="mt-2 text-[11px] text-muted-foreground">{timeAgo(quote.createdAt)}</p>
    </div>
  );
}
