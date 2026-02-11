"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import PageHeader from "@/components/dashboard/PageHeader";
import CleanerStatusBadge from "@/components/cleaners/CleanerStatusBadge";
import CleanerForm from "@/components/cleaners/CleanerForm";
import AvailabilityEditor from "@/components/cleaners/AvailabilityEditor";
import TimeOffList from "@/components/cleaners/TimeOffList";
import AssignmentList from "@/components/cleaners/AssignmentList";
import CleanerInsightsHeader from "@/components/cleaners/CleanerInsightsHeader";
import SkillsManager from "@/components/cleaners/SkillsManager";
import ServiceQualificationsManager from "@/components/cleaners/ServiceQualificationsManager";
import PayRatePanel from "@/components/cleaners/PayRatePanel";
import RatingsInsightsPanel from "@/components/cleaners/RatingsInsightsPanel";
import EmptyState from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { computeReadinessInsights } from "@/lib/cleanerInsights";

/* ─── Helpers ───────────────────────────────────────────────── */

function formatDate(timestamp?: number | null) {
  if (!timestamp) return "---";
  return new Date(timestamp).toLocaleDateString();
}

function formatRating(rating?: number | null): string {
  if (!rating) return "---";
  return rating.toFixed(1);
}

function SectionNumber({ n }: { n: string }) {
  return (
    <span className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
      {n}
    </span>
  );
}

function StatCell({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-sm font-medium text-foreground", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

const avatarColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  onboarding: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  applicant: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  inactive: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  terminated: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

/* ─── Main Page ─────────────────────────────────────────────── */

export default function CleanerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cleanerId = params?.id as Id<"cleaners"> | undefined;

  const cleaner = useQuery(api.cleaners.getWithDetails, cleanerId ? { cleanerId } : "skip");
  const assignments = useQuery(api.cleaners.getAssignments, cleanerId ? { cleanerId } : "skip");
  const timeOff = useQuery(api.cleaners.getTimeOffRequests, cleanerId ? { cleanerId } : "skip");
  const ratingsSummary = useQuery(api.cleaners.getRatingsSummary, cleanerId ? { cleanerId } : "skip");
  const updateCleaner = useMutation(api.cleaners.update);
  const requestTimeOff = useMutation(api.cleaners.requestTimeOff);

  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isTimeOffSheetOpen, setIsTimeOffSheetOpen] = useState(false);
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);

  const [timeOffStartDate, setTimeOffStartDate] = useState("");
  const [timeOffEndDate, setTimeOffEndDate] = useState("");
  const [timeOffType, setTimeOffType] = useState("personal");
  const [timeOffReason, setTimeOffReason] = useState("");
  const [isSubmittingTimeOff, setIsSubmittingTimeOff] = useState(false);

  const [newStatus, setNewStatus] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handleTimeOffSubmit = async () => {
    if (!cleanerId || !timeOffStartDate || !timeOffEndDate) return;
    setIsSubmittingTimeOff(true);
    try {
      await requestTimeOff({
        cleanerId,
        startDate: timeOffStartDate,
        endDate: timeOffEndDate,
        timeOffType,
        reason: timeOffReason || undefined,
      });
      setIsTimeOffSheetOpen(false);
      setTimeOffStartDate("");
      setTimeOffEndDate("");
      setTimeOffType("personal");
      setTimeOffReason("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingTimeOff(false);
    }
  };

  const handleStatusChange = async () => {
    if (!cleanerId || !newStatus) return;
    setIsUpdatingStatus(true);
    try {
      await updateCleaner({ cleanerId, status: newStatus });
      setIsStatusSheetOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  /* Guards */

  if (cleaner === null) {
    return (
      <EmptyState
        title="Cleaner not found"
        description="This cleaner profile could not be located."
        action={<Button onClick={() => router.push("/dashboard/cleaners")}>Back to Roster</Button>}
      />
    );
  }

  if (!cleaner) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  const fullName = `${cleaner.firstName} ${cleaner.lastName}`;
  const initials = `${cleaner.firstName.charAt(0)}${cleaner.lastName.charAt(0)}`.toUpperCase();
  const colorClass = avatarColors[cleaner.status] ?? "bg-muted text-muted-foreground";
  const readinessInsights = computeReadinessInsights({
    serviceQualifications: cleaner.serviceTypes ?? [],
    hasActivePayRate: Boolean(cleaner.activePayRate),
    ratingHealth: {
      average: ratingsSummary?.average ?? null,
      delta30d: ratingsSummary?.delta30d ?? null,
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader title={fullName} subtitle={`Added ${formatDate(cleaner.createdAt)}`}>
        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/cleaners">
            <Button variant="outline" size="sm">Back to Roster</Button>
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <CleanerStatusBadge status={cleaner.status} />
        </div>
      </PageHeader>

      {/* Hero strip: Avatar + metrics + actions */}
      <div className="surface-card overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold", colorClass)}>
              {initials}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <StatCell label="Email" value={cleaner.email} />
              <StatCell label="Phone" value={cleaner.phone ?? "---"} />
              <StatCell label="Type" value={cleaner.employmentType} />
              <StatCell label="Started" value={cleaner.startDate ?? "---"} mono />
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button variant="outline" size="xs" onClick={() => setIsEditSheetOpen(true)}>
              Edit
            </Button>
            <Button variant="outline" size="xs" onClick={() => setIsTimeOffSheetOpen(true)}>
              Time Off
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => { setNewStatus(cleaner.status); setIsStatusSheetOpen(true); }}
            >
              Status
            </Button>
          </div>
        </div>

        <Separator />

        {/* Performance strip */}
        <div className="flex flex-wrap items-center gap-6 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Rating</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {formatRating(cleaner.averageRating)}
            </span>
            {cleaner.totalRatingsCount ? (
              <span className="text-[10px] text-muted-foreground">
                ({cleaner.totalRatingsCount} reviews)
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Jobs</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {cleaner.totalJobsCompleted ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Reliability</span>
            <span className={cn(
              "font-mono text-sm font-semibold",
              (cleaner.reliabilityScore ?? 100) >= 90 ? "text-emerald-600 dark:text-emerald-400"
                : (cleaner.reliabilityScore ?? 100) >= 70 ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400",
            )}>
              {cleaner.reliabilityScore ?? 100}%
            </span>
          </div>
          {cleaner.bio && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <p className="flex-1 truncate text-xs text-muted-foreground">{cleaner.bio}</p>
            </>
          )}
        </div>
      </div>

      {/* Readiness insights */}
      <CleanerInsightsHeader insights={readinessInsights} />

      {/* Content sections */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* 01 · Profile & Address */}
          {(cleaner.address?.street || cleaner.address?.city || cleaner.address?.state) && (
            <section className="surface-card overflow-hidden rounded-2xl">
              <div className="flex items-start gap-2 p-5">
                <SectionNumber n="01" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Address</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[cleaner.address?.street, cleaner.address?.city, cleaner.address?.state, cleaner.address?.postalCode]
                      .filter(Boolean)
                      .join(", ") || "---"}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* 02 · Availability */}
          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="flex items-start gap-2 p-5">
              <SectionNumber n="02" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Weekly Availability</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Schedule blocks used for assignment matching.
                </p>
              </div>
            </div>
            <Separator />
            <div className="p-5">
              <AvailabilityEditor cleanerId={cleaner._id} availability={cleaner.availability ?? []} />
            </div>
          </section>

          {/* 03 · Skills */}
          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="flex items-start gap-2 p-5">
              <SectionNumber n="03" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Skills</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Proficiency tracking for assignment decisions.
                </p>
              </div>
            </div>
            <Separator />
            <div className="p-5">
              <SkillsManager cleanerId={cleaner._id} skills={cleaner.skills ?? []} />
            </div>
          </section>

          {/* 04 · Service Qualifications */}
          <section id="service-qualifications" className="surface-card overflow-hidden rounded-2xl">
            <div className="flex items-start gap-2 p-5">
              <SectionNumber n="04" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Service Qualifications</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Required services must be qualified to enable dispatch.
                </p>
              </div>
            </div>
            <Separator />
            <div className="p-5">
              <ServiceQualificationsManager cleanerId={cleaner._id} qualifications={cleaner.serviceTypes ?? []} />
            </div>
          </section>

          {/* 05 · Recent Assignments */}
          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="flex items-start gap-2 p-5">
              <SectionNumber n="05" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Recent Assignments</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Latest booking assignments and outcomes.
                </p>
              </div>
            </div>
            <Separator />
            <div className="p-5">
              <AssignmentList assignments={assignments ?? []} limit={5} />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pay Rates */}
          <PayRatePanel cleanerId={cleaner._id} />

          {/* Ratings */}
          <RatingsInsightsPanel cleanerId={cleaner._id} />

          {/* Time Off */}
          <section className="surface-card overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between p-5">
              <h2 className="text-sm font-semibold text-foreground">Time Off</h2>
              <Button variant="outline" size="xs" onClick={() => setIsTimeOffSheetOpen(true)}>
                Request
              </Button>
            </div>
            <Separator />
            <div className="p-5">
              <TimeOffList timeOffRequests={timeOff ?? []} />
            </div>
          </section>
        </div>
      </div>

      {/* Edit Profile Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Profile</SheetTitle>
            <SheetDescription>Update profile information for {fullName}.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CleanerForm mode="edit" initialData={cleaner} onSuccess={() => setIsEditSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Request Time Off Sheet */}
      <Sheet open={isTimeOffSheetOpen} onOpenChange={setIsTimeOffSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Request Time Off</SheetTitle>
            <SheetDescription>Submit a time off request for {fullName}.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="to-start" className="text-xs font-medium text-foreground">Start Date</label>
              <Input id="to-start" type="date" value={timeOffStartDate} onChange={(e) => setTimeOffStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="to-end" className="text-xs font-medium text-foreground">End Date</label>
              <Input id="to-end" type="date" value={timeOffEndDate} onChange={(e) => setTimeOffEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Type</label>
              <Select value={timeOffType} onValueChange={(v) => v && setTimeOffType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="sick">Sick</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="family">Family</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="to-reason" className="text-xs font-medium text-foreground">
                Reason <span className="text-[10px] text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="to-reason"
                value={timeOffReason}
                onChange={(e) => setTimeOffReason(e.target.value)}
                placeholder="Reason for time off..."
                rows={3}
              />
            </div>
            <Button
              size="sm"
              onClick={handleTimeOffSubmit}
              disabled={isSubmittingTimeOff || !timeOffStartDate || !timeOffEndDate}
              className="w-full"
            >
              {isSubmittingTimeOff ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Change Status Sheet */}
      <Sheet open={isStatusSheetOpen} onOpenChange={setIsStatusSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Change Status</SheetTitle>
            <SheetDescription>Update employment status for {fullName}.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">New Status</label>
              <Select value={newStatus} onValueChange={(v) => v && setNewStatus(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="applicant">Applicant</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={handleStatusChange}
              disabled={isUpdatingStatus || !newStatus}
              className="w-full"
            >
              {isUpdatingStatus ? "Updating..." : "Update Status"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
