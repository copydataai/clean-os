"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@clean-os/convex/api";
import PageHeader from "@/components/dashboard/PageHeader";
import CleanerCard from "@/components/cleaners/CleanerCard";
import EmptyState from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "applicant" | "onboarding" | "active" | "inactive";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "onboarding", label: "Onboarding" },
  { key: "applicant", label: "Applicants" },
  { key: "inactive", label: "Inactive" },
];

export default function CleanersPage() {
  const cleaners = useQuery(api.cleaners.list, {});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    if (!cleaners) return {} as Record<string, number>;
    const c: Record<string, number> = { all: cleaners.length };
    for (const cleaner of cleaners) {
      c[cleaner.status] = (c[cleaner.status] ?? 0) + 1;
    }
    return c;
  }, [cleaners]);

  const filteredCleaners = useMemo(() => {
    if (!cleaners) return [];
    if (statusFilter === "all") return cleaners;
    return cleaners.filter((c) => c.status === statusFilter);
  }, [cleaners, statusFilter]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cleaners"
        subtitle="Staff roster, performance, and team management."
      >
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono text-xs font-medium text-foreground">
              {counts.active ?? 0}
            </span>
            active
          </span>
          <Separator orientation="vertical" className="h-5" />
          <Link href="/dashboard/cleaners/new">
            <Button size="sm">Add Cleaner</Button>
          </Link>
        </div>
      </PageHeader>

      {/* Filter tabs */}
      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="flex border-b border-border/40">
          {STATUS_TABS.map((tab) => {
            const count = counts[tab.key] ?? 0;
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-5 py-3 text-xs font-semibold transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {cleaners && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px] tabular-nums",
                      isActive && "border-primary/30 bg-primary/5 text-primary",
                    )}
                  >
                    {count}
                  </Badge>
                )}
                {isActive && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Roster */}
        <div className="p-4">
          {!cleaners ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">Loading roster...</p>
            </div>
          ) : filteredCleaners.length === 0 ? (
            <EmptyState
              title="No cleaners match this filter"
              description="Adjust the status filter or add a new team member."
              action={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStatusFilter("all")}>
                    Show all
                  </Button>
                  <Link href="/dashboard/cleaners/new">
                    <Button size="sm">Add Cleaner</Button>
                  </Link>
                </div>
              }
            />
          ) : (
            <div className="space-y-1.5">
              {filteredCleaners.map((cleaner) => (
                <CleanerCard key={cleaner._id} cleaner={cleaner} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
