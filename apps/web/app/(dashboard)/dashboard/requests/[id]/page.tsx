"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import PageHeader from "@/components/dashboard/PageHeader";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/dashboard/EmptyState";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getConfirmRequestLink } from "@/lib/bookingLinks";

/* ─── Helpers ───────────────────────────────────────────────── */

function formatDate(timestamp?: number) {
  if (!timestamp) return "---";
  return new Date(timestamp).toLocaleString();
}

function renderList(items?: string[] | null) {
  if (!items || items.length === 0) return "---";
  return items.join(", ");
}

function SectionNumber({ n }: { n: string }) {
  return (
    <span className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
      {n}
    </span>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  );
}

const statusIndicatorColors: Record<string, string> = {
  requested: "bg-amber-500",
  confirmed: "bg-blue-500",
};

/* ─── Main Page ─────────────────────────────────────────────── */

export default function RequestDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const requestId = params?.id as Id<"bookingRequests"> | undefined;
  const wasCreated = searchParams.get("created") === "1";
  const quoteMode = searchParams.get("quote_mode");
  const request = useQuery(
    api.bookingRequests.getById,
    requestId ? { id: requestId } : "skip"
  );
  const tallyLinks = useQuery(api.integrations.getTallyFormLinksForActiveOrganization, {});
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
  const sendCardRequestEmail = useAction(api.emailTriggers.sendCardRequestEmail);

  const [actionState, setActionState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [cardEmailState, setCardEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [confirmCopyState, setConfirmCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const canonicalBookingHandle = request?.canonicalBookingHandle ?? null;

  /* Guards */

  if (request === null) {
    return (
      <EmptyState
        title="Request not found"
        description="We couldn't locate this booking request."
      />
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading request...</p>
      </div>
    );
  }

  const indicatorColor = statusIndicatorColors[request.status] ?? "bg-gray-400";

  return (
    <div className="space-y-8">
      {wasCreated ? (
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          {quoteMode === "reused"
            ? "Request created and linked to an existing quote request."
            : "Request created and a new quote request was generated."}
        </div>
      ) : null}

      {/* Header */}
      <PageHeader
        title={request.contactDetails ?? "Booking Request"}
        subtitle={`Submitted ${formatDate(request.createdAt)}`}
      >
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/requests">
            <Button variant="outline" size="sm">Back to Requests</Button>
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <StatusBadge status={request.status} />
          {request.linkSentAt && (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">link sent</Badge>
          )}
          {request.confirmLinkSentAt && (
            <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400">confirm link sent</Badge>
          )}
        </div>
      </PageHeader>

      {/* Hero strip: Contact + quick stats */}
      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("h-3 w-3 shrink-0 rounded-full", indicatorColor)} />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <StatCell label="Email" value={request.email ?? "---"} />
              <StatCell label="Phone" value={request.phoneNumber ?? "---"} />
              <StatCell label="Access" value={renderList(request.accessMethod)} />
              <StatCell label="Pets" value={renderList(request.pets)} />
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              variant="outline"
              size="xs"
              disabled={!canonicalBookingHandle || cardEmailState === "sending"}
              onClick={async () => {
                if (!canonicalBookingHandle) {
                  setCardEmailState("error");
                  setTimeout(() => setCardEmailState("idle"), 2000);
                  return;
                }
                setCardEmailState("sending");
                try {
                  await sendCardRequestEmail({ requestId: request._id });
                  await markLinkSent({ requestId: request._id });
                  setCardEmailState("sent");
                  setTimeout(() => setCardEmailState("idle"), 2000);
                } catch (error) {
                  console.error(error);
                  setCardEmailState("error");
                  setTimeout(() => setCardEmailState("idle"), 2500);
                }
              }}
            >
              {cardEmailState === "sending"
                ? "Sending..."
                : cardEmailState === "sent"
                ? "Email sent"
                : cardEmailState === "error"
                ? "Failed"
                : "Card email"}
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={emailState === "sending" || !tallyLinks?.confirmationFormUrl}
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
                ? "Sent!"
                : emailState === "error"
                ? "Failed"
                : "Confirm email"}
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={!canonicalBookingHandle || !tallyLinks?.confirmationFormUrl}
              onClick={async () => {
                if (!canonicalBookingHandle) {
                  setConfirmCopyState("error");
                  setTimeout(() => setConfirmCopyState("idle"), 2000);
                  return;
                }
                const link = getConfirmRequestLink(
                  tallyLinks?.confirmationFormUrl ?? null,
                  request._id,
                  canonicalBookingHandle
                );
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
                ? "Unavailable"
                : "Copy link"}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Status strip */}
        <div className="flex flex-wrap items-center gap-6 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Floors</span>
            <span className="text-sm font-medium text-foreground">{renderList(request.floorTypes)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Time windows</span>
            <span className="text-sm font-medium text-foreground">{renderList(request.scheduleAdjustmentWindows)}</span>
          </div>
          {request.timingShiftOk && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Shift ok</span>
                <span className="text-sm font-medium text-foreground">{request.timingShiftOk}</span>
              </div>
            </>
          )}
          {!canonicalBookingHandle && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <span className="text-xs text-amber-700 dark:text-amber-400">Missing canonical org slug</span>
            </>
          )}
          {canonicalBookingHandle && !tallyLinks?.confirmationFormUrl && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <span className="text-xs text-amber-700 dark:text-amber-400">Complete Tally setup in Integrations</span>
            </>
          )}
        </div>
      </div>

      {/* Content sections */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* 01 · Access & Instructions */}
          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="flex items-start gap-2 p-5">
              <SectionNumber n="01" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Access & Instructions</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Entry details and parking information.
                </p>
              </div>
            </div>
            <Separator />
            <div className="space-y-3 p-5">
              <DetailRow label="Access instructions" value={request.accessInstructions ?? "---"} />
              <DetailRow label="Parking" value={request.parkingInstructions ?? "---"} />
            </div>
          </section>

          {/* 02 · Home Details */}
          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="flex items-start gap-2 p-5">
              <SectionNumber n="02" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Home Details</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Property characteristics and special considerations.
                </p>
              </div>
            </div>
            <Separator />
            <div className="space-y-3 p-5">
              <DetailRow label="Finished basement" value={request.finishedBasement ?? "---"} />
              <DetailRow label="Delicate surfaces" value={request.delicateSurfaces ?? "---"} />
              <DetailRow label="Attention areas" value={request.attentionAreas ?? "---"} />
              <DetailRow label="Home during cleanings" value={request.homeDuringCleanings ?? "---"} />
            </div>
          </section>

          {/* 03 · Notes */}
          {request.additionalNotes && (
            <section className="surface-card overflow-hidden rounded-2xl">
              <div className="flex items-start gap-2 p-5">
                <SectionNumber n="03" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Notes</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Additional notes from the customer.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="p-5">
                <p className="text-sm text-muted-foreground">{request.additionalNotes}</p>
              </div>
            </section>
          )}

          {/* Raw payloads */}
          <details className="surface-card overflow-hidden rounded-2xl">
            <summary className="cursor-pointer p-5 text-sm font-semibold text-foreground">
              Raw payloads
            </summary>
            <Separator />
            <div className="space-y-4 p-5 text-xs text-muted-foreground">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Request payload</p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono">
                  {JSON.stringify(request.rawRequestPayload ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Confirmation payload</p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono">
                  {JSON.stringify(request.rawConfirmationPayload ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Booking */}
          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between p-5">
              <h2 className="text-sm font-semibold text-foreground">Booking</h2>
              {request.bookingId ? (
                <Link
                  href={`/dashboard/bookings?bookingId=${request.bookingId}`}
                  className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                >
                  Open
                </Link>
              ) : (
                <Button
                  size="xs"
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
                  {actionState === "loading" ? "Creating..." : "Create"}
                </Button>
              )}
            </div>
            <Separator />
            <div className="space-y-3 p-5">
              <DetailRow label="Status" value={booking?.status?.replace(/_/g, " ") ?? "Not created"} />
              <DetailRow
                label="Amount"
                value={booking?.amount ? `$${(booking.amount / 100).toLocaleString()}` : "---"}
              />
              <DetailRow label="Service date" value={booking?.serviceDate ?? "---"} />
              {actionState === "success" && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Booking created successfully.</p>
              )}
              {actionState === "error" && (
                <p className="text-xs text-red-600 dark:text-red-400">Failed to create booking.</p>
              )}
            </div>
          </section>

          {/* Linked Quote */}
          {request.quoteRequestId && (
            <section className="surface-card overflow-hidden rounded-2xl">
              <div className="p-5">
                <h2 className="text-sm font-semibold text-foreground">Linked Quote</h2>
              </div>
              <Separator />
              <div className="space-y-3 p-5">
                {quote ? (
                  <>
                    <DetailRow
                      label="Name"
                      value={
                        quote.firstName || quote.lastName
                          ? `${quote.firstName ?? ""} ${quote.lastName ?? ""}`.trim()
                          : "---"
                      }
                    />
                    <DetailRow label="Email" value={quote.email ?? "---"} />
                    <DetailRow label="Service" value={quote.service ?? "---"} />
                    <DetailRow label="Sq ft" value={quote.squareFootage ? String(quote.squareFootage) : "---"} />
                    <DetailRow
                      label="Address"
                      value={[quote.address, quote.addressLine2].filter(Boolean).join(", ") || "---"}
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading quote...</p>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
