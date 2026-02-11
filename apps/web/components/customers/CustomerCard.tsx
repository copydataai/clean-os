import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import CustomerStatusBadge from "@/components/customers/CustomerStatusBadge";
import { cn } from "@/lib/utils";
import type { Id } from "@clean-os/convex/data-model";

type CustomerCardProps = {
  customer: {
    _id: Id<"customers">;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    status: string;
    totalBookings?: number | null;
    totalSpent?: number | null;
    lastBookingDate?: number | null;
    stripeCustomerId?: string | null;
  };
  className?: string;
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatCurrency(amountCents?: number | null): string {
  if (!amountCents) return "$0";
  return `$${(amountCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

const avatarColors: Record<string, string> = {
  lead: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  inactive: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  churned: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

export default function CustomerCard({ customer, className }: CustomerCardProps) {
  const initials = getInitials(customer.firstName, customer.lastName);
  const fullName = `${customer.firstName} ${customer.lastName}`;
  const colorClass = avatarColors[customer.status] ?? "bg-muted text-muted-foreground";
  const hasCardOnFile = Boolean(customer.stripeCustomerId);

  return (
    <Link
      href={`/dashboard/customers/${customer._id}`}
      className={cn(
        "group flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3 transition-all hover:border-border hover:bg-muted/30",
        className,
      )}
    >
      {/* Avatar */}
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", colorClass)}>
        {initials}
      </div>

      {/* Name & email */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
      </div>

      {/* Metrics strip */}
      <div className="hidden items-center gap-4 sm:flex">
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Bookings</p>
          <p className="font-mono text-xs font-medium text-foreground">{customer.totalBookings ?? 0}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Spent</p>
          <p className="font-mono text-xs font-medium text-foreground">{formatCurrency(customer.totalSpent)}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex shrink-0 items-center gap-1.5">
        {hasCardOnFile && (
          <Badge variant="outline" className="text-[10px]">Card</Badge>
        )}
        <CustomerStatusBadge status={customer.status} />
      </div>

      {/* Arrow */}
      <svg className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
