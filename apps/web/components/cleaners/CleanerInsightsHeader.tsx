"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CleanerReadinessInsights } from "@/lib/cleanerInsights";

type CleanerInsightsHeaderProps = {
  insights: CleanerReadinessInsights;
};

function getScoreColor(score: number) {
  if (score >= 80) return { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", ring: "ring-emerald-200 dark:ring-emerald-800" };
  if (score >= 60) return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", ring: "ring-amber-200 dark:ring-amber-800" };
  return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500", ring: "ring-red-200 dark:ring-red-800" };
}

function scrollToId(id: string) {
  const section = document.getElementById(id);
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function CleanerInsightsHeader({ insights }: CleanerInsightsHeaderProps) {
  const scoreColor = getScoreColor(insights.score);
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - (insights.score / 100) * circumference;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card px-5 py-4 sm:flex-row sm:items-center">
      {/* Score ring */}
      <div className="flex items-center gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border/40" />
            <circle
              cx="20" cy="20" r="18" fill="none" strokeWidth="2.5"
              strokeLinecap="round"
              className={scoreColor.text}
              stroke="currentColor"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <span className={cn("font-mono text-sm font-bold", scoreColor.text)}>
            {insights.score}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Readiness
          </p>
          <p className="text-xs text-muted-foreground">
            Qualifications, pay, and ratings
          </p>
        </div>
      </div>

      <Separator orientation="vertical" className="hidden h-10 sm:block" />

      {/* Flags */}
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {insights.flags.length > 0 ? (
          insights.flags.map((flag) => (
            <Badge key={flag} className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              {flag}
            </Badge>
          ))
        ) : (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            No active risks
          </Badge>
        )}
      </div>

      {/* Quick fix links */}
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => scrollToId("service-qualifications")}
          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Qualifications
        </button>
        <button
          type="button"
          onClick={() => scrollToId("pay-rates")}
          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Pay
        </button>
        <button
          type="button"
          onClick={() => scrollToId("ratings-insights")}
          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Ratings
        </button>
      </div>
    </div>
  );
}
