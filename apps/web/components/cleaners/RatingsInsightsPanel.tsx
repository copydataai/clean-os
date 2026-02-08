"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DECLINING_DELTA_THRESHOLD,
  LOW_AVERAGE_RATING_THRESHOLD,
} from "@/lib/cleanerInsights";

type RatingsInsightsPanelProps = {
  cleanerId: Id<"cleaners">;
};

type FilterValue = "all" | "low" | "neutral" | "high";

function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(2);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export default function RatingsInsightsPanel({
  cleanerId,
}: RatingsInsightsPanelProps) {
  const summary = useQuery(api.cleaners.getRatingsSummary, { cleanerId });
  const [filter, setFilter] = useState<FilterValue>("all");

  const filteredRatings = useMemo(() => {
    const ratings = summary?.latestRatings ?? [];
    if (filter === "all") return ratings;
    if (filter === "low") return ratings.filter((rating) => rating.overallRating <= 2);
    if (filter === "neutral")
      return ratings.filter((rating) => rating.overallRating > 2 && rating.overallRating < 4);
    return ratings.filter((rating) => rating.overallRating >= 4);
  }, [summary, filter]);

  const hasLowAverage =
    summary?.average !== null &&
    summary?.average !== undefined &&
    summary.average < LOW_AVERAGE_RATING_THRESHOLD;
  const hasDecliningTrend =
    summary?.delta30d !== null &&
    summary?.delta30d !== undefined &&
    summary.delta30d <= DECLINING_DELTA_THRESHOLD;

  return (
    <div id="ratings-insights" className="surface-card p-6">
      <h2 className="text-lg font-semibold text-foreground">Ratings Insights</h2>

      {summary === undefined ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading ratings insights...</p>
      ) : (
        <div className="mt-4 space-y-4">
          {hasLowAverage ? (
            <div className="surface-soft border border-amber-200 p-3 text-sm text-amber-800">
              Average rating is below {LOW_AVERAGE_RATING_THRESHOLD}. Quality risk may impact
              rebook rates. Action: review recent low ratings and coach on recurring issues.
            </div>
          ) : null}
          {hasDecliningTrend ? (
            <div className="surface-soft border border-amber-200 p-3 text-sm text-amber-800">
              Rating trend declined in the last 30 days. Quality consistency may be slipping.
              Action: audit service notes and assignments from the past 2 weeks.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="surface-soft p-3">
              <p className="text-xs uppercase text-muted-foreground">Average</p>
              <p className="mt-1 text-lg font-medium text-foreground">
                {formatRating(summary.average)}
              </p>
            </div>
            <div className="surface-soft p-3">
              <p className="text-xs uppercase text-muted-foreground">Total ratings</p>
              <p className="mt-1 text-lg font-medium text-foreground">{summary.totalCount}</p>
            </div>
            <div className="surface-soft p-3">
              <p className="text-xs uppercase text-muted-foreground">30-day average</p>
              <p className="mt-1 text-lg font-medium text-foreground">
                {formatRating(summary.average30d)}
              </p>
            </div>
            <div className="surface-soft p-3">
              <p className="text-xs uppercase text-muted-foreground">30-day delta</p>
              <p
                className={`mt-1 text-lg font-medium ${
                  summary.delta30d !== null && summary.delta30d <= DECLINING_DELTA_THRESHOLD
                    ? "text-amber-700"
                    : "text-foreground"
                }`}
              >
                {summary.delta30d === null ? "—" : `${summary.delta30d > 0 ? "+" : ""}${summary.delta30d.toFixed(2)}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
              All
            </Button>
            <Button size="sm" variant={filter === "low" ? "default" : "outline"} onClick={() => setFilter("low")}>
              Low (1-2)
            </Button>
            <Button
              size="sm"
              variant={filter === "neutral" ? "default" : "outline"}
              onClick={() => setFilter("neutral")}
            >
              Neutral (3)
            </Button>
            <Button size="sm" variant={filter === "high" ? "default" : "outline"} onClick={() => setFilter("high")}>
              High (4-5)
            </Button>
          </div>

          <div className="space-y-2">
            {filteredRatings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ratings in this filter.</p>
            ) : (
              filteredRatings.map((rating) => (
                <div key={rating._id} className="surface-soft p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-muted text-muted-foreground">
                        {rating.ratingSource}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">
                        {rating.overallRating.toFixed(1)} ★
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(rating.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {rating.customerComment || "No comment provided."}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
