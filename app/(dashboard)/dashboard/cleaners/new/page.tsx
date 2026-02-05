"use client";

import PageHeader from "@/components/dashboard/PageHeader";
import CleanerForm from "@/components/cleaners/CleanerForm";

export default function NewCleanerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Cleaner"
        subtitle="Add a new cleaner or contractor to your team."
      />

      <div className="surface-card p-6">
        <CleanerForm mode="create" />
      </div>
    </div>
  );
}
