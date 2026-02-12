"use client";

import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import { Authenticated } from "convex/react";
import PageHeader from "@/components/dashboard/PageHeader";
import StatusBadge from "@/components/dashboard/StatusBadge";
import OverviewOnboardingRow from "@/components/dashboard/OverviewOnboardingRow";
import { onboardingApi } from "@/lib/onboarding/api";
import { cn } from "@/lib/utils";

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label,
  value,
  footnote,
  accentColor,
  delay,
}: {
  label: string;
  value: string | number;
  footnote: string;
  accentColor: string;
  delay: number;
}) {
  return (
    <div
      className="surface-card group relative overflow-hidden p-5 opacity-0 animate-[fadeSlideIn_0.4s_ease_forwards]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn("absolute inset-y-0 left-0 w-[3px] rounded-full", accentColor)} />
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{footnote}</p>
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  maxValue,
  color,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const pct = maxValue === 0 ? 0 : Math.min(Math.round((value / maxValue) * 100), 100);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-mono text-sm font-medium tabular-nums text-foreground">{value}</span>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-700", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
      {children}
    </h2>
  );
}

export default function DashboardPage() {
  const currentUser = useQuery(api.queries.getCurrentUser);
  const shouldFetchDashboardData = currentUser !== undefined && currentUser !== null;
  const stats = useQuery(api.dashboard.getStats, shouldFetchDashboardData ? {} : "skip");
  const recentBookings = useQuery(
    api.dashboard.getRecentBookings,
    shouldFetchDashboardData ? { limit: 5 } : "skip"
  );
  const todaysSchedule = useQuery(
    api.dashboard.getTodaysSchedule,
    shouldFetchDashboardData ? {} : "skip"
  );
  const recentRequests = useQuery(
    onboardingApi.listRecentRequests,
    shouldFetchDashboardData ? { limit: 3 } : "skip"
  );

  const isDashboardLoading =
    currentUser === undefined ||
    (shouldFetchDashboardData &&
      (stats === undefined ||
        recentBookings === undefined ||
        todaysSchedule === undefined ||
        recentRequests === undefined));

  if (isDashboardLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs tracking-wide text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (currentUser === null) {
    return (
      <Authenticated>
        <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card/80 p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Account setup required
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">We could not load your profile</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your session is active, but your application user record is missing. Ask an admin to finish
            account provisioning, then refresh this page.
          </p>
        </div>
      </Authenticated>
    );
  }

  const snapshotMax = Math.max(
    stats?.pendingRequests || 0,
    stats?.confirmedRequests || 0,
    stats?.pendingBookings || 0,
    stats?.jobsScheduledToday || 0,
    1
  );

  return (
    <Authenticated>
      {/* keyframe for staggered entry */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="mx-auto max-w-6xl space-y-8">
        <PageHeader
          title="Overview"
          subtitle={`${getGreeting()}, ${currentUser.firstName || "there"}.`}
        />

        {/* ── stat cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Revenue"
            value={formatCurrency(stats?.revenueThisMonthCents || 0)}
            footnote="Current month"
            accentColor="bg-emerald-500"
            delay={0}
          />
          <StatCard
            label="Jobs Completed"
            value={stats?.jobsCompletedThisMonth || 0}
            footnote="This month"
            accentColor="bg-blue-500"
            delay={60}
          />
          <StatCard
            label="Active Clients"
            value={stats?.activeClients || 0}
            footnote="Unique client emails"
            accentColor="bg-violet-500"
            delay={120}
          />
          <StatCard
            label="Awaiting Card"
            value={stats?.pendingBookings || 0}
            footnote={`${stats?.jobsScheduledToday || 0} scheduled today`}
            accentColor="bg-amber-500"
            delay={180}
          />
        </div>

        {/* ── main grid ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── left column ── */}
          <div className="space-y-6 lg:col-span-2">
            {/* onboarding intake */}
            <div
              className="surface-card overflow-hidden p-6 opacity-0 animate-[fadeSlideIn_0.4s_ease_forwards]"
              style={{ animationDelay: "220ms" }}
            >
              <div className="flex items-center justify-between">
                <SectionHeading>Onboarding Intake</SectionHeading>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status="requested" label={`${stats?.pendingRequests || 0} requested`} />
                  <StatusBadge status="confirmed" label={`${stats?.confirmedRequests || 0} confirmed`} />
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                {recentRequests?.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No recent onboarding records
                  </p>
                ) : (
                  recentRequests?.map((request) => (
                    <OverviewOnboardingRow key={request._id} request={request} />
                  ))
                )}
              </div>
            </div>

            {/* recent jobs */}
            <div
              className="surface-card overflow-hidden p-6 opacity-0 animate-[fadeSlideIn_0.4s_ease_forwards]"
              style={{ animationDelay: "300ms" }}
            >
              <SectionHeading>Recent Jobs</SectionHeading>
              <div className="mt-4 space-y-2">
                {recentBookings?.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No jobs yet</p>
                ) : (
                  recentBookings?.map((job) => (
                    <div
                      key={job._id}
                      className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-3 transition-colors hover:border-border/70 hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {job.customerName || job.email}
                        </p>
                        <p className="text-xs text-muted-foreground">{job.serviceType || "—"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={job.status} />
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {job.amount ? formatCurrency(job.amount) : "—"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── right column ── */}
          <div className="space-y-6">
            {/* onboarding snapshot */}
            <div
              className="surface-card overflow-hidden p-6 opacity-0 animate-[fadeSlideIn_0.4s_ease_forwards]"
              style={{ animationDelay: "260ms" }}
            >
              <SectionHeading>Onboarding Snapshot</SectionHeading>
              <div className="mt-4 space-y-3">
                <SnapshotRow
                  label="Requested"
                  value={stats?.pendingRequests || 0}
                  maxValue={snapshotMax}
                  color="bg-amber-500"
                />
                <SnapshotRow
                  label="Confirmed"
                  value={stats?.confirmedRequests || 0}
                  maxValue={snapshotMax}
                  color="bg-blue-500"
                />
                <SnapshotRow
                  label="Awaiting card"
                  value={stats?.pendingBookings || 0}
                  maxValue={snapshotMax}
                  color="bg-orange-500"
                />
                <SnapshotRow
                  label="Scheduled today"
                  value={stats?.jobsScheduledToday || 0}
                  maxValue={snapshotMax}
                  color="bg-emerald-500"
                />
              </div>
            </div>

            {/* today's schedule */}
            <div
              className="surface-card overflow-hidden p-6 opacity-0 animate-[fadeSlideIn_0.4s_ease_forwards]"
              style={{ animationDelay: "340ms" }}
            >
              <SectionHeading>Today&apos;s Schedule</SectionHeading>
              {todaysSchedule?.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No jobs scheduled for today
                </p>
              ) : (
                <div className="relative mt-4">
                  {/* vertical connector */}
                  <div className="absolute top-1 bottom-1 left-[5px] w-px bg-border" />

                  <div className="space-y-3.5">
                    {todaysSchedule?.map((job) => (
                      <div key={job._id} className="relative pl-6">
                        <div className="absolute left-0 top-2 size-[11px] rounded-full bg-primary/70 ring-2 ring-background" />
                        <div className="rounded-lg border border-border/40 bg-muted/20 px-3.5 py-3 transition-colors hover:border-border/70 hover:bg-muted/40">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {job.customerName || job.email}
                            </p>
                            <StatusBadge status={job.status} />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{job.serviceType || "—"}</span>
                            <span className="font-mono tabular-nums">{job.serviceDate || "TBD"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Authenticated>
  );
}
