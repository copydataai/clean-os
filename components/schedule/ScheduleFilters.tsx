"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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
  { value: "pending_card", label: "Pending Card" },
  { value: "card_saved", label: "Card Saved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "charged", label: "Charged" },
];

export default function ScheduleFilters({
  filters,
  onFiltersChange,
}: ScheduleFiltersProps) {
  const cleaners = useQuery(api.cleaners.list, { status: "active" });

  const handleStatusChange = (value: string | null) => {
    if (!value) return;
    onFiltersChange({
      ...filters,
      status: value === "all" ? undefined : value,
    });
  };

  const handleCleanerChange = (value: string | null) => {
    if (!value) return;
    onFiltersChange({
      ...filters,
      cleanerId: value === "all" ? undefined : (value as Id<"cleaners">),
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasFilters = filters.status || filters.cleanerId;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={filters.status ?? "all"}
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="w-[160px]">
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
        onValueChange={handleCleanerChange}
      >
        <SelectTrigger className="w-[180px]">
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

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
