"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import StatusBadge from "@/components/dashboard/StatusBadge";
import QuoteKanbanBoard from "@/components/quotes/QuoteKanbanBoard";
import { Button } from "@/components/ui/button";

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDuration(durationMs?: number | null): string {
  if (!durationMs || durationMs <= 0) return "—";
  const hours = Math.round(durationMs / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function urgencyText(quote: {
  urgencyLevel?: "normal" | "warning" | "critical" | "expired";
  hoursUntilExpiry?: number | null;
}): string | null {
  if (quote.urgencyLevel === "expired") return "Expired";
  if (quote.urgencyLevel === "critical") {
    return quote.hoursUntilExpiry ? `Critical · ${quote.hoursUntilExpiry}h left` : "Critical";
  }
  if (quote.urgencyLevel === "warning") {
    const days = quote.hoursUntilExpiry ? Math.max(1, Math.ceil(quote.hoursUntilExpiry / 24)) : null;
    return days ? `Warning · ${days}d left` : "Warning";
  }
  return null;
}

function urgencyClass(urgencyLevel?: "normal" | "warning" | "critical" | "expired"): string {
  if (urgencyLevel === "expired") return "bg-rose-100 text-rose-700";
  if (urgencyLevel === "critical") return "bg-red-100 text-red-700";
  if (urgencyLevel === "warning") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default function QuotesPage() {
  const quotes = useQuery(api.quotes.listQuoteBoard, { limit: 50 });
  const funnel = useQuery(api.quotes.getQuoteFunnelMetrics, { days: 30 });
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const listRows = useMemo(() => {
    if (!quotes) return [];
    return [...quotes].sort((a, b) => {
      if (a.boardColumn === "quoted" && b.boardColumn === "quoted") {
        const aExpires = typeof a.expiresAt === "number" ? a.expiresAt : Number.MAX_SAFE_INTEGER;
        const bExpires = typeof b.expiresAt === "number" ? b.expiresAt : Number.MAX_SAFE_INTEGER;
        if (aExpires !== bExpires) return aExpires - bExpires;
        const aSent = typeof a.sentAt === "number" ? a.sentAt : Number.MAX_SAFE_INTEGER;
        const bSent = typeof b.sentAt === "number" ? b.sentAt : Number.MAX_SAFE_INTEGER;
        if (aSent !== bSent) return aSent - bSent;
      }
      return b.createdAt - a.createdAt;
    });
  }, [quotes]);

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
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/quotes/pricing">
            <Button variant="outline" size="sm">
              Pricing rules
            </Button>
          </Link>
          <Link href="/dashboard/quotes/profile">
            <Button variant="outline" size="sm">
              Profile
            </Button>
          </Link>
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
        </div>
      </PageHeader>

      {funnel ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="surface-card p-4">
            <p className="text-xs text-muted-foreground">Requested (30d)</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{funnel.requestedCount}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-muted-foreground">Quoted (30d)</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{funnel.quotedCount}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-muted-foreground">Confirmed (30d)</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{funnel.confirmedCount}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-muted-foreground">Quote Rate</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatPercent(funnel.quotedRate)}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-muted-foreground">Confirm Rate</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatPercent(funnel.confirmedRate)}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-muted-foreground">Median Quote / Confirm</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatDuration(funnel.medianTimeToQuoteMs)} / {formatDuration(funnel.medianTimeToConfirmMs)}
            </p>
          </div>
        </div>
      ) : null}

      {view === "kanban" ? (
        <QuoteKanbanBoard quotes={quotes} />
      ) : (
        <div className="grid gap-4">
          {listRows.map((quote) => (
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
                  {quote.quoteStatus === "expired" || quote.quoteStatus === "send_failed" ? (
                    <StatusBadge status={quote.quoteStatus} />
                  ) : null}
                  {urgencyText(quote) ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${urgencyClass(quote.urgencyLevel)}`}>
                      {urgencyText(quote)}
                    </span>
                  ) : null}
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
