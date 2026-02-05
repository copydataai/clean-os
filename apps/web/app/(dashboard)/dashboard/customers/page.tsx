"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import PageHeader from "@/components/dashboard/PageHeader";
import CustomerCard from "@/components/customers/CustomerCard";
import QuickFilters from "@/components/dashboard/QuickFilters";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";

type StatusFilter = "all" | "lead" | "active" | "inactive" | "churned";

export default function CustomersPage() {
  const customers = useQuery(api.customers.list, {});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredCustomers = useMemo(() => {
    if (!customers) {
      return [];
    }

    return customers.filter((customer) => {
      if (statusFilter !== "all" && customer.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [customers, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Manage your customer relationships and history."
      >
        <Link href="/dashboard/customers/new">
          <Button size="sm">Add Customer</Button>
        </Link>
      </PageHeader>

      <div className="surface-card p-4">
        <QuickFilters
          options={[
            {
              key: "all",
              label: "All",
              active: statusFilter === "all",
              onClick: () => setStatusFilter("all"),
            },
            {
              key: "lead",
              label: "Leads",
              active: statusFilter === "lead",
              onClick: () => setStatusFilter("lead"),
            },
            {
              key: "active",
              label: "Active",
              active: statusFilter === "active",
              onClick: () => setStatusFilter("active"),
            },
            {
              key: "inactive",
              label: "Inactive",
              active: statusFilter === "inactive",
              onClick: () => setStatusFilter("inactive"),
            },
            {
              key: "churned",
              label: "Churned",
              active: statusFilter === "churned",
              onClick: () => setStatusFilter("churned"),
            },
          ]}
        />
      </div>

      {!customers ? (
        <div className="surface-card p-8 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading customers...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title="No customers match your filters"
          description="Try adjusting the status filter to see more customers, or add a new customer."
          action={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStatusFilter("all")}
              >
                Reset filters
              </Button>
              <Link href="/dashboard/customers/new">
                <Button>Add Customer</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredCustomers.map((customer) => (
            <CustomerCard key={customer._id} customer={customer} />
          ))}
        </div>
      )}
    </div>
  );
}
