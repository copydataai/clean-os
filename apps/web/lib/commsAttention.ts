const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const EMAIL_UNDELIVERED_THRESHOLD_MS = HOUR_MS;
export const QUOTE_EXPIRING_THRESHOLD_MS = DAY_MS;

export type EmailDeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "failed"
  | "skipped";

export type EmailDeliverySnapshot = {
  status: EmailDeliveryStatus;
  updatedAt?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type EmailAttentionLevel = "none" | "failed" | "delayed" | "undelivered_60m";
export type AttentionLevel = EmailAttentionLevel | "expiring_24h";

export type AttentionFilter =
  | "all"
  | "needs_attention"
  | "email_failed"
  | "delivery_delayed"
  | "undelivered_60m"
  | "expiring_24h";

export type OnboardingAttentionFilter = Exclude<AttentionFilter, "expiring_24h">;
export type QuoteAttentionFilter = AttentionFilter;

export type QuoteAttentionInput = {
  quoteStatus?: string | null;
  requestStatus?: string | null;
  latestEmailDelivery?: EmailDeliverySnapshot | null;
  sentAt?: number | null;
  expiresAt?: number | null;
};

export type OnboardingAttentionInput = {
  cardRequestEmailDelivery?: EmailDeliverySnapshot | null;
  confirmationEmailDelivery?: EmailDeliverySnapshot | null;
  cardRequestSentAt?: number | null;
  confirmationSentAt?: number | null;
};

const attentionRanks: Record<AttentionLevel, number> = {
  none: 0,
  expiring_24h: 1,
  undelivered_60m: 2,
  delayed: 3,
  failed: 4,
};

function isQuoteAttentionInput(item: unknown): item is QuoteAttentionInput {
  if (!item || typeof item !== "object") {
    return false;
  }

  return (
    "quoteStatus" in item ||
    "requestStatus" in item ||
    "latestEmailDelivery" in item ||
    "sentAt" in item ||
    "expiresAt" in item
  );
}

function formatElapsed(timestamp: number, nowMs: number): string {
  const delta = Math.max(0, nowMs - timestamp);

  if (delta < 60_000) {
    return "just now";
  }

  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getEmailAttentionLevel(
  delivery: EmailDeliverySnapshot | null | undefined,
  sentAt: number | null | undefined,
  nowMs: number
): EmailAttentionLevel {
  if (!delivery) {
    return "none";
  }

  if (delivery.status === "failed") {
    return "failed";
  }

  if (delivery.status === "delivery_delayed") {
    return "delayed";
  }

  if (delivery.status === "sent") {
    const referenceTimestamp = sentAt ?? delivery.updatedAt ?? null;
    if (
      typeof referenceTimestamp === "number" &&
      nowMs - referenceTimestamp >= EMAIL_UNDELIVERED_THRESHOLD_MS
    ) {
      return "undelivered_60m";
    }
  }

  return "none";
}

export function getQuoteAttentionLevel(quote: QuoteAttentionInput, nowMs: number): AttentionLevel {
  if (quote.quoteStatus === "send_failed") {
    return "failed";
  }

  const emailLevel = getEmailAttentionLevel(
    quote.latestEmailDelivery,
    quote.sentAt,
    nowMs
  );
  if (emailLevel !== "none") {
    return emailLevel;
  }

  const actionableSentFlow = quote.quoteStatus === "sent" || quote.requestStatus === "quoted";
  if (actionableSentFlow && typeof quote.expiresAt === "number") {
    const remaining = quote.expiresAt - nowMs;
    if (remaining > 0 && remaining <= QUOTE_EXPIRING_THRESHOLD_MS) {
      return "expiring_24h";
    }
  }

  return "none";
}

export function getOnboardingAttentionLevel(
  row: OnboardingAttentionInput,
  nowMs: number
): EmailAttentionLevel {
  const cardLevel = getEmailAttentionLevel(
    row.cardRequestEmailDelivery,
    row.cardRequestSentAt,
    nowMs
  );
  const confirmationLevel = getEmailAttentionLevel(
    row.confirmationEmailDelivery,
    row.confirmationSentAt,
    nowMs
  );

  return rankAttention(cardLevel) >= rankAttention(confirmationLevel)
    ? cardLevel
    : confirmationLevel;
}

export function rankAttention(level: AttentionLevel): number {
  return attentionRanks[level];
}

export function matchesAttentionFilter(
  item: QuoteAttentionInput | OnboardingAttentionInput,
  filter: AttentionFilter,
  nowMs: number
): boolean {
  const level = isQuoteAttentionInput(item)
    ? getQuoteAttentionLevel(item, nowMs)
    : getOnboardingAttentionLevel(item, nowMs);

  if (filter === "all") {
    return true;
  }

  if (filter === "needs_attention") {
    return level !== "none";
  }

  if (filter === "email_failed") {
    return level === "failed";
  }

  if (filter === "delivery_delayed") {
    return level === "delayed";
  }

  if (filter === "undelivered_60m") {
    return level === "undelivered_60m";
  }

  return level === "expiring_24h";
}

export function formatDeliveryContext(
  delivery: EmailDeliverySnapshot | null | undefined,
  sentAt: number | null | undefined,
  nowMs: number
): string {
  const sentLabel =
    typeof sentAt === "number" ? `Sent ${formatElapsed(sentAt, nowMs)}` : "Not sent";

  if (!delivery) {
    return sentLabel;
  }

  if (delivery.status === "queued") {
    return "Queued";
  }

  if (delivery.status === "skipped") {
    return "Skipped";
  }

  if (delivery.status === "sent") {
    const reference = sentAt ?? delivery.updatedAt ?? null;
    if (typeof reference === "number") {
      return `Sent ${formatElapsed(reference, nowMs)}`;
    }
    return "Sent";
  }

  if (delivery.status === "delivered") {
    const reference = sentAt ?? delivery.updatedAt ?? null;
    if (typeof reference === "number") {
      return `Delivered ${formatElapsed(reference, nowMs)}`;
    }
    return "Delivered";
  }

  if (delivery.status === "delivery_delayed") {
    const reference = sentAt ?? delivery.updatedAt ?? null;
    if (typeof reference === "number") {
      return `Delivery delayed ${formatElapsed(reference, nowMs)}`;
    }
    return "Delivery delayed";
  }

  const message = delivery.errorMessage?.trim();
  if (message) {
    return `Failed: ${message}`;
  }

  const reference =
    typeof sentAt === "number"
      ? sentAt
      : typeof delivery.updatedAt === "number"
      ? delivery.updatedAt
      : null;
  if (typeof reference === "number") {
    return `Failed ${formatElapsed(reference, nowMs)}`;
  }

  return "Failed";
}

export function getAttentionLabel(level: AttentionLevel): string {
  if (level === "failed") {
    return "Email failed";
  }

  if (level === "delayed") {
    return "Delivery delayed";
  }

  if (level === "undelivered_60m") {
    return "Undelivered 60m";
  }

  if (level === "expiring_24h") {
    return "Expiring < 24h";
  }

  return "No issues";
}

export function getAttentionBadgeClass(level: AttentionLevel): string {
  if (level === "failed") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300";
  }

  if (level === "delayed") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300";
  }

  if (level === "undelivered_60m") {
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/40 dark:bg-orange-950/30 dark:text-orange-300";
  }

  if (level === "expiring_24h") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-300";
  }

  return "border-border/60 bg-muted/30 text-muted-foreground";
}
