"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DispatchBoard from "./DispatchBoard";
import ScheduleCalendar from "./ScheduleCalendar";

type WorkspaceTab = "dispatch" | "calendar";

export default function ScheduleWorkspace() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("dispatch");

  return (
    <div className="space-y-4">
      <div className="surface-card flex w-fit items-center gap-1 p-1">
        <Button
          size="sm"
          variant={activeTab === "dispatch" ? "default" : "ghost"}
          className={cn("min-w-[120px]")}
          onClick={() => setActiveTab("dispatch")}
        >
          Dispatch
        </Button>
        <Button
          size="sm"
          variant={activeTab === "calendar" ? "default" : "ghost"}
          className={cn("min-w-[120px]")}
          onClick={() => setActiveTab("calendar")}
        >
          Calendar
        </Button>
      </div>

      {activeTab === "dispatch" ? <DispatchBoard /> : <ScheduleCalendar />}
    </div>
  );
}
