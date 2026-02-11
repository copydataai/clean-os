"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import PageHeader from "@/components/dashboard/PageHeader";
import CustomerStatusBadge from "@/components/customers/CustomerStatusBadge";
import CustomerForm from "@/components/customers/CustomerForm";
import CustomerBookingHistory from "@/components/customers/CustomerBookingHistory";
import CustomerQuoteHistory from "@/components/customers/CustomerQuoteHistory";
import CustomerPaymentInfo from "@/components/customers/CustomerPaymentInfo";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* ─── Helpers ───────────────────────────────────────────────── */

function formatDate(timestamp?: number | null) {
  if (!timestamp) return "---";
  return new Date(timestamp).toLocaleDateString();
}

function formatCurrency(amountCents?: number | null): string {
  if (!amountCents) return "$0";
  return `$${(amountCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function SectionNumber({ n }: { n: string }) {
  return (
    <span className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
      {n}
    </span>
  );
}

function StatCell({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-sm font-medium text-foreground", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

const avatarColors: Record<string, string> = {
  lead: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  inactive: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  churned: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

/* ─── Main Page ─────────────────────────────────────────────── */

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.id as Id<"customers"> | undefined;

  const customer = useQuery(
    api.customers.getWithDetails,
    customerId ? { customerId } : "skip"
  );
  const updateCustomer = useMutation(api.customers.update);

  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);
  const [isNotesSheetOpen, setIsNotesSheetOpen] = useState(false);

  const [newStatus, setNewStatus] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [internalNotes, setInternalNotes] = useState("");
  const [isUpdatingNotes, setIsUpdatingNotes] = useState(false);

  const handleStatusChange = async () => {
    if (!customerId || !newStatus) return;
    setIsUpdatingStatus(true);
    try {
      await updateCustomer({ customerId, status: newStatus });
      setIsStatusSheetOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleNotesUpdate = async () => {
    if (!customerId) return;
    setIsUpdatingNotes(true);
    try {
      await updateCustomer({
        customerId,
        internalNotes: internalNotes || undefined,
      });
      setIsNotesSheetOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingNotes(false);
    }
  };

  /* Guards */

  if (customer === null) {
    return (
      <EmptyState
        title="Customer not found"
        description="We couldn't locate this customer."
        action={
          <Button onClick={() => router.push("/dashboard/customers")}>
            Back to Customers
          </Button>
        }
      />
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading customer...</p>
      </div>
    );
  }

  const fullName = `${customer.firstName} ${customer.lastName}`;
  const initials = `${customer.firstName.charAt(0)}${customer.lastName.charAt(0)}`.toUpperCase();
  const colorClass = avatarColors[customer.status] ?? "bg-muted text-muted-foreground";

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader title={fullName} subtitle={`Customer since ${formatDate(customer.createdAt)}`}>
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/customers">
            <Button variant="outline" size="sm">Back to Customers</Button>
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <CustomerStatusBadge status={customer.status} />
        </div>
      </PageHeader>

      {/* Hero strip: Avatar + metrics + actions */}
      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold", colorClass)}>
              {initials}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <StatCell label="Email" value={customer.email} />
              <StatCell label="Phone" value={customer.phone ?? "---"} />
              <StatCell label="Source" value={customer.source?.replace(/_/g, " ") ?? "---"} />
              <StatCell label="Sq Ft" value={customer.squareFootage ? customer.squareFootage.toLocaleString() : "---"} mono />
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button variant="outline" size="xs" onClick={() => setIsEditSheetOpen(true)}>
              Edit
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setNewStatus(customer.status);
                setIsStatusSheetOpen(true);
              }}
            >
              Status
            </Button>
          </div>
        </div>

        <Separator />

        {/* Stats strip */}
        <div className="flex flex-wrap items-center gap-6 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Bookings</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {customer.totalBookings ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Spent</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {formatCurrency(customer.totalSpent)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Last Booking</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {formatDate(customer.lastBookingDate)}
            </span>
          </div>
          {customer.stripeCustomerId && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Stripe</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {customer.stripeCustomerId.slice(0, 16)}...
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content sections */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* 01 · Address */}
          {(customer.address?.street || customer.address?.city || customer.address?.state) && (
            <section className="surface-card overflow-hidden rounded-2xl">
              <div className="flex items-start gap-2 p-5">
                <SectionNumber n="01" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Address</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[
                      customer.address?.street,
                      customer.address?.addressLine2,
                      customer.address?.city,
                      customer.address?.state,
                      customer.address?.postalCode,
                    ]
                      .filter(Boolean)
                      .join(", ") || "---"}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* 02 · Booking History */}
          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="flex items-start gap-2 p-5">
              <SectionNumber n={customer.address?.street ? "02" : "01"} />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Booking History</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Recent bookings and service records.
                </p>
              </div>
            </div>
            <Separator />
            <div className="p-5">
              <CustomerBookingHistory bookings={customer.bookings ?? []} limit={5} />
            </div>
          </section>

          {/* 03 · Quote Requests */}
          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="flex items-start gap-2 p-5">
              <SectionNumber n={customer.address?.street ? "03" : "02"} />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Quote Requests</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Submitted quote requests and their status.
                </p>
              </div>
            </div>
            <Separator />
            <div className="p-5">
              <CustomerQuoteHistory quoteRequests={customer.quoteRequests ?? []} limit={5} />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Info */}
          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-foreground">Payment</h2>
            </div>
            <Separator />
            <div className="p-5">
              <CustomerPaymentInfo
                stripeCustomerId={customer.stripeCustomerId}
                totalSpent={customer.totalSpent}
                totalBookings={customer.totalBookings}
              />
            </div>
          </section>

          {/* Internal Notes */}
          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between p-5">
              <h2 className="text-sm font-semibold text-foreground">Internal Notes</h2>
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setInternalNotes(customer.internalNotes ?? "");
                  setIsNotesSheetOpen(true);
                }}
              >
                Edit
              </Button>
            </div>
            <Separator />
            <div className="p-5">
              {customer.internalNotes ? (
                <p className="text-sm text-muted-foreground">{customer.internalNotes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No internal notes.</p>
              )}
            </div>
          </section>

          {/* Customer Notes */}
          {customer.notes && (
            <section className="surface-card overflow-hidden rounded-2xl">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-foreground">Customer Notes</h2>
              </div>
              <Separator />
              <div className="p-5">
                <p className="text-sm text-muted-foreground">{customer.notes}</p>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Edit Profile Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Profile</SheetTitle>
            <SheetDescription>Update profile information for {fullName}.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CustomerForm
              mode="edit"
              initialData={customer}
              onSuccess={() => setIsEditSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Change Status Sheet */}
      <Sheet open={isStatusSheetOpen} onOpenChange={setIsStatusSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Change Status</SheetTitle>
            <SheetDescription>Update the customer status for {fullName}.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">New Status</label>
              <Select value={newStatus} onValueChange={(v) => v && setNewStatus(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={handleStatusChange}
              disabled={isUpdatingStatus || !newStatus}
              className="w-full"
            >
              {isUpdatingStatus ? "Updating..." : "Update Status"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Internal Notes Sheet */}
      <Sheet open={isNotesSheetOpen} onOpenChange={setIsNotesSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Internal Notes</SheetTitle>
            <SheetDescription>Add internal notes about this customer (not visible to customer).</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Add internal notes..."
              rows={6}
            />
            <Button
              size="sm"
              onClick={handleNotesUpdate}
              disabled={isUpdatingNotes}
              className="w-full"
            >
              {isUpdatingNotes ? "Saving..." : "Save Notes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
