"use client";

type CustomerPaymentInfoProps = {
  stripeCustomerId?: string | null;
  totalSpent?: number | null;
  totalBookings?: number | null;
};

function formatCurrency(amountCents?: number | null): string {
  if (!amountCents) return "$0";
  return `$${(amountCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default function CustomerPaymentInfo({
  stripeCustomerId,
  totalSpent,
  totalBookings,
}: CustomerPaymentInfoProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total Spent</span>
        <span className="text-sm font-medium text-foreground">
          {formatCurrency(totalSpent)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total Bookings</span>
        <span className="text-sm font-medium text-foreground">
          {totalBookings ?? 0}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Stripe ID</span>
        <span className="text-sm font-medium text-foreground">
          {stripeCustomerId ? (
            <span className="font-mono text-xs">{stripeCustomerId.slice(0, 16)}...</span>
          ) : (
            "—"
          )}
        </span>
      </div>
    </div>
  );
}
