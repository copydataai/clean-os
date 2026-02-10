"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import PageHeader from "@/components/dashboard/PageHeader";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import EmptyState from "@/components/dashboard/EmptyState";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getBookingRequestLink, getConfirmRequestLink } from "@/lib/bookingLinks";
import { useActiveOrganization } from "@/components/org/useActiveOrganization";

function formatDate(timestamp?: number) {
  if (!timestamp) {
    return "Unknown date";
  }
  return new Date(timestamp).toLocaleString();
}

function renderList(items?: string[] | null) {
  if (!items || items.length === 0) {
    return "—";
  }
  return items.join(", ");
}

export default function RequestDetailPage() {
  const params = useParams();
  const requestId = params?.id as Id<"bookingRequests"> | undefined;
  const request = useQuery(
    api.bookingRequests.getById,
    requestId ? { id: requestId } : "skip"
  );
  const { activeOrg } = useActiveOrganization();
  const booking = useQuery(
    api.bookings.getBooking,
    request?.bookingId ? { id: request.bookingId } : "skip"
  );
  const quote = useQuery(
    api.quoteRequests.getById,
    request?.quoteRequestId ? { id: request.quoteRequestId } : "skip"
  );
  const createBooking = useMutation(api.bookings.createBookingFromRequest);
  const markLinkSent = useMutation(api.bookingRequests.markLinkSent);
  const markConfirmLinkSent = useMutation(api.bookingRequests.markConfirmLinkSent);
  const sendConfirmEmail = useAction(api.emailTriggers.sendConfirmationEmail);

  const [actionState, setActionState] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [confirmCopyState, setConfirmCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const quickSummary = useMemo(() => {
    if (!request) {
      return null;
    }
    return [
      { label: "Email", value: request.email ?? "—" },
      { label: "Phone", value: request.phoneNumber ?? "—" },
      { label: "Access", value: renderList(request.accessMethod) },
      { label: "Floors", value: renderList(request.floorTypes) },
      { label: "Pets", value: renderList(request.pets) },
    ];
  }, [request]);

  const orgHandle = activeOrg?.slug ?? null;

  if (request === null) {
    return (
      <EmptyState
        title="Request not found"
        description="We couldn’t locate this booking request."
      />
    );
  }

  if (!request) {
    return (
      <div className="surface-card p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">Loading request...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.contactDetails ?? "Booking Request"}
        subtitle={`Submitted ${formatDate(request.createdAt)}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={request.status} />
          {request.linkSentAt ? (
            <Badge className="bg-emerald-100 text-emerald-700">link sent</Badge>
          ) : null}
          {request.confirmLinkSentAt ? (
            <Badge className="bg-sky-100 text-sky-700">confirm link sent</Badge>
          ) : null}
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground">Request Overview</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {quickSummary?.map((item) => (
              <div key={item.label} className="surface-soft p-4">
                <p className="text-xs uppercase text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Access & Instructions</h3>
              <p className="mt-2 text-sm text-muted-foreground">{request.accessInstructions ?? "—"}</p>
              <p className="mt-2 text-sm text-muted-foreground">Parking: {request.parkingInstructions ?? "—"}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Home Details</h3>
              <p className="mt-2 text-sm text-muted-foreground">Finished basement: {request.finishedBasement ?? "—"}</p>
              <p className="mt-2 text-sm text-muted-foreground">Delicate surfaces: {request.delicateSurfaces ?? "—"}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Scheduling Preferences</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Time windows: {renderList(request.scheduleAdjustmentWindows)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Open to shifts: {request.timingShiftOk ?? "—"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Notes</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {request.additionalNotes ?? request.attentionAreas ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Actions</h2>
            <div className="mt-4 space-y-3">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const link = getBookingRequestLink(request._id, orgHandle);
                  if (!link) {
                    setCopyState("error");
                    setTimeout(() => setCopyState("idle"), 2000);
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
                    await markLinkSent({ requestId: request._id });
                    setCopyState("copied");
                    setTimeout(() => setCopyState("idle"), 1500);
                  } catch (error) {
                    console.error(error);
                    setCopyState("error");
                    setTimeout(() => setCopyState("idle"), 2000);
                  }
                }}
              >
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "error"
                  ? "Copy failed"
                  : "Copy booking link"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={emailState === "sending"}
                onClick={async () => {
                  setEmailState("sending");
                  try {
                    await sendConfirmEmail({ requestId: request._id });
                    setEmailState("sent");
                    setTimeout(() => setEmailState("idle"), 3000);
                  } catch (error) {
                    console.error(error);
                    setEmailState("error");
                    setTimeout(() => setEmailState("idle"), 3000);
                  }
                }}
              >
                {emailState === "sending"
                  ? "Sending..."
                  : emailState === "sent"
                  ? "Email sent!"
                  : emailState === "error"
                  ? "Failed to send"
                  : "Send confirmation email"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!orgHandle}
                onClick={async () => {
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
                }}
              >
                {confirmCopyState === "copied"
                  ? "Copied"
                  : confirmCopyState === "error"
                  ? "Missing confirm URL"
                  : "Copy confirm link"}
              </Button>
              {request.bookingId ? (
                <Link
                  href={`/dashboard/bookings?bookingId=${request.bookingId}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Open booking
                </Link>
              ) : (
                <Button
                  size="sm"
                  onClick={async () => {
                    setActionState("loading");
                    try {
                      await createBooking({ requestId: request._id });
                      setActionState("success");
                    } catch (error) {
                      console.error(error);
                      setActionState("error");
                    }
                  }}
                  disabled={actionState === "loading"}
                >
                  {actionState === "loading" ? "Creating..." : "Create booking"}
                </Button>
              )}
              {actionState === "success" ? (
                <p className="text-xs text-green-600">Booking created successfully.</p>
              ) : null}
              {actionState === "error" ? (
                <p className="text-xs text-red-600">Failed to create booking.</p>
              ) : null}
              {!orgHandle ? (
                <p className="text-xs text-amber-700">
                  Missing organization public handle. Add a slug to safely generate customer links.
                </p>
              ) : null}
            </div>
          </div>

          {request.quoteRequestId ? (
            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Linked Quote</h2>
              {quote ? (
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <p>
                    Name:{" "}
                    {quote.firstName || quote.lastName
                      ? `${quote.firstName ?? ""} ${quote.lastName ?? ""}`.trim()
                      : "—"}
                  </p>
                  <p>Email: {quote.email ?? "—"}</p>
                  <p>Service: {quote.service ?? "—"}</p>
                  <p>Sqft: {quote.squareFootage ?? "—"}</p>
                  <p>Address: {quote.address ?? "—"} {quote.addressLine2 ?? ""}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Loading quote...</p>
              )}
            </div>
          ) : null}

          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Booking Status</h2>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>Status: {booking?.status ?? "Not created"}</p>
              <p>Amount: {booking?.amount ? `$${(booking.amount / 100).toLocaleString()}` : "—"}</p>
              <p>Service date: {booking?.serviceDate ?? "—"}</p>
            </div>
          </div>

          <details className="surface-card p-6">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Raw payloads
            </summary>
            <div className="mt-4 space-y-4 text-xs text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Request payload</p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-3">
                  {JSON.stringify(request.rawRequestPayload ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="font-medium text-foreground">Confirmation payload</p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-3">
                  {JSON.stringify(request.rawConfirmationPayload ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
