import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function OnboardingQueueSection({
  title,
  count,
  kind,
  children,
}: {
  title: string;
  count: number;
  kind: "intake" | "job";
  children: ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-medium",
            kind === "intake"
              ? "border-[color:var(--onboarding-intake-accent)]/45 text-[color:var(--onboarding-intake-accent)]"
              : "border-[color:var(--onboarding-job-accent)]/45 text-[color:var(--onboarding-job-accent)]"
          )}
        >
          {count}
        </Badge>
      </div>
      <Separator />
      <div className="p-4">{children}</div>
    </section>
  );
}

export function QueueSectionEmpty({ copy }: { copy: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
      {copy}
    </div>
  );
}
