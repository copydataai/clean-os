"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type AssignCleanerSheetProps = {
  bookingId: Id<"bookings">;
  trigger?: React.ReactNode;
  onAssigned?: () => void;
};

const avatarPalette = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-teal-600",
] as const;

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}

function formatRating(rating?: number | null): string {
  if (rating == null) return "—";
  return rating.toFixed(1);
}

function ratingPct(rating?: number | null): number {
  if (!rating) return 0;
  return Math.round((rating / 5) * 100);
}

function reliabilityColor(score: number): string {
  if (score >= 95) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

const ROLES = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "trainee", label: "Trainee" },
] as const;

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10.5 10.5L13.5 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AssignCleanerSheet({
  bookingId,
  trigger,
  onAssigned,
}: AssignCleanerSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCleanerId, setSelectedCleanerId] =
    useState<Id<"cleaners"> | null>(null);
  const [role, setRole] = useState<string>("primary");
  const [isAssigning, setIsAssigning] = useState(false);

  const cleaners = useQuery(api.cleaners.list, { status: "active" });
  const assignToBooking = useMutation(api.cleaners.assignToBooking);

  const filteredCleaners = cleaners?.filter((cleaner) => {
    if (!searchQuery) return true;
    const fullName = `${cleaner.firstName} ${cleaner.lastName}`.toLowerCase();
    return (
      fullName.includes(searchQuery.toLowerCase()) ||
      cleaner.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleAssign = async () => {
    if (!selectedCleanerId) return;
    setIsAssigning(true);
    try {
      await assignToBooking({
        bookingId,
        cleanerId: selectedCleanerId,
        role,
      });
      setIsOpen(false);
      setSelectedCleanerId(null);
      setRole("primary");
      setSearchQuery("");
      onAssigned?.();
    } catch (err) {
      console.error(err);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <span onClick={() => setIsOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
          Assign Cleaner
        </Button>
      )}
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="text-lg tracking-tight">Assign Cleaner</SheetTitle>
          <SheetDescription className="sr-only">
            Select an active cleaner to assign to this booking.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
          {/* search */}
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <InputGroupText>
                <SearchIcon />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>

          {/* cleaner list */}
          <div className="max-h-[340px] space-y-1.5 overflow-y-auto rounded-xl border border-border bg-card/40 p-2">
            {!filteredCleaners ? (
              <div className="flex flex-col items-center py-8">
                <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="mt-2.5 text-xs text-muted-foreground">Loading cleaners...</p>
              </div>
            ) : filteredCleaners.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : "No active cleaners found"}
              </div>
            ) : (
              filteredCleaners.map((cleaner) => {
                const isSelected = selectedCleanerId === cleaner._id;
                const initials = `${cleaner.firstName.charAt(0)}${cleaner.lastName.charAt(0)}`;
                const fullName = `${cleaner.firstName} ${cleaner.lastName}`;
                const reliability = cleaner.reliabilityScore ?? 100;

                return (
                  <button
                    key={cleaner._id}
                    type="button"
                    onClick={() => setSelectedCleanerId(cleaner._id)}
                    className={cn(
                      "group w-full rounded-lg px-3 py-2.5 text-left transition-all",
                      isSelected
                        ? "bg-primary/[0.06] ring-1 ring-primary/30 dark:bg-primary/10"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* avatar */}
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white transition-transform",
                          avatarColor(fullName),
                          isSelected && "scale-105"
                        )}
                      >
                        {initials}
                      </div>

                      {/* info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {fullName}
                        </p>
                        <div className="mt-1 flex items-center gap-3">
                          {/* rating meter */}
                          <div className="flex items-center gap-1.5">
                            <div className="relative h-1 w-10 overflow-hidden rounded-full bg-muted">
                              <div
                                className="absolute inset-y-0 left-0 rounded-full bg-amber-500"
                                style={{ width: `${ratingPct(cleaner.averageRating)}%` }}
                              />
                            </div>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {formatRating(cleaner.averageRating)}
                            </span>
                          </div>

                          {/* reliability */}
                          <span
                            className={cn(
                              "text-[11px] tabular-nums font-medium",
                              reliabilityColor(reliability)
                            )}
                          >
                            {reliability}%
                          </span>
                        </div>
                      </div>

                      {/* selection indicator */}
                      <div
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-all",
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-border group-hover:border-muted-foreground/30"
                        )}
                      >
                        {isSelected ? (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                            className="text-white"
                          >
                            <path
                              d="M2 5L4 7L8 3"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* role + assign */}
          {selectedCleanerId ? (
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                  Role
                </span>
                <div className="mt-1.5 flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                        role === r.value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleAssign}
                disabled={isAssigning}
                className="w-full"
              >
                {isAssigning ? "Assigning..." : "Assign Cleaner"}
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground/60">
              Select a cleaner to continue
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
