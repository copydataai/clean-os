"use client";

import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Filters = {
  status?: string;
  cleanerId?: Id<"cleaners">;
};

type ScheduleFiltersProps = {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
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

export default function ScheduleFilters({ filters, onFiltersChange }: ScheduleFiltersProps) {
  const cleaners = useQuery(api.cleaners.list, { status: "active" });

  const hasFilters = Boolean(filters.status || filters.cleanerId);

  return (
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
        <SelectTrigger className="w-[180px] bg-background">
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
        value={filters.cleanerId ?? "all"}
        onValueChange={(value) => {
          if (!value) return;
          onFiltersChange({
            ...filters,
            cleanerId: value === "all" ? undefined : (value as Id<"cleaners">),
          });
        }}
      >
        <SelectTrigger className="w-[220px] bg-background">
          <SelectValue placeholder="Cleaner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All cleaners</SelectItem>
          {cleaners?.map((cleaner) => (
            <SelectItem key={cleaner._id} value={cleaner._id}>
              {cleaner.firstName} {cleaner.lastName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => onFiltersChange({})}>
          Clear filters
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">No active filters</span>
      )}
    </div>
  );
}
