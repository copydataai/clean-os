"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TimeOffRequest = {
  _id: string;
  startDate: string;
  endDate: string;
  timeOffType: string;
  status: string;
  reason?: string | null;
  isAllDay?: boolean;
};

type TimeOffListProps = {
  timeOffRequests: TimeOffRequest[];
  className?: string;
};

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-700",
};

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startStr = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (startDate === endDate) {
    return startStr;
  }

  const endStr = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${startStr} - ${endStr}`;
}

export default function TimeOffList({
  timeOffRequests,
  className,
}: TimeOffListProps) {
  if (timeOffRequests.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No time off requests
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {timeOffRequests.map((request) => (
        <div
          key={request._id}
          className="surface-soft p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                {formatDateRange(request.startDate, request.endDate)}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {request.timeOffType.replace(/_/g, " ")}
              </p>
              {request.reason ? (
                <p className="mt-1 text-xs text-muted-foreground">{request.reason}</p>
              ) : null}
            </div>
            <Badge
              className={cn(
                statusStyles[request.status] ?? "bg-gray-100 text-gray-700"
              )}
            >
              {request.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
