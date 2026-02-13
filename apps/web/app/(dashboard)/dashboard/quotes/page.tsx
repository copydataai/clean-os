"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import StatusBadge from "@/components/dashboard/StatusBadge";
import QuoteKanbanBoard, { type QuoteBoardRow } from "@/components/quotes/QuoteKanbanBoard";
import type { QuoteActionState } from "@/components/quotes/QuoteKanbanCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatDeliveryContext,
  getAttentionBadgeClass,
  getAttentionLabel,
  getQuoteAttentionLevel,
  matchesAttentionFilter,
  rankAttention,
  type AttentionLevel,
  type QuoteAttentionFilter,
} from "@/lib/commsAttention";
import { cn } from "@/lib/utils";

const ATTENTION_PREVIEW_LIMIT = 6;

const quoteAttentionFilters: Array<{
  value: QuoteAttentionFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "needs_attention", label: "Needs attention" },
  { value: "email_failed", label: "Email failed" },
  { value: "delivery_delayed", label: "Delayed" },
  { value: "undelivered_60m", label: "Undelivered 60m" },
  { value: "expiring_24h", label: "Expiring < 24h" },
];

type EnrichedQuoteRow = QuoteBoardRow & {
  attentionLevel: AttentionLevel;
  deliveryContext: string;
  canSendReminder: boolean;
  canResendQuote: boolean;
  reminderState: QuoteActionState;
  resendState: QuoteActionState;
};

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something went wrong. Please try again.";
}

function isSendReminderEligible(quote: QuoteBoardRow): boolean {
  return quote.quoteStatus === "sent";
}

function isResendEligible(quote: QuoteBoardRow): boolean {
  return (
    quote.quoteStatus === "send_failed" ||
    quote.latestEmailDelivery?.status === "failed"
  );
}

function sortQuoteRows(rows: QuoteBoardRow[]): QuoteBoardRow[] {
  return [...rows].sort((a, b) => {
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
}

function sortAttentionRows(rows: EnrichedQuoteRow[]): EnrichedQuoteRow[] {
  return [...rows].sort((a, b) => {
    const rankDelta = rankAttention(b.attentionLevel) - rankAttention(a.attentionLevel);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    const aUrgency = typeof a.expiresAt === "number" ? a.expiresAt : Number.MAX_SAFE_INTEGER;
    const bUrgency = typeof b.expiresAt === "number" ? b.expiresAt : Number.MAX_SAFE_INTEGER;
    if (aUrgency !== bUrgency) {
      return aUrgency - bUrgency;
    }

    return b.createdAt - a.createdAt;
  });
}

function FeedbackBanner({
  feedback,
}: {
  feedback: { type: "success" | "error"; message: string };
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 text-sm",
        feedback.type === "success"
          ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          : "border-red-200 bg-red-50/70 text-red-900 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-200"
      )}
    >
      {feedback.message}
    </div>
  );
}

function QuoteListRow({
  quote,
  onSendReminder,
  onResendQuote,
}: {
  quote: EnrichedQuoteRow;
  onSendReminder: (quoteRequestId: Id<"quoteRequests">) => void;
  onResendQuote: (quoteRequestId: Id<"quoteRequests">) => void;
}) {
  const requestBusy = quote.reminderState === "sending" || quote.resendState === "sending";

  return (
    <div key={quote._id} className="surface-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-foreground">
            {quote.firstName || quote.lastName
              ? `${quote.firstName ?? ""} ${quote.lastName ?? ""}`.trim()
              : quote.email ?? "New Quote"}
          </p>
          <p className="text-sm text-muted-foreground">{quote.email ?? "No email"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Submitted {formatDate(quote.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge status={quote.requestStatus} />
          {quote.quoteStatus === "expired" || quote.quoteStatus === "send_failed" ? (
            <StatusBadge status={quote.quoteStatus} />
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
              />
            </span>
          ) : null}
          {quote.attentionLevel !== "none" ? (
            <Badge
              variant="outline"
              className={cn("text-[10px] font-medium", getAttentionBadgeClass(quote.attentionLevel))}
            >
              {getAttentionLabel(quote.attentionLevel)}
            </Badge>
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

      <p className="mt-2 text-xs text-muted-foreground">{quote.deliveryContext}</p>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>Service: {quote.service ?? "—"}</span>
        <span>Type: {quote.serviceType ?? "—"}</span>
        <span>Frequency: {quote.frequency ?? "—"}</span>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">
        Address: {quote.address ?? "—"} {quote.addressLine2 ?? ""}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Button
          size="xs"
          variant="outline"
          disabled={!quote.canSendReminder || requestBusy}
          onClick={() => onSendReminder(quote._id)}
        >
          {actionLabel("Send reminder", quote.reminderState)}
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={!quote.canResendQuote || requestBusy}
          onClick={() => onResendQuote(quote._id)}
        >
          {actionLabel("Resend quote", quote.resendState)}
        </Button>
        <Link href={`/dashboard/quotes/${quote._id}`}>
          <Button size="xs" variant="outline">
            Open quote
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function QuotesPage() {
  const quotes = useQuery(api.quotes.listQuoteBoard, { limit: 50 });
  const funnel = useQuery(api.quotes.getQuoteFunnelMetrics, { days: 30 });
  const sendRevision = useAction(api.quotes.sendRevision);
  const sendManualReminder = useAction(api.quotes.sendManualReminder);

  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [attentionFilter, setAttentionFilter] = useState<QuoteAttentionFilter>("all");
  const [quoteActionStateById, setQuoteActionStateById] = useState<
    Record<string, { reminder: QuoteActionState; resend: QuoteActionState }>
  >({});
  const [quoteFeedback, setQuoteFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  useEffect(() => {
    if (!quoteFeedback) {
      return;
    }

    const timeout = window.setTimeout(() => setQuoteFeedback(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [quoteFeedback]);

  function readActionState(quoteRequestId: string | null | undefined) {
    if (!quoteRequestId) {
      return { reminder: "idle", resend: "idle" } as const;
    }

    return quoteActionStateById[quoteRequestId] ?? { reminder: "idle", resend: "idle" };
  }

  function setActionState(
    quoteRequestId: string,
    channel: "reminder" | "resend",
    state: QuoteActionState
  ) {
    setQuoteActionStateById((previous) => {
      const existing = previous[quoteRequestId] ?? { reminder: "idle", resend: "idle" };
      return {
        ...previous,
        [quoteRequestId]: {
          ...existing,
          [channel]: state,
        },
      };
    });
  }

  function resetActionStateLater(
    quoteRequestId: string,
    channel: "reminder" | "resend",
    delayMs = 2200
  ) {
    window.setTimeout(() => {
      setActionState(quoteRequestId, channel, "idle");
    }, delayMs);
  }

  const nowMs = Date.now();
  const sortedBaseQuotes = useMemo(() => {
    if (!quotes) {
      return [];
    }

    return sortQuoteRows(quotes as QuoteBoardRow[]);
  }, [quotes]);

  const enrichedQuotes = useMemo<EnrichedQuoteRow[]>(() => {
    return sortedBaseQuotes.map((quote) => {
      const actionState = readActionState(quote._id);
      const attentionLevel = getQuoteAttentionLevel(quote, nowMs);

      return {
        ...quote,
        attentionLevel,
        deliveryContext: formatDeliveryContext(quote.latestEmailDelivery, quote.sentAt, nowMs),
        canSendReminder: isSendReminderEligible(quote),
        canResendQuote: isResendEligible(quote),
        reminderState: actionState.reminder,
        resendState: actionState.resend,
      };
    });
  }, [nowMs, sortedBaseQuotes, quoteActionStateById]);

  const quoteById = useMemo(() => {
    const map = new Map<string, EnrichedQuoteRow>();
    for (const quote of enrichedQuotes) {
      map.set(quote._id, quote);
    }
    return map;
  }, [enrichedQuotes]);

  const filteredQuotes = useMemo(() => {
    return enrichedQuotes.filter((quote) => matchesAttentionFilter(quote, attentionFilter, nowMs));
  }, [attentionFilter, enrichedQuotes, nowMs]);

  const attentionQuotes = useMemo(() => {
    return sortAttentionRows(filteredQuotes.filter((quote) => quote.attentionLevel !== "none"));
  }, [filteredQuotes]);

  const attentionPreviewQuotes = attentionQuotes.slice(0, ATTENTION_PREVIEW_LIMIT);
  const attentionPreviewIds = new Set(attentionPreviewQuotes.map((quote) => quote._id));

  const normalQuotes = useMemo(() => {
    if (attentionFilter === "all") {
      return filteredQuotes.filter((quote) => quote.attentionLevel === "none");
    }

    return filteredQuotes.filter((quote) => !attentionPreviewIds.has(quote._id));
  }, [attentionFilter, attentionPreviewIds, filteredQuotes]);

  async function onSendReminder(quoteRequestId: Id<"quoteRequests">) {
    const quote = quoteById.get(quoteRequestId);
    if (!quote || !quote.canSendReminder) {
      return;
    }

    setActionState(quoteRequestId, "reminder", "sending");
    try {
      const result = await sendManualReminder({ quoteRequestId });
      if (result.status === "sent") {
        setActionState(quoteRequestId, "reminder", "sent");
        setQuoteFeedback({ type: "success", message: "Manual reminder sent." });
      } else {
        setActionState(quoteRequestId, "reminder", "error");
        setQuoteFeedback({
          type: "error",
          message: `Reminder was ${result.status.replace(/_/g, " ")}.`,
        });
      }
      resetActionStateLater(quoteRequestId, "reminder", result.status === "sent" ? 2200 : 2600);
    } catch (error) {
      setActionState(quoteRequestId, "reminder", "error");
      setQuoteFeedback({ type: "error", message: getErrorMessage(error) });
      resetActionStateLater(quoteRequestId, "reminder", 2600);
    }
  }

  async function onResendQuote(quoteRequestId: Id<"quoteRequests">) {
    const quote = quoteById.get(quoteRequestId);
    if (!quote || !quote.canResendQuote) {
      return;
    }

    setActionState(quoteRequestId, "resend", "sending");
    try {
      await sendRevision({ quoteRequestId });
      setActionState(quoteRequestId, "resend", "sent");
      setQuoteFeedback({ type: "success", message: "Quote resend initiated." });
      resetActionStateLater(quoteRequestId, "resend", 2200);
    } catch (error) {
      setActionState(quoteRequestId, "resend", "error");
      setQuoteFeedback({ type: "error", message: getErrorMessage(error) });
      resetActionStateLater(quoteRequestId, "resend", 2600);
    }
  }

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
        subtitle="Incoming quote requests from your configured Tally request form."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/quotes/pricing">
            <Button variant="outline" size="sm">
              Pricing rules
            </Button>
          </Link>
          <Link href="/dashboard/settings/profile">
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

      <div className="surface-card rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {quoteAttentionFilters.map((filter) => (
            <Button
              key={filter.value}
              size="xs"
              variant={attentionFilter === filter.value ? "secondary" : "outline"}
              onClick={() => setAttentionFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {quoteFeedback ? <FeedbackBanner feedback={quoteFeedback} /> : null}

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

      <section className="surface-card overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Needs Attention</h2>
          <Badge variant="outline" className="text-[10px] font-medium">
            {attentionQuotes.length}
          </Badge>
        </div>
        <div className="border-t border-border/60 p-4">
          {attentionQuotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              No quotes currently need communication attention.
            </div>
          ) : (
            <div className="space-y-3">
              {attentionQuotes.length > ATTENTION_PREVIEW_LIMIT ? (
                <p className="text-xs text-muted-foreground">
                  Showing top {ATTENTION_PREVIEW_LIMIT} of {attentionQuotes.length} attention quotes.
                </p>
              ) : null}
              {attentionPreviewQuotes.map((quote) => (
                <QuoteListRow
                  key={`attention:${quote._id}`}
                  quote={quote}
                  onSendReminder={onSendReminder}
                  onResendQuote={onResendQuote}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {normalQuotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
          {attentionFilter === "all"
            ? "No additional quotes outside the attention queue."
            : "No additional quotes match this quick filter."}
        </div>
      ) : view === "kanban" ? (
        <QuoteKanbanBoard
          quotes={normalQuotes}
          onSendReminder={onSendReminder}
          onResendQuote={onResendQuote}
        />
      ) : (
        <div className="grid gap-4">
          {normalQuotes.map((quote) => (
            <QuoteListRow
              key={`normal:${quote._id}`}
              quote={quote}
              onSendReminder={onSendReminder}
              onResendQuote={onResendQuote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
