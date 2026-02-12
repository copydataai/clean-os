"use client";

import Link from "next/link";
import type { Id } from "@clean-os/convex/data-model";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { onboardingRequestPath } from "@/lib/onboarding/routes";

type OverviewOnboardingRowProps = {
  request: {
    _id: Id<"bookingRequests">;
    status: string;
    contactDetails?: string | null;
    email?: string | null;
    createdAt: number;
    bookingId?: Id<"bookings"> | null;
    linkSentAt?: number | null;
    confirmLinkSentAt?: number | null;
  };
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString();
}

export default function OverviewOnboardingRow({ request }: OverviewOnboardingRowProps) {
  return (
    <Link
      href={onboardingRequestPath(request._id)}
      className="group flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3 transition-all hover:border-border hover:bg-muted/30"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          {request.contactDetails || request.email || "Unnamed intake"}
        </p>
        <p className="truncate text-xs text-muted-foreground">{request.email || "No email provided"}</p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Submitted</p>
        <p className="font-mono text-xs font-medium text-foreground">{formatDate(request.createdAt)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <StatusBadge status={request.status} />
        {request.bookingId ? (
          <Badge variant="outline" className="text-[10px]">
            Active job
          </Badge>
        ) : null}
        {request.linkSentAt ? (
          <Badge className="bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            card sent
          </Badge>
        ) : null}
        {request.confirmLinkSentAt ? (
          <Badge className="bg-sky-100 text-[10px] text-sky-700 dark:bg-sky-900/40 dark:text-sky-400">
            confirm sent
          </Badge>
        ) : null}
      </div>

      <svg
        className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
