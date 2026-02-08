"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CleanerReadinessInsights } from "@/lib/cleanerInsights";

type CleanerInsightsHeaderProps = {
  insights: CleanerReadinessInsights;
};

function getScoreTone(score: number): string {
  if (score >= 80) return "text-green-700";
  if (score >= 60) return "text-amber-700";
  return "text-red-700";
}

function scrollToId(id: string) {
  const section = document.getElementById(id);
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function CleanerInsightsHeader({
  insights,
}: CleanerInsightsHeaderProps) {
  return (
    <div className="surface-card p-6">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Operational readiness today
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={`text-3xl font-semibold ${getScoreTone(insights.score)}`}>
            {insights.score}
            <span className="ml-1 text-lg text-muted-foreground">/ 100</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Readiness score based on qualifications, pay setup, and ratings health.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => scrollToId("service-qualifications")}>
            Fix Qualifications
          </Button>
          <Button size="sm" variant="outline" onClick={() => scrollToId("pay-rates")}>
            Update Pay Rate
          </Button>
          <Button size="sm" variant="outline" onClick={() => scrollToId("ratings-insights")}>
            Review Ratings
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {insights.flags.length > 0 ? (
          insights.flags.map((flag) => (
            <Badge key={flag} className="bg-amber-100 text-amber-800">
              {flag}
            </Badge>
          ))
        ) : (
          <Badge className="bg-green-100 text-green-800">No active risks detected</Badge>
        )}
      </div>
    </div>
  );
}
