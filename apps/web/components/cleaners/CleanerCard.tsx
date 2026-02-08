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
  if (!rating) return "—";
  return rating.toFixed(1);
}

export default function CleanerCard({ cleaner, className }: CleanerCardProps) {
  const initials = getInitials(cleaner.firstName, cleaner.lastName);
  const fullName = `${cleaner.firstName} ${cleaner.lastName}`;

  return (
    <div
      className={cn(
        "surface-card p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
            {initials}
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">{fullName}</p>
            <p className="text-sm text-muted-foreground">{cleaner.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CleanerStatusBadge status={cleaner.status} />
          <Badge className="bg-muted text-muted-foreground">
            {cleaner.employmentType}
          </Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>Rating: {formatRating(cleaner.averageRating)} ★</span>
        <span>Jobs: {cleaner.totalJobsCompleted ?? 0}</span>
        {cleaner.phone ? <span>Phone: {cleaner.phone}</span> : null}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">ID: {cleaner._id}</p>
        <Link
          href={`/dashboard/cleaners/${cleaner._id}`}
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          View
        </Link>
      </div>
    </div>
  );
}
