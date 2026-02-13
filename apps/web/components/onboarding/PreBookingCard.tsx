import Link from "next/link";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { LifecycleRow } from "@/components/bookings/types";
import {
  formatDeliveryContext,
  getAttentionBadgeClass,
  getAttentionLabel,
  getOnboardingAttentionLevel,
  type EmailAttentionLevel,
} from "@/lib/commsAttention";
import { cn } from "@/lib/utils";
import { onboardingRequestPath } from "@/lib/onboarding/routes";

export type QuickActionState = "idle" | "sending" | "sent" | "error";

type PreBookingCardProps = {
  row: LifecycleRow;
  attentionLevel?: EmailAttentionLevel;
  cardActionState?: QuickActionState;
  confirmActionState?: QuickActionState;
  confirmationEnabled: boolean;
  onSendCardEmail?: (requestId: NonNullable<LifecycleRow["bookingRequestId"]>) => void;
  onSendConfirmEmail?: (requestId: NonNullable<LifecycleRow["bookingRequestId"]>) => void;
};

function emailStatusLabel(prefix: "card" | "confirm", status: string) {
  return `${prefix} ${status.replace(/_/g, " ")}`;
}

function actionLabel(base: string, state: QuickActionState) {
  if (state === "sending") {
    return "Sending...";
  }

  if (state === "sent") {
    return "Sent";
  }

  if (state === "error") {
    return "Failed";
  }

  return base;
}

export default function PreBookingCard({
  row,
  attentionLevel,
  cardActionState = "idle",
  confirmActionState = "idle",
  confirmationEnabled,
  onSendCardEmail,
  onSendConfirmEmail,
}: PreBookingCardProps) {
  const nowMs = Date.now();
  const highestAttention = attentionLevel ?? getOnboardingAttentionLevel(row, nowMs);

  const cardContext = formatDeliveryContext(
    row.cardRequestEmailDelivery,
    row.cardRequestEmailDelivery?.updatedAt,
    nowMs
  );
  const confirmationContext = formatDeliveryContext(
    row.confirmationEmailDelivery,
    row.confirmationEmailDelivery?.updatedAt,
    nowMs
  );

  const hasRequestId = Boolean(row.bookingRequestId);
  const requestInFlight = cardActionState === "sending" || confirmActionState === "sending";

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
          {highestAttention !== "none" ? (
            <Badge
              variant="outline"
              className={cn("text-[10px] font-medium", getAttentionBadgeClass(highestAttention))}
            >
              {getAttentionLabel(highestAttention)}
            </Badge>
          ) : null}
          {row.cardRequestEmailDelivery ? (
            <span
              title={
                row.cardRequestEmailDelivery.status === "failed"
                  ? row.cardRequestEmailDelivery.errorMessage ?? undefined
                  : undefined
              }
            >
              <StatusBadge
                status={row.cardRequestEmailDelivery.status}
                label={emailStatusLabel("card", row.cardRequestEmailDelivery.status)}
                className="text-[10px]"
              />
            </span>
          ) : null}
          {row.confirmationEmailDelivery ? (
            <span
              title={
                row.confirmationEmailDelivery.status === "failed"
                  ? row.confirmationEmailDelivery.errorMessage ?? undefined
                  : undefined
              }
            >
              <StatusBadge
                status={row.confirmationEmailDelivery.status}
                label={emailStatusLabel("confirm", row.confirmationEmailDelivery.status)}
                className="text-[10px]"
              />
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <p>Card: {cardContext}</p>
        <p>Confirm: {confirmationContext}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button
          size="xs"
          variant="outline"
          disabled={!hasRequestId || requestInFlight}
          onClick={() => {
            if (!row.bookingRequestId || !onSendCardEmail) {
              return;
            }
            onSendCardEmail(row.bookingRequestId);
          }}
        >
          {actionLabel("Card email", cardActionState)}
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={
            !hasRequestId ||
            !confirmationEnabled ||
            requestInFlight
          }
          onClick={() => {
            if (!row.bookingRequestId || !onSendConfirmEmail) {
              return;
            }
            onSendConfirmEmail(row.bookingRequestId);
          }}
        >
          {actionLabel("Confirm email", confirmActionState)}
        </Button>

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
