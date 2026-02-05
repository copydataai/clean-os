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
        <span className="text-sm text-[#666666]">Total Spent</span>
        <span className="text-sm font-medium text-[#1A1A1A]">
          {formatCurrency(totalSpent)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#666666]">Total Bookings</span>
        <span className="text-sm font-medium text-[#1A1A1A]">
          {totalBookings ?? 0}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#666666]">Stripe ID</span>
        <span className="text-sm font-medium text-[#1A1A1A]">
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
