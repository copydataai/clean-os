"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import type { Id } from "@clean-os/convex/data-model";
import { api } from "@clean-os/convex/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SetPayRateSheet from "@/components/cleaners/SetPayRateSheet";
import { formatPayRate } from "@/lib/cleanerInsights";

type PayRatePanelProps = {
  cleanerId: Id<"cleaners">;
};

function formatDate(timestamp?: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString();
}

export default function PayRatePanel({ cleanerId }: PayRatePanelProps) {
  const [isSetSheetOpen, setIsSetSheetOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const history = useQuery(api.cleaners.getPayRateHistory, { cleanerId });

  const activeRate = useMemo(
    () => history?.find((rate) => rate.isActive) ?? null,
    [history]
  );
  const previewHistory = useMemo(() => (history ?? []).slice(0, 3), [history]);
  const displayedHistory = showAllHistory ? history ?? [] : previewHistory;

  return (
    <div id="pay-rates" className="surface-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Pay Rates</h2>
        <Button size="sm" onClick={() => setIsSetSheetOpen(true)}>
          Update Rate
        </Button>
      </div>

      {history === undefined ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading pay rates...</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="surface-soft p-4">
            <p className="text-xs uppercase text-muted-foreground">Active rate</p>
            {activeRate ? (
              <div className="mt-2 space-y-2">
                <p className="text-lg font-medium text-foreground">
                  {formatPayRate(
                    activeRate.baseRate,
                    activeRate.payType,
                    activeRate.currency ?? "USD"
                  )}
                  <span className="ml-1 text-sm text-muted-foreground">
                    {activeRate.payType === "hourly"
                      ? "/hr"
                      : activeRate.payType === "per_job"
                        ? "/job"
                        : activeRate.payType === "commission"
                          ? "commission"
                          : activeRate.payType}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeRate.overtimeRate ? (
                    <Badge className="bg-muted text-muted-foreground">
                      OT{" "}
                      {formatPayRate(
                        activeRate.overtimeRate,
                        activeRate.payType,
                        activeRate.currency ?? "USD"
                      )}
                    </Badge>
                  ) : null}
                  {activeRate.weekendRate ? (
                    <Badge className="bg-muted text-muted-foreground">
                      Weekend{" "}
                      {formatPayRate(
                        activeRate.weekendRate,
                        activeRate.payType,
                        activeRate.currency ?? "USD"
                      )}
                    </Badge>
                  ) : null}
                  {activeRate.holidayRate ? (
                    <Badge className="bg-muted text-muted-foreground">
                      Holiday{" "}
                      {formatPayRate(
                        activeRate.holidayRate,
                        activeRate.payType,
                        activeRate.currency ?? "USD"
                      )}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Effective from {formatDate(activeRate.effectiveFrom)}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-amber-700">
                No active pay rate. Payroll and assignment cost estimates may be inaccurate.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Recent changes</p>
              {history.length > 3 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAllHistory((value) => !value)}
                >
                  {showAllHistory ? "Show less" : "View all"}
                </Button>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              {displayedHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pay rate history yet.</p>
              ) : (
                displayedHistory.map((rate) => (
                  <div key={rate._id} className="surface-soft p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {formatPayRate(rate.baseRate, rate.payType, rate.currency ?? "USD")}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {rate.payType}
                        </span>
                      </p>
                      {rate.isActive ? (
                        <Badge className="bg-green-100 text-green-800">active</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(rate.effectiveFrom)} -{" "}
                      {rate.isActive ? "present" : formatDate(rate.effectiveUntil)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <SetPayRateSheet
        cleanerId={cleanerId}
        open={isSetSheetOpen}
        onOpenChange={setIsSetSheetOpen}
      />
    </div>
  );
}
