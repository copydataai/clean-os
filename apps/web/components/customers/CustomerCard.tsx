import Link from "next/link";
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

function formatDate(timestamp?: number | null): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString();
}

export default function CustomerCard({ customer, className }: CustomerCardProps) {
  const initials = getInitials(customer.firstName, customer.lastName);
  const fullName = `${customer.firstName} ${customer.lastName}`;

  return (
    <div
      className={cn(
        "surface-card p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
            {initials}
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">{fullName}</p>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
          </div>
        </div>
        <CustomerStatusBadge status={customer.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>Bookings: {customer.totalBookings ?? 0}</span>
        <span>Spent: {formatCurrency(customer.totalSpent)}</span>
        {customer.lastBookingDate ? (
          <span>Last: {formatDate(customer.lastBookingDate)}</span>
        ) : null}
        {customer.phone ? <span>Phone: {customer.phone}</span> : null}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">ID: {customer._id}</p>
        <Link
          href={`/dashboard/customers/${customer._id}`}
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          View
        </Link>
      </div>
    </div>
  );
}
