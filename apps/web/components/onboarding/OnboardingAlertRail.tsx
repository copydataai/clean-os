import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AlertTone, OnboardingAlert } from "@/components/onboarding/types";

export default function OnboardingAlertRail({ alerts }: { alerts: OnboardingAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
      {alerts.map((alert) => (
        <OnboardingAlertCard key={alert.id} tone={alert.tone} action={alert.action}>
          {alert.content}
        </OnboardingAlertCard>
      ))}
    </div>
  );
}

function OnboardingAlertCard({
  tone,
  children,
  action,
}: {
  tone: AlertTone;
  children: ReactNode;
  action?: ReactNode;
}) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200"
      : tone === "error"
      ? "border-red-200 bg-red-50/70 text-red-900 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-200"
      : "border-amber-200 bg-[var(--onboarding-warning-bg)] text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200";

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm", toneClasses)}>
      <p>{children}</p>
      {action}
    </div>
  );
}
