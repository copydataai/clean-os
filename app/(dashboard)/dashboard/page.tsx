"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Authenticated } from "convex/react";

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
    case "charged":
      return "bg-green-100 text-green-700";
    case "in-progress":
    case "card_saved":
      return "bg-blue-100 text-blue-700";
    case "scheduled":
      return "bg-yellow-100 text-yellow-700";
    case "pending_card":
      return "bg-orange-100 text-orange-700";
    case "failed":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function DashboardPage() {
  const currentUser = useQuery(api.queries.getCurrentUser);
  const organizations = useQuery(api.queries.getUserOrganizations);
  const stats = useQuery(api.dashboard.getStats);
  const recentBookings = useQuery(api.dashboard.getRecentBookings, { limit: 5 });
  const todaysSchedule = useQuery(api.dashboard.getTodaysSchedule);

  if (!currentUser || !organizations || !stats || !recentBookings || !todaysSchedule) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1A1A1A] border-t-transparent" />
          <p className="mt-4 text-sm text-[#666666]">Loading...</p>
        </div>
      </div>
    );
  }

  const primaryOrg = organizations[0];

  return (
    <Authenticated>
      <div className="min-h-screen bg-[#FAFAFA] p-8">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Header */}
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-normal tracking-tight text-[#1A1A1A]">
                Welcome back, {currentUser.firstName || 'there'}
              </h1>
              <p className="mt-1 text-[#666666]">
                {primaryOrg?.name || 'Your cleaning business'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white font-medium">
                {(currentUser.firstName || currentUser.email)[0].toUpperCase()}
              </div>
            </div>
          </header>

          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6">
              <p className="text-sm font-medium text-[#666666]">Revenue This Month</p>
              <p className="mt-2 text-3xl font-semibold text-[#1A1A1A]">{formatCurrency(stats.revenueThisMonthCents)}</p>
              <p className="mt-1 text-sm text-green-600">+18% from last month</p>
            </div>

            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6">
              <p className="text-sm font-medium text-[#666666]">Jobs Completed</p>
              <p className="mt-2 text-3xl font-semibold text-[#1A1A1A]">{stats.jobsCompletedThisMonth}</p>
              <p className="mt-1 text-sm text-green-600">+12% from last month</p>
            </div>

            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6">
              <p className="text-sm font-medium text-[#666666]">Active Clients</p>
              <p className="mt-2 text-3xl font-semibold text-[#1A1A1A]">{stats.activeClients}</p>
              <p className="mt-1 text-sm text-green-600">+5% from last month</p>
            </div>

            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6">
              <p className="text-sm font-medium text-[#666666]">Pending Bookings</p>
              <p className="mt-2 text-3xl font-semibold text-[#1A1A1A]">{stats.pendingBookings}</p>
              <p className="mt-1 text-sm text-[#888888]">{stats.jobsScheduledToday} scheduled today</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent Jobs */}
            <div className="lg:col-span-2 rounded-2xl border border-[#E5E5E5] bg-white p-6">
              <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Recent Jobs</h2>
              <div className="space-y-3">
                {recentBookings.length === 0 ? (
                  <p className="text-[#666666] text-center py-8">No jobs yet</p>
                ) : (
                  recentBookings.map((job) => (
                    <div key={job._id} className="flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
                      <div className="flex-1">
                        <p className="font-medium text-[#1A1A1A]">{job.customerName || job.email}</p>
                        <p className="text-sm text-[#666666]">{job.serviceType || "Standard Cleaning"}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(job.status)}`}
                        >
                          {formatStatus(job.status)}
                        </span>
                        <span className="font-semibold text-[#1A1A1A]">
                          {job.amount ? formatCurrency(job.amount) : "—"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6">
              <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button className="w-full rounded-xl bg-[#1A1A1A] px-4 py-3 text-left text-white transition-all hover:bg-[#333333]">
                  <p className="font-medium">Schedule New Job</p>
                  <p className="text-sm text-[#888888]">Book a cleaning appointment</p>
                </button>
                <button className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-left transition-all hover:bg-[#FAFAFA]">
                  <p className="font-medium text-[#1A1A1A]">Add New Client</p>
                  <p className="text-sm text-[#666666]">Register a customer</p>
                </button>
                <button className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-left transition-all hover:bg-[#FAFAFA]">
                  <p className="font-medium text-[#1A1A1A]">View Calendar</p>
                  <p className="text-sm text-[#666666]">Manage schedule</p>
                </button>
                <button className="w-full rounded-xl border border-[#E5E5E5] px-4 py-3 text-left transition-all hover:bg-[#FAFAFA]">
                  <p className="font-medium text-[#1A1A1A]">Generate Invoice</p>
                  <p className="text-sm text-[#666666]">Create billing</p>
                </button>
              </div>
            </div>
          </div>

          {/* Upcoming Schedule */}
          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6">
            <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Today&apos;s Schedule</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {todaysSchedule.length === 0 ? (
                <p className="text-[#666666] col-span-full text-center py-8">No jobs scheduled for today</p>
              ) : (
                todaysSchedule.map((job) => (
                  <div key={job._id} className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
                    <p className="text-sm font-medium text-[#666666]">{job.serviceDate || "TBD"}</p>
                    <p className="mt-2 font-semibold text-[#1A1A1A]">{job.customerName || job.email}</p>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-[#666666]">{job.serviceType || "Standard"}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(job.status)}`}>
                        {formatStatus(job.status)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Authenticated>
  );
}