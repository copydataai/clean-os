"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import PageHeader from "@/components/dashboard/PageHeader";
import RequestCard from "@/components/dashboard/RequestCard";
import EmptyState from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import RequestCreateSheet from "@/components/dashboard/RequestCreateSheet";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "requested" | "confirmed";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "requested", label: "Requested" },
  { key: "confirmed", label: "Confirmed" },
];

export default function RequestsPage() {
  const requests = useQuery(api.bookingRequests.listRecent, { limit: 50 });
  const tallyLinks = useQuery(api.integrations.getTallyFormLinksForActiveOrganization, {});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    if (!requests) return {} as Record<string, number>;
    const c: Record<string, number> = { all: requests.length };
    for (const request of requests) {
      c[request.status] = (c[request.status] ?? 0) + 1;
    }
    return c;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    if (statusFilter === "all") return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Booking Requests"
        subtitle="Review incoming cleaning requests and prepare bookings."
      >
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="font-mono text-xs font-medium text-foreground">
              {counts.requested ?? 0}
            </span>
            pending
          </span>
          <Separator orientation="vertical" className="h-5" />
          <RequestCreateSheet />
        </div>
      </PageHeader>

      {tallyLinks && !tallyLinks.confirmationFormUrl ? (
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
          Confirmation links are unavailable until Tally confirmation form setup is complete in{" "}
          <a href="/dashboard/settings/integrations" className="font-medium underline">
            Integrations
          </a>
          .
        </div>
      ) : null}

      {/* Filter tabs + request list */}
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
                {requests && (
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

        {/* Request list */}
        <div className="p-4">
          {!requests ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">Loading requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              title="No requests match this filter"
              description="Adjust the status filter or create a new request."
              action={
                <Button variant="outline" size="sm" onClick={() => setStatusFilter("all")}>
                  Show all
                </Button>
              }
            />
          ) : (
            <div className="space-y-1.5">
              {filteredRequests.map((request) => (
                <RequestCard
                  key={request._id}
                  request={request}
                  confirmationFormUrl={tallyLinks?.confirmationFormUrl ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
