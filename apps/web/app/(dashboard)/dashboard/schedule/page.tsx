"use client";

import ScheduleWorkspace from "@/components/schedule/ScheduleWorkspace";

const QUICK_NOTES = [
  {
    label: "Dispatch rhythm",
    value: "Route-first",
    detail: "Queue, map, and assignment workflow in one loop.",
  },
  {
    label: "Calendar rhythm",
    value: "Month scan",
    detail: "Spot gaps and workload spikes before they become blockers.",
  },
  {
    label: "Source of truth",
    value: "Convex live",
    detail: "All schedule state updates stream directly from backend functions.",
  },
];

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(140deg,color-mix(in_oklch,var(--card)_88%,white)_0%,color-mix(in_oklch,var(--primary)_10%,white)_45%,color-mix(in_oklch,var(--accent)_22%,white)_100%)] p-6 shadow-[0_24px_80px_-50px_rgba(14,37,78,0.55)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-16 h-60 w-60 rounded-full bg-[color-mix(in_oklch,var(--primary)_30%,transparent)] blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-[color-mix(in_oklch,var(--chart-2)_22%,transparent)] blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Scheduling Command Deck
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl lg:text-[2.7rem]">
              Dispatch faster, balance cleaner load, and keep service windows visible.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
              This workspace is tuned for day-of execution first, with month-level planning always one tab away.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {QUICK_NOTES.map((item) => (
              <article
                key={item.label}
                className="rounded-2xl border border-border/70 bg-background/80 p-4 backdrop-blur"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ScheduleWorkspace />
    </div>
  );
}
