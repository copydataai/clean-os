"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Id } from "@clean-os/convex/data-model";

type Assignment = {
  _id: Id<"bookingAssignments">;
  bookingId: Id<"bookings">;
  role: string;
  status: string;
  assignedAt: number;
  clockedInAt?: number | null;
  clockedOutAt?: number | null;
  actualDurationMinutes?: number | null;
};

type AssignmentListProps = {
  assignments: Assignment[];
  className?: string;
  limit?: number;
};

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
  declined: "bg-red-100 text-red-700",
  confirmed: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-700",
};

const roleStyles: Record<string, string> = {
  primary: "bg-primary text-white",
  secondary: "bg-muted text-muted-foreground",
  trainee: "bg-blue-50 text-blue-600",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(minutes?: number | null): string {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export default function AssignmentList({
  assignments,
  className,
  limit,
}: AssignmentListProps) {
  const displayAssignments = limit ? assignments.slice(0, limit) : assignments;

  if (displayAssignments.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No assignments yet
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {displayAssignments.map((assignment) => (
        <div
          key={assignment._id}
          className="surface-soft p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                Booking {assignment.bookingId.slice(-6)}
              </p>
              <p className="text-xs text-muted-foreground">
                Assigned: {formatDate(assignment.assignedAt)}
              </p>
              {assignment.actualDurationMinutes ? (
                <p className="text-xs text-muted-foreground">
                  Duration: {formatDuration(assignment.actualDurationMinutes)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge
                className={cn(
                  roleStyles[assignment.role] ?? "bg-gray-100 text-gray-700"
                )}
              >
                {assignment.role}
              </Badge>
              <Badge
                className={cn(
                  statusStyles[assignment.status] ?? "bg-gray-100 text-gray-700"
                )}
              >
                {assignment.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>
        </div>
      ))}
      {limit && assignments.length > limit ? (
        <p className="text-xs text-muted-foreground text-center">
          +{assignments.length - limit} more assignments
        </p>
      ) : null}
    </div>
  );
}
