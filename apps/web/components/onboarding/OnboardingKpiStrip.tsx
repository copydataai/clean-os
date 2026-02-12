import type { LifecycleRow } from "@/components/bookings/types";

export default function OnboardingKpiStrip({
  rows,
  intakeCount,
  activeJobsCount,
}: {
  rows: LifecycleRow[];
  intakeCount: number;
  activeJobsCount: number;
}) {
  const inProgressCount = rows.filter(
    (row) => row.rowType === "booking" && row.operationalStatus === "in_progress"
  ).length;
  const kpis = [
    { label: "Total rows", value: rows.length },
    { label: "Intake", value: intakeCount },
    { label: "Active jobs", value: activeJobsCount },
    { label: "In progress", value: inProgressCount },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="surface-card rounded-xl px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {kpi.label}
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{kpi.value}</p>
        </div>
      ))}
    </div>
  );
}
