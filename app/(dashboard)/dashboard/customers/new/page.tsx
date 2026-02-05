"use client";

import PageHeader from "@/components/dashboard/PageHeader";
import CustomerForm from "@/components/customers/CustomerForm";

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Customer"
        subtitle="Add a new customer to your database."
      />

      <div className="surface-card p-6">
        <CustomerForm mode="create" />
      </div>
    </div>
  );
}
