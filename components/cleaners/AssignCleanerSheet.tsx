"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AssignCleanerSheetProps = {
  bookingId: Id<"bookings">;
  trigger?: React.ReactNode;
  onAssigned?: () => void;
};

function formatRating(rating?: number | null): string {
  if (!rating) return "—";
  return rating.toFixed(1);
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
          <SheetTitle>Assign Cleaner</SheetTitle>
          <SheetDescription>
            Select an active cleaner to assign to this booking.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <Input
              placeholder="Search cleaners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {!filteredCleaners ? (
              <div className="text-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Loading cleaners...
                </p>
              </div>
            ) : filteredCleaners.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No active cleaners found
              </div>
            ) : (
              filteredCleaners.map((cleaner) => {
                const isSelected = selectedCleanerId === cleaner._id;
                return (
                  <button
                    key={cleaner._id}
                    type="button"
                    onClick={() => setSelectedCleanerId(cleaner._id)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-background"
                        : "border-border hover:border-border/90 hover:bg-background"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-white">
                        {cleaner.firstName.charAt(0)}
                        {cleaner.lastName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {cleaner.firstName} {cleaner.lastName}
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>
                            Rating: {formatRating(cleaner.averageRating)} ★
                          </span>
                          <span>
                            Reliability: {cleaner.reliabilityScore ?? 100}%
                          </span>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
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
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selectedCleanerId ? (
            <div>
              <label className="text-sm font-medium text-foreground">Role</label>
              <Select value={role} onValueChange={(v) => v && setRole(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="trainee">Trainee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <Button
            onClick={handleAssign}
            disabled={!selectedCleanerId || isAssigning}
            className="w-full"
          >
            {isAssigning ? "Assigning..." : "Assign Cleaner"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
