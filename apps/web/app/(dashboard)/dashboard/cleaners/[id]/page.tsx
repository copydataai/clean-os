"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
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
import { Button } from "@/components/ui/button";
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
import { computeReadinessInsights } from "@/lib/cleanerInsights";

function formatDate(timestamp?: number | null) {
  if (!timestamp) {
    return "—";
  }
  return new Date(timestamp).toLocaleDateString();
}

function formatRating(rating?: number | null): string {
  if (!rating) return "—";
  return rating.toFixed(1);
}

export default function CleanerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cleanerId = params?.id as Id<"cleaners"> | undefined;

  const cleaner = useQuery(
    api.cleaners.getWithDetails,
    cleanerId ? { cleanerId } : "skip"
  );
  const assignments = useQuery(
    api.cleaners.getAssignments,
    cleanerId ? { cleanerId } : "skip"
  );
  const timeOff = useQuery(
    api.cleaners.getTimeOffRequests,
    cleanerId ? { cleanerId } : "skip"
  );
  const ratingsSummary = useQuery(
    api.cleaners.getRatingsSummary,
    cleanerId ? { cleanerId } : "skip"
  );
  const updateCleaner = useMutation(api.cleaners.update);
  const requestTimeOff = useMutation(api.cleaners.requestTimeOff);

  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isTimeOffSheetOpen, setIsTimeOffSheetOpen] = useState(false);
  const [isStatusSheetOpen, setIsStatusSheetOpen] = useState(false);

  // Time off form state
  const [timeOffStartDate, setTimeOffStartDate] = useState("");
  const [timeOffEndDate, setTimeOffEndDate] = useState("");
  const [timeOffType, setTimeOffType] = useState("personal");
  const [timeOffReason, setTimeOffReason] = useState("");
  const [isSubmittingTimeOff, setIsSubmittingTimeOff] = useState(false);

  // Status change state
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
      await updateCleaner({
        cleanerId,
        status: newStatus,
      });
      setIsStatusSheetOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (cleaner === null) {
    return (
      <EmptyState
        title="Cleaner not found"
        description="We couldn't locate this cleaner."
        action={
          <Button onClick={() => router.push("/dashboard/cleaners")}>
            Back to Cleaners
          </Button>
        }
      />
    );
  }

  if (!cleaner) {
    return (
      <div className="surface-card p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">Loading cleaner...</p>
      </div>
    );
  }

  const fullName = `${cleaner.firstName} ${cleaner.lastName}`;
  const readinessInsights = computeReadinessInsights({
    serviceQualifications: cleaner.serviceTypes ?? [],
    hasActivePayRate: Boolean(cleaner.activePayRate),
    ratingHealth: {
      average: ratingsSummary?.average ?? null,
      delta30d: ratingsSummary?.delta30d ?? null,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName}
        subtitle={`Added ${formatDate(cleaner.createdAt)}`}
      >
        <CleanerStatusBadge status={cleaner.status} />
      </PageHeader>

      <CleanerInsightsHeader insights={readinessInsights} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="space-y-4 lg:col-span-2">
          {/* Profile Overview */}
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Profile Overview
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="surface-soft p-4">
                <p className="text-xs uppercase text-muted-foreground">Email</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {cleaner.email}
                </p>
              </div>
              <div className="surface-soft p-4">
                <p className="text-xs uppercase text-muted-foreground">Phone</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {cleaner.phone ?? "—"}
                </p>
              </div>
              <div className="surface-soft p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Employment Type
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {cleaner.employmentType}
                </p>
              </div>
              <div className="surface-soft p-4">
                <p className="text-xs uppercase text-muted-foreground">Start Date</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {cleaner.startDate ?? "—"}
                </p>
              </div>
            </div>

            {cleaner.bio ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-foreground">Bio</h3>
                <p className="mt-2 text-sm text-muted-foreground">{cleaner.bio}</p>
              </div>
            ) : null}

            {cleaner.address?.street ||
            cleaner.address?.city ||
            cleaner.address?.state ? (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-foreground">Address</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {[
                    cleaner.address?.street,
                    cleaner.address?.city,
                    cleaner.address?.state,
                    cleaner.address?.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              </div>
            ) : null}
          </div>

          {/* Weekly Availability */}
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Weekly Availability
            </h2>
            <div className="mt-4">
              <AvailabilityEditor
                cleanerId={cleaner._id}
                availability={cleaner.availability ?? []}
              />
            </div>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Skills Management</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Track skill proficiency and update capabilities used for assignment decisions.
            </p>
            <div className="mt-4">
              <SkillsManager cleanerId={cleaner._id} skills={cleaner.skills ?? []} />
            </div>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Service Qualifications
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep required services qualified to avoid dispatch bottlenecks.
            </p>
            <div className="mt-4">
              <ServiceQualificationsManager
                cleanerId={cleaner._id}
                qualifications={cleaner.serviceTypes ?? []}
              />
            </div>
          </div>

          {/* Recent Assignments */}
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Recent Assignments
            </h2>
            <div className="mt-4">
              <AssignmentList assignments={assignments ?? []} limit={5} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Actions</h2>
            <div className="mt-4 space-y-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setIsEditSheetOpen(true)}
              >
                Edit profile
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setIsTimeOffSheetOpen(true)}
              >
                Request time off
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setNewStatus(cleaner.status);
                  setIsStatusSheetOpen(true);
                }}
              >
                Change status
              </Button>
            </div>
          </div>

          {/* Performance */}
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Performance</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rating</span>
                <span className="text-sm font-medium text-foreground">
                  {formatRating(cleaner.averageRating)} ★
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Jobs Completed</span>
                <span className="text-sm font-medium text-foreground">
                  {cleaner.totalJobsCompleted ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reliability</span>
                <span className="text-sm font-medium text-foreground">
                  {cleaner.reliabilityScore ?? 100}%
                </span>
              </div>
            </div>
          </div>

          <PayRatePanel cleanerId={cleaner._id} />

          <RatingsInsightsPanel cleanerId={cleaner._id} />

          {/* Time Off */}
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Time Off</h2>
            <div className="mt-4">
              <TimeOffList timeOffRequests={timeOff ?? []} />
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Profile</SheetTitle>
            <SheetDescription>
              Update the cleaner's profile information.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CleanerForm
              mode="edit"
              initialData={cleaner}
              onSuccess={() => setIsEditSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Request Time Off Sheet */}
      <Sheet open={isTimeOffSheetOpen} onOpenChange={setIsTimeOffSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Request Time Off</SheetTitle>
            <SheetDescription>
              Submit a time off request for this cleaner.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">
                Start Date
              </label>
              <Input
                type="date"
                value={timeOffStartDate}
                onChange={(e) => setTimeOffStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">
                End Date
              </label>
              <Input
                type="date"
                value={timeOffEndDate}
                onChange={(e) => setTimeOffEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Type</label>
              <Select value={timeOffType} onValueChange={(v) => v && setTimeOffType(v)}>
                <SelectTrigger className="mt-1 w-full">
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
            <div>
              <label className="text-sm font-medium text-foreground">
                Reason (optional)
              </label>
              <Textarea
                value={timeOffReason}
                onChange={(e) => setTimeOffReason(e.target.value)}
                placeholder="Provide a reason for the time off..."
                className="mt-1"
                rows={3}
              />
            </div>
            <Button
              onClick={handleTimeOffSubmit}
              disabled={
                isSubmittingTimeOff || !timeOffStartDate || !timeOffEndDate
              }
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
            <SheetDescription>
              Update the cleaner's employment status.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">
                New Status
              </label>
              <Select value={newStatus} onValueChange={(v) => v && setNewStatus(v)}>
                <SelectTrigger className="mt-1 w-full">
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
