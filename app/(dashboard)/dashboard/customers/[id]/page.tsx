"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import PageHeader from "@/components/dashboard/PageHeader";
import CustomerStatusBadge from "@/components/customers/CustomerStatusBadge";
import CustomerForm from "@/components/customers/CustomerForm";
import CustomerBookingHistory from "@/components/customers/CustomerBookingHistory";
import CustomerQuoteHistory from "@/components/customers/CustomerQuoteHistory";
import CustomerPaymentInfo from "@/components/customers/CustomerPaymentInfo";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
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

function formatDate(timestamp?: number | null) {
  if (!timestamp) {
    return "—";
  }
  return new Date(timestamp).toLocaleDateString();
}

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

  // Status change state
  const [newStatus, setNewStatus] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Notes state
  const [internalNotes, setInternalNotes] = useState("");
  const [isUpdatingNotes, setIsUpdatingNotes] = useState(false);

  const handleStatusChange = async () => {
    if (!customerId || !newStatus) return;
    setIsUpdatingStatus(true);
    try {
      await updateCustomer({
        customerId,
        status: newStatus,
      });
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
      <div className="surface-card p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">Loading customer...</p>
      </div>
    );
  }

  const fullName = `${customer.firstName} ${customer.lastName}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName}
        subtitle={`Customer since ${formatDate(customer.createdAt)}`}
      >
        <CustomerStatusBadge status={customer.status} />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="space-y-4 lg:col-span-2">
          {/* Profile Overview */}
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Profile Overview
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="surface-soft p-4">
                <p className="text-xs uppercase text-muted-foreground">Email</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {customer.email}
                </p>
              </div>
              <div className="surface-soft p-4">
                <p className="text-xs uppercase text-muted-foreground">Phone</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {customer.phone ?? "—"}
                </p>
              </div>
              <div className="surface-soft p-4">
                <p className="text-xs uppercase text-muted-foreground">Source</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {customer.source?.replace(/_/g, " ") ?? "—"}
                </p>
              </div>
              <div className="surface-soft p-4">
                <p className="text-xs uppercase text-muted-foreground">Square Footage</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {customer.squareFootage
                    ? `${customer.squareFootage.toLocaleString()} sq ft`
                    : "—"}
                </p>
              </div>
            </div>

            {customer.address?.street ||
            customer.address?.city ||
            customer.address?.state ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-foreground">Address</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {[
                    customer.address?.street,
                    customer.address?.addressLine2,
                    customer.address?.city,
                    customer.address?.state,
                    customer.address?.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              </div>
            ) : null}

            {customer.notes ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-foreground">Notes</h3>
                <p className="mt-2 text-sm text-muted-foreground">{customer.notes}</p>
              </div>
            ) : null}
          </div>

          {/* Booking History */}
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Booking History
            </h2>
            <div className="mt-4">
              <CustomerBookingHistory
                bookings={customer.bookings ?? []}
                limit={5}
              />
            </div>
          </div>

          {/* Quote History */}
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Quote Requests
            </h2>
            <div className="mt-4">
              <CustomerQuoteHistory
                quoteRequests={customer.quoteRequests ?? []}
                limit={5}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Actions</h2>
            <div className="mt-4 space-y-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setIsEditSheetOpen(true)}
              >
                Edit profile
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setNewStatus(customer.status);
                  setIsStatusSheetOpen(true);
                }}
              >
                Change status
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Stats</h2>
            <div className="mt-4">
              <CustomerPaymentInfo
                stripeCustomerId={customer.stripeCustomerId}
                totalSpent={customer.totalSpent}
                totalBookings={customer.totalBookings}
              />
            </div>
          </div>

          {/* Internal Notes */}
          <div className="surface-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Internal Notes
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInternalNotes(customer.internalNotes ?? "");
                  setIsNotesSheetOpen(true);
                }}
              >
                Edit
              </Button>
            </div>
            <div className="mt-4">
              {customer.internalNotes ? (
                <p className="text-sm text-muted-foreground">{customer.internalNotes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No internal notes.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Profile</SheetTitle>
            <SheetDescription>
              Update the customer's profile information.
            </SheetDescription>
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
            <SheetDescription>
              Update the customer's status.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">
                New Status
              </label>
              <Select value={newStatus} onValueChange={(v) => v && setNewStatus(v)}>
                <SelectTrigger className="mt-1 w-full">
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
            <SheetDescription>
              Add internal notes about this customer (not visible to customer).
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Add internal notes..."
              rows={6}
            />
            <Button
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
