"use client";

import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import CleanerForm from "@/components/cleaners/CleanerForm";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function NewCleanerPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Add Cleaner"
        subtitle="Create a new team member or contractor profile."
      >
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/cleaners">
            <Button variant="outline" size="sm">Back to Roster</Button>
          </Link>
        </div>
      </PageHeader>

      <div className="surface-card overflow-hidden rounded-2xl p-6">
        <CleanerForm mode="create" />
      </div>
    </div>
  );
}
