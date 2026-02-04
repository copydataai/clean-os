"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import PageHeader from "@/components/dashboard/PageHeader";
import CleanerCard from "@/components/cleaners/CleanerCard";
import QuickFilters from "@/components/dashboard/QuickFilters";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";

type StatusFilter = "all" | "applicant" | "onboarding" | "active" | "inactive";

export default function CleanersPage() {
  const cleaners = useQuery(api.cleaners.list, {});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredCleaners = useMemo(() => {
    if (!cleaners) {
      return [];
    }

    return cleaners.filter((cleaner) => {
      if (statusFilter !== "all" && cleaner.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [cleaners, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cleaners"
        subtitle="Manage your cleaning staff and contractors."
      >
        <Link href="/cleaners/new">
          <Button size="sm">Add Cleaner</Button>
        </Link>
      </PageHeader>

      <div className="rounded-2xl border border-[#E5E5E5] bg-white p-4">
        <QuickFilters
          options={[
            {
              key: "all",
              label: "All",
              active: statusFilter === "all",
              onClick: () => setStatusFilter("all"),
            },
            {
              key: "applicant",
              label: "Applicants",
              active: statusFilter === "applicant",
              onClick: () => setStatusFilter("applicant"),
            },
            {
              key: "onboarding",
              label: "Onboarding",
              active: statusFilter === "onboarding",
              onClick: () => setStatusFilter("onboarding"),
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
          ]}
        />
      </div>

      {!cleaners ? (
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-8 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1A1A1A] border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-[#666666]">Loading cleaners...</p>
        </div>
      ) : filteredCleaners.length === 0 ? (
        <EmptyState
          title="No cleaners match your filters"
          description="Try adjusting the status filter to see more cleaners, or add a new cleaner."
          action={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStatusFilter("all")}
              >
                Reset filters
              </Button>
              <Link href="/cleaners/new">
                <Button>Add Cleaner</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredCleaners.map((cleaner) => (
            <CleanerCard key={cleaner._id} cleaner={cleaner} />
          ))}
        </div>
      )}
    </div>
  );
}
