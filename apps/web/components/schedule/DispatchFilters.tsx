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
  onDateChange: (date: string) => void;
  onFiltersChange: (filters: DispatchFiltersState) => void;
  onBackfillLocations: () => Promise<void>;
  onOpenMobileMap: () => void;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending_card", label: "Pending Card" },
  { value: "card_saved", label: "Card Saved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "payment_failed", label: "Payment Failed" },
  { value: "charged", label: "Charged" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failed", label: "Failed (Legacy)" },
];

export default function DispatchFilters({
  date,
  filters,
  cleaners,
  totals,
  backfilling,
  onDateChange,
  onFiltersChange,
  onBackfillLocations,
  onOpenMobileMap,
}: DispatchFiltersProps) {
  const hasFilter = Boolean(filters.status || filters.cleanerId || filters.priority !== "all" || filters.assignmentState !== "all");

  return (
    <div className="surface-card space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dispatch Date
          </p>
          <Input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className="mt-1 w-[180px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{totals.total} in queue</span>
          <span>{totals.unassigned} unassigned</span>
          <span>{totals.missingLocation} without map pin</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onBackfillLocations}
            disabled={backfilling}
          >
            {backfilling ? "Refreshing..." : "Refresh locations"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenMobileMap}
            className="lg:hidden"
          >
            Show map
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
          <SelectTrigger className="w-[170px]">
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
          <SelectTrigger className="w-[180px]">
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
          <SelectTrigger className="w-[150px]">
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
          <SelectTrigger className="w-[210px]">
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

        {hasFilter && (
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
        )}
      </div>
    </div>
  );
}
