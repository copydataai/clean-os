"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Id } from "@clean-os/convex/data-model";
import { getBookingRequestLink, getConfirmRequestLink } from "@/lib/bookingLinks";

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
    linkSentAt?: number | null;
    confirmLinkSentAt?: number | null;
  };
  className?: string;
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

function renderTag(label: string) {
  return <Badge className="bg-muted text-muted-foreground">{label}</Badge>;
}

export default function RequestCard({ request, className }: RequestCardProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [confirmCopyState, setConfirmCopyState] = useState<"idle" | "copied" | "error">("idle");
  const markLinkSent = useMutation(api.bookingRequests.markLinkSent);
  const markConfirmLinkSent = useMutation(api.bookingRequests.markConfirmLinkSent);
  const organizations = useQuery(api.queries.getUserOrganizations);
  const orgHandle =
    organizations?.find((org) => org?._id === request.organizationId)?.slug ??
    organizations?.find((org) => org?._id === request.organizationId)?.clerkId ??
    null;
  const name = request.contactDetails || "Unknown contact";
  const email = request.email || "No email";
  const tags = [
    ...(request.accessMethod ?? []).map((value) => `Access: ${value}`),
    ...(request.floorTypes ?? []).map((value) => `Floors: ${value}`),
    ...(request.pets ?? []).map((value) => `Pets: ${value}`),
  ].slice(0, 4);

  async function copyBookingLink() {
    if (!orgHandle) {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2000);
      return;
    }
    const link = getBookingRequestLink(request._id, orgHandle);
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
      await markLinkSent({ requestId: request._id });
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch (error) {
      console.error(error);
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  async function copyConfirmLink() {
    if (!orgHandle) {
      setConfirmCopyState("error");
      setTimeout(() => setConfirmCopyState("idle"), 2000);
      return;
    }
    const link = getConfirmRequestLink(request._id, orgHandle);
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

  return (
    <div className={cn("surface-card p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-medium text-foreground">{name}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(request.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={request.status} />
          {request.bookingId ? (
            <StatusBadge status={request.bookingStatus ?? "booking_created"} label="booking linked" />
          ) : null}
          {request.linkSentAt ? (
            <Badge className="bg-emerald-100 text-emerald-700">link sent</Badge>
          ) : null}
          {request.confirmLinkSentAt ? (
            <Badge className="bg-sky-100 text-sky-700">confirm link sent</Badge>
          ) : null}
        </div>
      </div>

      {tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag}>{renderTag(tag)}</span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Request ID: {request._id}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" onClick={copyBookingLink} disabled={!orgHandle}>
            {copyState === "copied"
              ? "Copied"
              : copyState === "error"
              ? "Copy failed"
              : "Copy booking link"}
          </Button>
          <Button size="sm" variant="outline" onClick={copyConfirmLink} disabled={!orgHandle}>
            {confirmCopyState === "copied"
              ? "Copied"
              : confirmCopyState === "error"
              ? "Missing confirm URL"
              : "Copy confirm link"}
          </Button>
          <Link
            href={`/dashboard/requests/${request._id}`}
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            View
          </Link>
        </div>
        {!orgHandle ? (
          <p className="text-xs text-amber-700">
            Missing organization public handle. Add a slug to generate organization-safe links.
          </p>
        ) : null}
      </div>
    </div>
  );
}
