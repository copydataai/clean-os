"use client";

import PageHeader from "@/components/dashboard/PageHeader";
import ScheduleWorkspace from "@/components/schedule/ScheduleWorkspace";

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        subtitle="Dispatch daily bookings with a map-first workflow, then switch to month calendar when needed."
      />

      <ScheduleWorkspace />
    </div>
  );
}
