"use client";

import Link from "next/link";
import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Id } from "@clean-os/convex/data-model";
import { getConfirmRequestLink } from "@/lib/bookingLinks";
import { onboardingApi } from "@/lib/onboarding/api";
import { onboardingRequestPath } from "@/lib/onboarding/routes";

type RequestCardProps = {
  request: {
    _id: Id<"bookingRequests">;
    status: string;
    contactDetails?: string | null;
    email?: string | null;
    createdAt: number;
    accessMethod?: string[] | null;
    floorTypes?: string[] | null;
    pets?: string[] | null;
    organizationId?: Id<"organizations"> | null;
    bookingId?: Id<"bookings"> | null;
    bookingStatus?: string | null;
    canonicalBookingHandle?: string | null;
    linkSentAt?: number | null;
    confirmLinkSentAt?: number | null;
  };
  confirmationFormUrl?: string | null;
  className?: string;
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString();
}

const statusIndicatorColors: Record<string, string> = {
  requested: "bg-amber-500",
  confirmed: "bg-blue-500",
};

export default function RequestCard({ request, confirmationFormUrl, className }: RequestCardProps) {
  const [cardEmailState, setCardEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [confirmCopyState, setConfirmCopyState] = useState<"idle" | "copied" | "error">("idle");
  const markLinkSent = useMutation(onboardingApi.markLinkSent);
  const markConfirmLinkSent = useMutation(onboardingApi.markConfirmLinkSent);
  const sendCardRequestEmail = useAction(onboardingApi.sendCardRequestEmail);
  const canonicalBookingHandle = request.canonicalBookingHandle ?? null;
  const name = request.contactDetails || "Unknown contact";
  const email = request.email || "No email";

  const tags = [
    ...(request.accessMethod ?? []).map((value) => `Access: ${value}`),
    ...(request.floorTypes ?? []).map((value) => `Floors: ${value}`),
    ...(request.pets ?? []).map((value) => `Pets: ${value}`),
  ].slice(0, 3);

  async function sendCardRequest(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canonicalBookingHandle) {
      setCardEmailState("error");
      setTimeout(() => setCardEmailState("idle"), 2000);
      return;
    }
    try {
      setCardEmailState("sending");
      await sendCardRequestEmail({ requestId: request._id });
      await markLinkSent({ requestId: request._id });
      setCardEmailState("sent");
      setTimeout(() => setCardEmailState("idle"), 2000);
    } catch (error) {
      console.error(error);
      setCardEmailState("error");
      setTimeout(() => setCardEmailState("idle"), 2500);
    }
  }

  async function copyConfirmLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canonicalBookingHandle) {
      setConfirmCopyState("error");
      setTimeout(() => setConfirmCopyState("idle"), 2000);
      return;
    }
    const link = getConfirmRequestLink(confirmationFormUrl, request._id, canonicalBookingHandle);
    if (!link) {
      setConfirmCopyState("error");
      setTimeout(() => setConfirmCopyState("idle"), 2000);
      return;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = link;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      await markConfirmLinkSent({ requestId: request._id });
      setConfirmCopyState("copied");
      setTimeout(() => setConfirmCopyState("idle"), 1500);
    } catch (error) {
      console.error(error);
      setConfirmCopyState("error");
      setTimeout(() => setConfirmCopyState("idle"), 2000);
    }
  }

  const indicatorColor = statusIndicatorColors[request.status] ?? "bg-gray-400";

  return (
    <Link
      href={onboardingRequestPath(request._id)}
      className={cn(
        "group flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3 transition-all hover:border-border hover:bg-muted/30",
        className,
      )}
    >
      {/* Status indicator dot */}
      <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", indicatorColor)} />

      {/* Name & email */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>

      {/* Tags */}
      <div className="hidden items-center gap-1.5 lg:flex">
        {tags.map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px] font-normal text-muted-foreground">
            {tag}
          </Badge>
        ))}
      </div>

      {/* Date + tracking */}
      <div className="hidden text-right sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Submitted</p>
        <p className="font-mono text-xs font-medium text-foreground">{formatDate(request.createdAt)}</p>
      </div>

      {/* Badges */}
      <div className="flex shrink-0 items-center gap-1.5">
        <StatusBadge status={request.status} />
        {request.bookingId && (
          <Badge variant="outline" className="text-[10px]">Booking</Badge>
        )}
        {request.linkSentAt && (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px]">sent</Badge>
        )}
        {request.confirmLinkSentAt && (
          <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400 text-[10px]">confirmed</Badge>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="xs"
          variant="ghost"
          onClick={sendCardRequest}
          disabled={!canonicalBookingHandle || cardEmailState === "sending"}
          className="text-[10px]"
        >
          {cardEmailState === "sending" ? "..." : cardEmailState === "sent" ? "Sent" : cardEmailState === "error" ? "Err" : "Card"}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={copyConfirmLink}
          disabled={!canonicalBookingHandle || !confirmationFormUrl}
          className="text-[10px]"
        >
          {confirmCopyState === "copied" ? "OK" : confirmCopyState === "error" ? "Err" : "Link"}
        </Button>
      </div>

      {/* Arrow */}
      <svg className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
