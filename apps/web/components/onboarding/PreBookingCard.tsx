import Link from "next/link";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { LifecycleRow } from "@/components/bookings/types";
import { cn } from "@/lib/utils";
import { onboardingRequestPath } from "@/lib/onboarding/routes";

function emailStatusLabel(prefix: "card" | "confirm", status: string) {
  return `${prefix} ${status.replace(/_/g, " ")}`;
}

export default function PreBookingCard({ row }: { row: LifecycleRow }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--onboarding-intake-accent)" }}
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {row.customerName ?? row.email ?? "Intake lead"}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{row.email ?? "No email provided"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="border-[color:var(--onboarding-intake-accent)]/40 text-[10px] text-[color:var(--onboarding-intake-accent)]"
          >
            intake
          </Badge>
          {row.funnelStage ? <StatusBadge status={row.funnelStage} context="funnel" /> : null}
          {row.cardRequestEmailDelivery ? (
            <StatusBadge
              status={row.cardRequestEmailDelivery.status}
              label={emailStatusLabel("card", row.cardRequestEmailDelivery.status)}
              className="text-[10px]"
            />
          ) : null}
          {row.confirmationEmailDelivery ? (
            <StatusBadge
              status={row.confirmationEmailDelivery.status}
              label={emailStatusLabel("confirm", row.confirmationEmailDelivery.status)}
              className="text-[10px]"
            />
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {row.bookingRequestId ? (
          <Link
            href={onboardingRequestPath(row.bookingRequestId)}
            className={cn(buttonVariants({ size: "xs", variant: "outline" }))}
          >
            Open intake
          </Link>
        ) : null}
        {row.quoteRequestId ? (
          <Link
            href={`/dashboard/quotes/${row.quoteRequestId}`}
            className={cn(buttonVariants({ size: "xs", variant: "outline" }))}
          >
            Open quote
          </Link>
        ) : null}
      </div>
    </div>
  );
}
