import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import CleanerStatusBadge from "@/components/cleaners/CleanerStatusBadge";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

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
        "rounded-2xl border border-[#E5E5E5] bg-white p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1A1A1A] text-sm font-medium text-white">
            {initials}
          </div>
          <div>
            <p className="text-lg font-medium text-[#1A1A1A]">{fullName}</p>
            <p className="text-sm text-[#666666]">{cleaner.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CleanerStatusBadge status={cleaner.status} />
          <Badge className="bg-[#F5F5F5] text-[#555555]">
            {cleaner.employmentType}
          </Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#666666]">
        <span>Rating: {formatRating(cleaner.averageRating)} ★</span>
        <span>Jobs: {cleaner.totalJobsCompleted ?? 0}</span>
        {cleaner.phone ? <span>Phone: {cleaner.phone}</span> : null}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-[#999999]">ID: {cleaner._id}</p>
        <Link
          href={`/cleaners/${cleaner._id}`}
          className="text-sm font-medium text-[#1A1A1A] underline-offset-4 hover:underline"
        >
          View
        </Link>
      </div>
    </div>
  );
}
