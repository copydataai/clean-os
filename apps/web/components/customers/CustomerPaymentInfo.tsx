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

function Row({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs text-foreground" : "text-sm font-medium text-foreground"}>
        {value}
      </span>
    </div>
  );
}

export default function CustomerPaymentInfo({
  stripeCustomerId,
  totalSpent,
  totalBookings,
}: CustomerPaymentInfoProps) {
  return (
    <div className="space-y-3">
      <Row label="Total Spent" value={formatCurrency(totalSpent)} />
      <Row label="Total Bookings" value={totalBookings ?? 0} />
      <Row
        label="Stripe ID"
        value={stripeCustomerId ? `${stripeCustomerId.slice(0, 16)}...` : "---"}
        mono
      />
    </div>
  );
}
