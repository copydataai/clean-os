"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import DispatchBoard from "./DispatchBoard";
import ScheduleCalendar from "./ScheduleCalendar";

type WorkspaceTab = "dispatch" | "calendar";

type TabConfig = {
  key: WorkspaceTab;
  label: string;
  subtitle: string;
};

const TAB_CONFIG: TabConfig[] = [
  {
    key: "dispatch",
    label: "Dispatch",
    subtitle: "Queue + map + assignments",
  },
  {
    key: "calendar",
    label: "Calendar",
    subtitle: "Month planning and day detail",
  },
];

export default function ScheduleWorkspace() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("dispatch");

  const activeConfig = useMemo(
    () => TAB_CONFIG.find((tab) => tab.key === activeTab) ?? TAB_CONFIG[0],
    [activeTab]
  );

  return (
    <section className="space-y-4">
      <div className="surface-card overflow-hidden border-border/80 bg-[linear-gradient(145deg,color-mix(in_oklch,var(--card)_88%,white)_0%,color-mix(in_oklch,var(--primary)_8%,white)_100%)]">
        <div className="flex flex-col gap-4 border-b border-border/80 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Work Surface
            </p>
            <p className="mt-1 text-base font-semibold text-foreground sm:text-lg">
              {activeConfig.label}
            </p>
            <p className="text-xs text-muted-foreground">{activeConfig.subtitle}</p>
          </div>

          <div className="grid w-full grid-cols-2 rounded-2xl border border-border/70 bg-background/85 p-1 sm:w-[430px]">
            {TAB_CONFIG.map((tab) => {
              const selected = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-left transition",
                    selected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <p className="text-sm font-semibold">{tab.label}</p>
                  <p className={cn("text-[11px]", selected ? "text-primary-foreground/85" : "")}>{tab.subtitle}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeTab === "dispatch" ? <DispatchBoard /> : <ScheduleCalendar />}
    </section>
  );
}
