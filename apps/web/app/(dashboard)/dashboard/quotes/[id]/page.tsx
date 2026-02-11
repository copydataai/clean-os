"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import PageHeader from "@/components/dashboard/PageHeader";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/dashboard/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function formatCurrency(cents?: number | null, currency = "usd"): string {
  if (!cents && cents !== 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(timestamp?: number | null): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString();
}

function statusLabel(status?: string, isExpired?: boolean): string {
  if (isExpired && status === "sent") return "expired";
  return status ?? "draft";
}

function reminderStageLabel(stage: string): string {
  if (stage === "r1_24h") return "24h Reminder";
  if (stage === "r2_72h") return "72h Reminder";
  if (stage === "r3_pre_expiry") return "Pre-expiry Reminder";
  if (stage === "manual") return "Manual Reminder";
  return stage;
}

function reminderStatusClass(status: string): string {
  if (status === "sent") return "bg-emerald-100 text-emerald-700";
  if (status === "failed" || status === "missing_context") return "bg-red-100 text-red-700";
  if (status === "suppressed") return "bg-orange-100 text-orange-700";
  if (status === "skipped") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

export default function QuoteDetailPage() {
  const params = useParams();
  const quoteRequestId = params?.id as Id<"quoteRequests"> | undefined;

  const detail = useQuery(
    api.quotes.getQuoteDetailByRequestId,
    quoteRequestId ? { quoteRequestId } : "skip"
  );
  const createDraft = useMutation(api.quotes.ensureDraftFromRequest);
  const refreshExpiryStatus = useMutation(api.quotes.refreshExpiryStatus);
  const saveDraft = useMutation(api.quotes.saveDraftRevision);
  const sendRevision = useAction(api.quotes.sendRevision);
  const retryRevision = useAction(api.quotes.retrySendRevision);
  const sendManualReminder = useAction(api.quotes.sendManualReminder);
  const reminderTimeline = useQuery(
    api.quotes.getQuoteReminderTimeline,
    quoteRequestId ? { quoteRequestId } : "skip"
  );
  const tallyLinks = useQuery(api.integrations.getTallyFormLinksForActiveOrganization, {});

  const [ensureState, setEnsureState] = useState<"idle" | "creating">("idle");
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [retryState, setRetryState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [quickActionState, setQuickActionState] = useState<
    "idle" | "sending_reminder" | "reminder_sent" | "copied" | "error"
  >("idle");
  const [quickActionMessage, setQuickActionMessage] = useState<string>("");
  const [selectedRevisionId, setSelectedRevisionId] = useState<Id<"quoteRevisions"> | null>(
    null
  );

  const [serviceLabel, setServiceLabel] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPriceDollars, setUnitPriceDollars] = useState("0");
  const [taxName, setTaxName] = useState("Colorado");
  const [taxRatePct, setTaxRatePct] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!quoteRequestId || !detail || detail.quote || ensureState === "creating") {
      return;
    }
    setEnsureState("creating");
    createDraft({ quoteRequestId })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setEnsureState("idle");
      });
  }, [createDraft, detail, ensureState, quoteRequestId]);

  useEffect(() => {
    if (!quoteRequestId || !detail?.quote || detail.quote.status !== "sent") {
      return;
    }
    refreshExpiryStatus({ quoteRequestId }).catch((error) => {
      console.error(error);
    });
  }, [detail?.quote?._id, detail?.quote?.status, quoteRequestId, refreshExpiryStatus]);

  useEffect(() => {
    const revision = detail?.currentRevision;
    if (!revision) return;
    setServiceLabel(revision.serviceLabel ?? "");
    setDescription(revision.description ?? "");
    setQuantity(String(revision.quantity ?? 1));
    setUnitPriceDollars(((revision.unitPriceCents ?? 0) / 100).toFixed(2));
    setTaxName(revision.taxName ?? "Colorado");
    setTaxRatePct(((revision.taxRateBps ?? 0) / 100).toFixed(2));
    setNotes(revision.notes ?? "");
    setSelectedRevisionId(revision._id);
  }, [detail?.currentRevision?._id]);

  const selectedRevision = useMemo(() => {
    if (!detail?.revisions?.length) return null;
    if (!selectedRevisionId) return detail.currentRevision ?? detail.revisions[0];
    return detail.revisions.find((revision) => revision._id === selectedRevisionId) ?? null;
  }, [detail?.currentRevision, detail?.revisions, selectedRevisionId]);

  const pdfUrl = useQuery(
    api.quotes.getRevisionPdfUrl,
    selectedRevision?._id ? { revisionId: selectedRevision._id } : "skip"
  );
  const bookingRequestId = detail?.quote?.bookingRequestId ?? detail?.quoteRequest?.bookingRequestId;
  const confirmBaseUrl = tallyLinks?.confirmationFormUrl?.trim() ?? "";
  const confirmUrl = useMemo(() => {
    if (!confirmBaseUrl || !bookingRequestId) return null;
    try {
      const url = new URL(confirmBaseUrl);
      url.searchParams.set("request_id", bookingRequestId);
      return url.toString();
    } catch {
      return null;
    }
  }, [bookingRequestId, confirmBaseUrl]);

  const currentStatus = statusLabel(detail?.quote?.status, detail?.isExpired);

  if (!quoteRequestId) {
    return (
      <EmptyState title="Invalid quote request" description="Missing quote request id." />
    );
  }

  if (!detail) {
    return (
      <div className="surface-card p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">Loading quote detail...</p>
      </div>
    );
  }

  if (!detail.quoteRequest) {
    return (
      <EmptyState title="Quote request not found" description="No quote request was found." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Quote Request ${detail.quoteRequest._id}`}
        subtitle={detail.quote ? `Quote #${detail.quote.quoteNumber}` : "Creating draft quote..."}
      >
        <div className="flex items-center gap-2">
          <StatusBadge status={currentStatus} />
          <Link href="/dashboard/quotes/pricing">
            <Button variant="outline" size="sm">
              Pricing Rules
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Customer / Request Summary</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-muted-foreground">
              <p>
                Name:{" "}
                {[detail.quoteRequest.firstName, detail.quoteRequest.lastName]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </p>
              <p>Email: {detail.quoteRequest.email ?? "—"}</p>
              <p>Service: {detail.quoteRequest.serviceType ?? detail.quoteRequest.service ?? "—"}</p>
              <p>Frequency: {detail.quoteRequest.frequency ?? "—"}</p>
              <p>Square footage: {detail.quoteRequest.squareFootage ?? "—"}</p>
              <p>
                Suggested price:{" "}
                {detail.pricingSuggestion?.priceCents !== null
                  ? formatCurrency(detail.pricingSuggestion?.priceCents, "usd")
                  : "No rule match"}
              </p>
              <p className="sm:col-span-2">
                Address: {detail.quoteRequest.address ?? "—"} {detail.quoteRequest.addressLine2 ?? ""}
                {detail.quoteRequest.city ? `, ${detail.quoteRequest.city}` : ""}
                {detail.quoteRequest.state ? `, ${detail.quoteRequest.state}` : ""}{" "}
                {detail.quoteRequest.postalCode ?? ""}
              </p>
            </div>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Quote Pricing Editor</h2>
            {!detail.currentRevision ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {ensureState === "creating"
                  ? "Creating draft revision..."
                  : "No draft revision yet."}
              </p>
            ) : (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="serviceLabel">Service Label</Label>
                    <Input
                      id="serviceLabel"
                      value={serviceLabel}
                      onChange={(e) => setServiceLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      value={quantity}
                      type="number"
                      min="1"
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unitPrice">Unit Price (USD)</Label>
                    <Input
                      id="unitPrice"
                      value={unitPriceDollars}
                      type="number"
                      min="0"
                      step="0.01"
                      onChange={(e) => setUnitPriceDollars(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxName">Tax Name</Label>
                    <Input
                      id="taxName"
                      value={taxName}
                      onChange={(e) => setTaxName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxRate">Tax Rate (%)</Label>
                    <Input
                      id="taxRate"
                      value={taxRatePct}
                      type="number"
                      min="0"
                      step="0.01"
                      onChange={(e) => setTaxRatePct(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    rows={6}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Internal Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    rows={3}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={submitState === "saving"}
                    onClick={async () => {
                      if (!quoteRequestId) return;
                      setSubmitState("saving");
                      try {
                        await saveDraft({
                          quoteRequestId,
                          source: "manual_override",
                          serviceLabel,
                          description,
                          quantity: Number.parseInt(quantity || "1", 10),
                          unitPriceCents: Math.round(
                            Number.parseFloat(unitPriceDollars || "0") * 100
                          ),
                          taxName,
                          taxRateBps: Math.round(Number.parseFloat(taxRatePct || "0") * 100),
                          notes: notes.trim() || undefined,
                        });
                        setSubmitState("saved");
                        setTimeout(() => setSubmitState("idle"), 2000);
                      } catch (error) {
                        console.error(error);
                        setSubmitState("error");
                        setTimeout(() => setSubmitState("idle"), 2500);
                      }
                    }}
                  >
                    {submitState === "saving" ? "Saving..." : "Save Draft Revision"}
                  </Button>

                  <Button
                    disabled={sendState === "sending" || !detail.currentRevision}
                    onClick={async () => {
                      if (!quoteRequestId || !detail.currentRevision) return;
                      setSendState("sending");
                      try {
                        await sendRevision({
                          quoteRequestId,
                          revisionId: detail.currentRevision._id,
                        });
                        setSendState("sent");
                        setTimeout(() => setSendState("idle"), 2500);
                      } catch (error) {
                        console.error(error);
                        setSendState("error");
                        setTimeout(() => setSendState("idle"), 3000);
                      }
                    }}
                  >
                    {sendState === "sending" ? "Sending..." : "Send Quote"}
                  </Button>

                  {selectedRevision?.sendStatus === "failed" ? (
                    <Button
                      variant="outline"
                      disabled={retryState === "sending"}
                      onClick={async () => {
                        if (!quoteRequestId || !selectedRevision) return;
                        setRetryState("sending");
                        try {
                          await retryRevision({
                            quoteRequestId,
                            revisionId: selectedRevision._id,
                          });
                          setRetryState("sent");
                          setTimeout(() => setRetryState("idle"), 2500);
                        } catch (error) {
                          console.error(error);
                          setRetryState("error");
                          setTimeout(() => setRetryState("idle"), 3000);
                        }
                      }}
                    >
                      {retryState === "sending" ? "Retrying..." : "Retry Send"}
                    </Button>
                  ) : null}
                </div>

                {submitState === "saved" ? (
                  <p className="text-sm text-emerald-600">Draft revision saved.</p>
                ) : null}
                {submitState === "error" ? (
                  <p className="text-sm text-red-600">Failed to save draft revision.</p>
                ) : null}
                {sendState === "sent" ? (
                  <p className="text-sm text-emerald-600">Quote sent successfully.</p>
                ) : null}
                {sendState === "error" ? (
                  <p className="text-sm text-red-600">Failed to send quote.</p>
                ) : null}
                {retryState === "sent" ? (
                  <p className="text-sm text-emerald-600">Quote resend succeeded.</p>
                ) : null}
                {retryState === "error" ? (
                  <p className="text-sm text-red-600">Quote resend failed.</p>
                ) : null}
                {quickActionState !== "idle" ? (
                  <p
                    className={`text-sm ${
                      quickActionState === "error" ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {quickActionMessage}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Quote State</h2>
            {detail.quote ? (
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>Status: {currentStatus}</p>
                <p>Quote number: #{detail.quote.quoteNumber}</p>
                <p>Sent at: {formatDate(detail.quote.sentAt)}</p>
                <p>Expires at: {formatDate(detail.quote.expiresAt)}</p>
                <p>Accepted at: {formatDate(detail.quote.acceptedAt)}</p>
                <p>Requires review: {detail.quote.requiresReview ? "Yes" : "No"}</p>
                {detail.quote.reviewReason ? <p>Review reason: {detail.quote.reviewReason}</p> : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Draft quote pending creation.</p>
            )}
          </div>

          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Quick Follow-up Actions</h2>
            {!tallyLinks?.confirmationFormUrl ? (
              <p className="mt-2 text-xs text-amber-700">
                Confirm link actions are unavailable until Tally setup is complete in Integrations.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!detail.quote || detail.quote.status !== "sent" || quickActionState === "sending_reminder"}
                onClick={async () => {
                  if (!quoteRequestId) return;
                  setQuickActionState("sending_reminder");
                  setQuickActionMessage("");
                  try {
                    const result = await sendManualReminder({ quoteRequestId });
                    setQuickActionState("reminder_sent");
                    setQuickActionMessage(
                      result.status === "sent"
                        ? "Manual reminder sent."
                        : `Manual reminder recorded as ${result.status}.`
                    );
                  } catch (error) {
                    setQuickActionState("error");
                    setQuickActionMessage(
                      error instanceof Error ? error.message : "Failed to send manual reminder."
                    );
                  } finally {
                    setTimeout(() => setQuickActionState("idle"), 3000);
                  }
                }}
              >
                {quickActionState === "sending_reminder" ? "Sending Reminder..." : "Send Reminder Now"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!confirmUrl}
                onClick={async () => {
                  if (!confirmUrl) return;
                  try {
                    await navigator.clipboard.writeText(confirmUrl);
                    setQuickActionState("copied");
                    setQuickActionMessage("Confirmation link copied.");
                    setTimeout(() => setQuickActionState("idle"), 2000);
                  } catch {
                    setQuickActionState("error");
                    setQuickActionMessage("Failed to copy confirmation link.");
                    setTimeout(() => setQuickActionState("idle"), 2500);
                  }
                }}
              >
                Copy Confirm Link
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!pdfUrl}
                onClick={async () => {
                  if (!pdfUrl) return;
                  try {
                    await navigator.clipboard.writeText(pdfUrl);
                    setQuickActionState("copied");
                    setQuickActionMessage("PDF link copied.");
                    setTimeout(() => setQuickActionState("idle"), 2000);
                  } catch {
                    setQuickActionState("error");
                    setQuickActionMessage("Failed to copy PDF link.");
                    setTimeout(() => setQuickActionState("idle"), 2500);
                  }
                }}
              >
                Copy PDF Link
              </Button>
            </div>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Reminder Timeline</h2>
            {!reminderTimeline ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading reminders...</p>
            ) : reminderTimeline.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No reminder events yet.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {reminderTimeline.map((event) => (
                  <div key={event._id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {reminderStageLabel(event.stage)}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${reminderStatusClass(event.status)}`}
                      >
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Source: {event.triggerSource} · {formatDate(event.sentAt ?? event.createdAt)}
                    </p>
                    {event.errorMessage ? (
                      <p className="mt-1 text-xs text-red-600">{event.errorMessage}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Revision History</h2>
            {detail.revisions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No revisions yet.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {detail.revisions.map((revision) => (
                  <button
                    key={revision._id}
                    type="button"
                    onClick={() => setSelectedRevisionId(revision._id)}
                    className={`w-full rounded-lg border p-3 text-left ${
                      selectedRevisionId === revision._id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">
                      Revision #{revision.revisionNumber}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCurrency(revision.totalCents, revision.currency)} · {revision.sendStatus}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(revision.createdAt)}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedRevision ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!pdfUrl}
                  onClick={() => {
                    if (pdfUrl) {
                      window.open(pdfUrl, "_blank");
                    }
                  }}
                >
                  Preview PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!pdfUrl}
                  onClick={() => {
                    if (pdfUrl) {
                      window.location.href = pdfUrl;
                    }
                  }}
                >
                  Download PDF
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
