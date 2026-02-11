import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import CleanerStatusBadge from "@/components/cleaners/CleanerStatusBadge";
import { cn } from "@/lib/utils";
import type { Id } from "@clean-os/convex/data-model";

type CleanerCardProps = {
  cleaner: {
    _id: Id<"cleaners">;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    status: string;
    employmentType: string;
    averageRating?: number | null;
    totalJobsCompleted?: number | null;
  };
  className?: string;
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatRating(rating?: number | null): string {
  if (!rating) return "---";
  return rating.toFixed(1);
}

const avatarColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  onboarding: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  applicant: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  inactive: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  terminated: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

export default function CleanerCard({ cleaner, className }: CleanerCardProps) {
  const initials = getInitials(cleaner.firstName, cleaner.lastName);
  const fullName = `${cleaner.firstName} ${cleaner.lastName}`;
  const colorClass = avatarColors[cleaner.status] ?? "bg-muted text-muted-foreground";

  return (
    <Link
      href={`/dashboard/cleaners/${cleaner._id}`}
      className={cn(
        "group flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3 transition-all hover:border-border hover:bg-muted/30",
        className,
      )}
    >
      {/* Avatar */}
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", colorClass)}>
        {initials}
      </div>

      {/* Name & email */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{cleaner.email}</p>
      </div>

      {/* Metrics strip */}
      <div className="hidden items-center gap-4 sm:flex">
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Rating</p>
          <p className="font-mono text-xs font-medium text-foreground">{formatRating(cleaner.averageRating)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Jobs</p>
          <p className="font-mono text-xs font-medium text-foreground">{cleaner.totalJobsCompleted ?? 0}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">{cleaner.employmentType}</Badge>
        <CleanerStatusBadge status={cleaner.status} />
      </div>

      {/* Arrow */}
      <svg className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
