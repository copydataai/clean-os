"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import StatusBadge from "@/components/dashboard/StatusBadge";
import QuoteKanbanBoard from "@/components/quotes/QuoteKanbanBoard";

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

export default function QuotesPage() {
  const quotes = useQuery(api.quoteRequests.listRecent, { limit: 50 });
  const [view, setView] = useState<"kanban" | "list">("kanban");

  if (!quotes) {
    return (
      <div className="surface-card p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">Loading quotes...</p>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <EmptyState
        title="No quote requests yet"
        description="Quote requests from Tally will appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quote Requests"
        subtitle="Incoming quote requests from the PdOzde form."
      >
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          <button
            onClick={() => setView("kanban")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              view === "kanban"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Board
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            List
          </button>
        </div>
      </PageHeader>

      {view === "kanban" ? (
        <QuoteKanbanBoard quotes={quotes} />
      ) : (
        <div className="grid gap-4">
          {quotes.map((quote) => (
            <div
              key={quote._id}
              className="surface-card p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {quote.firstName || quote.lastName
                      ? `${quote.firstName ?? ""} ${quote.lastName ?? ""}`.trim()
                      : quote.email ?? "New Quote"}
                  </p>
                  <p className="text-sm text-muted-foreground">{quote.email ?? "No email"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {formatDate(quote.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={quote.requestStatus} />
                  <span className="text-xs text-muted-foreground">
                    {quote.squareFootage ? `${quote.squareFootage} sqft` : "Sqft —"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Service: {quote.service ?? "—"}</span>
                <span>Type: {quote.serviceType ?? "—"}</span>
                <span>Frequency: {quote.frequency ?? "—"}</span>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                Address: {quote.address ?? "—"} {quote.addressLine2 ?? ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
