"use client";

import type { Id } from "@clean-os/convex/data-model";
import { Badge } from "@/components/ui/badge";

type QuoteRequest = {
  _id: Id<"quoteRequests">;
  serviceType?: string | null;
  frequency?: string | null;
  requestStatus: string;
  squareFootage?: number | null;
  createdAt: number;
};

type CustomerQuoteHistoryProps = {
  quoteRequests: QuoteRequest[];
  limit?: number;
};

const statusStyles: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  quoted: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export default function CustomerQuoteHistory({
  quoteRequests,
  limit,
}: CustomerQuoteHistoryProps) {
  const displayQuotes = limit ? quoteRequests.slice(0, limit) : quoteRequests;

  if (displayQuotes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No quote requests yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {displayQuotes.map((quote) => (
        <div
          key={quote._id}
          className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {quote.serviceType ?? "Cleaning"}{" "}
                {quote.frequency ? `(${quote.frequency})` : ""}
              </span>
              <Badge
                className={
                  statusStyles[quote.requestStatus] ??
                  "bg-gray-100 text-gray-700"
                }
              >
                {quote.requestStatus}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(quote.createdAt)}
              {quote.squareFootage ? ` • ${quote.squareFootage} sq ft` : ""}
            </p>
          </div>
        </div>
      ))}
      {limit && quoteRequests.length > limit && (
        <p className="text-xs text-muted-foreground">
          + {quoteRequests.length - limit} more quotes
        </p>
      )}
    </div>
  );
}
