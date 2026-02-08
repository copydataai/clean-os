"use client";

import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import { Authenticated } from "convex/react";
import PageHeader from "@/components/dashboard/PageHeader";
import StatusBadge from "@/components/dashboard/StatusBadge";
import RequestCard from "@/components/dashboard/RequestCard";

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

export default function DashboardPage() {
  const currentUser = useQuery(api.queries.getCurrentUser);
  const organizations = useQuery(api.queries.getUserOrganizations);
  const stats = useQuery(api.dashboard.getStats);
  const recentBookings = useQuery(api.dashboard.getRecentBookings, { limit: 5 });
  const todaysSchedule = useQuery(api.dashboard.getTodaysSchedule);
  const recentRequests = useQuery(api.bookingRequests.listRecent, { limit: 3 });

  if (!currentUser || !organizations || !stats || !recentBookings || !todaysSchedule || !recentRequests) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Authenticated>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageHeader
          title="Overview"
          subtitle={`Welcome back, ${currentUser.firstName || "there"}.`}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="surface-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Revenue This Month</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{formatCurrency(stats.revenueThisMonthCents)}</p>
            <p className="mt-1 text-sm text-green-600">+18% from last month</p>
          </div>

          <div className="surface-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Jobs Completed</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{stats.jobsCompletedThisMonth}</p>
            <p className="mt-1 text-sm text-green-600">+12% from last month</p>
          </div>

          <div className="surface-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{stats.activeClients}</p>
            <p className="mt-1 text-sm text-green-600">+5% from last month</p>
          </div>

          <div className="surface-card p-6">
            <p className="text-sm font-medium text-muted-foreground">Pending Bookings</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{stats.pendingBookings}</p>
            <p className="mt-1 text-sm text-muted-foreground">{stats.jobsScheduledToday} scheduled today</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="surface-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">New Requests</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status="requested" label={`${stats.pendingRequests} requested`} />
                  <StatusBadge status="confirmed" label={`${stats.confirmedRequests} confirmed`} />
                </div>
              </div>
              <div className="mt-4 space-y-4">
                {recentRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent requests</p>
                ) : (
                  recentRequests.map((request) => (
                    <RequestCard key={request._id} request={request} />
                  ))
                )}
              </div>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Recent Jobs</h2>
              <div className="space-y-3">
                {recentBookings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No jobs yet</p>
                ) : (
                  recentBookings.map((job) => (
                    <div key={job._id} className="flex items-center justify-between surface-soft p-4">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{job.customerName || job.email}</p>
                        <p className="text-sm text-muted-foreground">{job.serviceType || "Standard Cleaning"}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <StatusBadge status={job.status} />
                        <span className="font-semibold text-foreground">
                          {job.amount ? formatCurrency(job.amount) : "—"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Request Status</h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Requested</span>
                  <StatusBadge status="requested" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Confirmed</span>
                  <StatusBadge status="confirmed" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Booking Linked</span>
                  <StatusBadge status="booking_created" label="booking linked" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Card Saved</span>
                  <StatusBadge status="card_saved" />
                </div>
              </div>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Today&apos;s Schedule</h2>
              <div className="grid gap-4">
                {todaysSchedule.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No jobs scheduled for today</p>
                ) : (
                  todaysSchedule.map((job) => (
                    <div key={job._id} className="surface-soft p-4">
                      <p className="text-sm font-medium text-muted-foreground">{job.serviceDate || "TBD"}</p>
                      <p className="mt-2 font-semibold text-foreground">{job.customerName || job.email}</p>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{job.serviceType || "Standard"}</span>
                        <StatusBadge status={job.status} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Authenticated>
  );
}
