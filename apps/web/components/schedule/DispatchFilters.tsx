"use client";

import type { Id } from "@clean-os/convex/data-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DispatchCleanerSummary, DispatchFiltersState, DispatchTotals } from "./types";

type DispatchFiltersProps = {
  date: string;
  filters: DispatchFiltersState;
  cleaners: DispatchCleanerSummary[];
  totals: DispatchTotals;
  backfilling: boolean;
  backfillNote?: string | null;
  onDateChange: (date: string) => void;
  onFiltersChange: (filters: DispatchFiltersState) => void;
  onBackfillLocations: () => Promise<void>;
  onOpenMobileMap: () => void;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending_card", label: "Pending card" },
  { value: "card_saved", label: "Card saved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "payment_failed", label: "Payment failed" },
  { value: "charged", label: "Charged" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failed", label: "Failed (legacy)" },
];

export default function DispatchFilters({
  date,
  filters,
  cleaners,
  totals,
  backfilling,
  backfillNote,
  onDateChange,
  onFiltersChange,
  onBackfillLocations,
  onOpenMobileMap,
}: DispatchFiltersProps) {
  const hasFilter =
    Boolean(filters.status || filters.cleanerId) ||
    filters.priority !== "all" ||
    filters.assignmentState !== "all";

  return (
    <section className="surface-card border-border/80 bg-[linear-gradient(145deg,color-mix(in_oklch,var(--card)_90%,white),color-mix(in_oklch,var(--accent)_16%,white))] p-4 sm:p-5">
      <div className="flex flex-col gap-4 border-b border-border/70 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.19em] text-muted-foreground">
              Dispatch Date
            </p>
            <Input
              type="date"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
              className="mt-1.5 w-[190px] bg-background"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 font-medium text-foreground">
              Queue {totals.total}
            </span>
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 font-medium text-foreground">
              Assigned {totals.assigned}
            </span>
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 font-medium text-foreground">
              Unassigned {totals.unassigned}
            </span>
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 font-medium text-foreground">
              Missing pins {totals.missingLocation}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onBackfillLocations} disabled={backfilling}>
              {backfilling ? "Refreshing map data..." : "Refresh map data"}
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenMobileMap} className="xl:hidden">
              Open map
            </Button>
          </div>
        </div>

        {backfillNote ? (
          <p className="text-xs text-muted-foreground">{backfillNote}</p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[180px_190px_150px_230px_auto] xl:items-center">
        <Select
          value={filters.status ?? "all"}
          onValueChange={(value) => {
            if (!value) return;
            onFiltersChange({
              ...filters,
              status: value === "all" ? undefined : value,
            });
          }}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.assignmentState}
          onValueChange={(value) => {
            if (!value) return;
            onFiltersChange({
              ...filters,
              assignmentState: value as DispatchFiltersState["assignmentState"],
            });
          }}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Assignment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignments</SelectItem>
            <SelectItem value="assigned">Assigned only</SelectItem>
            <SelectItem value="unassigned">Unassigned only</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.priority}
          onValueChange={(value) => {
            if (!value) return;
            onFiltersChange({
              ...filters,
              priority: value as DispatchFiltersState["priority"],
            });
          }}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.cleanerId ?? "all"}
          onValueChange={(value) => {
            if (!value) return;
            onFiltersChange({
              ...filters,
              cleanerId: value === "all" ? undefined : (value as Id<"cleaners">),
            });
          }}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Cleaner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cleaners</SelectItem>
            {cleaners.map((cleaner) => (
              <SelectItem key={cleaner._id} value={cleaner._id}>
                {cleaner.name} ({cleaner.assignmentCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center justify-start xl:justify-end">
          {hasFilter ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onFiltersChange({
                  assignmentState: "all",
                  priority: "all",
                })
              }
            >
              Clear filters
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Filters are clear</span>
          )}
        </div>
      </div>
    </section>
  );
}
