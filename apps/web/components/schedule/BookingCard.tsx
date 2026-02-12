"use client";

import type { Id } from "@clean-os/convex/data-model";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/utils";

type BookingCardProps = {
  booking: {
    _id: Id<"bookings">;
    customerName?: string | null;
    email: string;
    status: string;
    amount?: number | null;
    serviceType?: string | null;
    serviceDate?: string | null;
  };
  compact?: boolean;
};

function formatCurrency(cents?: number | null) {
  if (!cents) return "-";
  return `$${(cents / 100).toLocaleString()}`;
}

export default function BookingCard({ booking, compact = false }: BookingCardProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border/80 bg-[linear-gradient(145deg,color-mix(in_oklch,var(--card)_92%,white),color-mix(in_oklch,var(--accent)_12%,white))] transition-colors hover:border-border",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
            {booking.customerName ?? booking.email}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{booking.email}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div
        className={cn(
          "mt-3 grid gap-2 text-xs",
          compact ? "grid-cols-2" : "grid-cols-3"
        )}
      >
        <div className="rounded-lg border border-border/70 bg-background/80 px-2 py-1.5">
          <p className="uppercase tracking-[0.14em] text-muted-foreground">Service</p>
          <p className="mt-1 font-medium text-foreground">{booking.serviceType ?? "Standard"}</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/80 px-2 py-1.5">
          <p className="uppercase tracking-[0.14em] text-muted-foreground">Amount</p>
          <p className="mt-1 font-medium text-foreground">{formatCurrency(booking.amount)}</p>
        </div>
        {!compact ? (
          <div className="rounded-lg border border-border/70 bg-background/80 px-2 py-1.5">
            <p className="uppercase tracking-[0.14em] text-muted-foreground">Date</p>
            <p className="mt-1 font-medium text-foreground">{booking.serviceDate ?? "TBD"}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
