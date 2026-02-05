"use client";

import PageHeader from "@/components/dashboard/PageHeader";
import ScheduleCalendar from "@/components/schedule/ScheduleCalendar";

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        subtitle="View and manage bookings by date. Click a day to see details and assign cleaners."
      />

      <ScheduleCalendar />
    </div>
  );
}
