import Link from "next/link";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

type RequestCardProps = {
  request: {
    _id: Id<"bookingRequests">;
    status: string;
    contactDetails?: string | null;
    email?: string | null;
    createdAt: number;
    accessMethod?: string[] | null;
    floorTypes?: string[] | null;
    pets?: string[] | null;
    bookingId?: Id<"bookings"> | null;
    bookingStatus?: string | null;
  };
  className?: string;
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

function renderTag(label: string) {
  return <Badge className="bg-[#F5F5F5] text-[#555555]">{label}</Badge>;
}

export default function RequestCard({ request, className }: RequestCardProps) {
  const name = request.contactDetails || "Unknown contact";
  const email = request.email || "No email";
  const tags = [
    ...(request.accessMethod ?? []).map((value) => `Access: ${value}`),
    ...(request.floorTypes ?? []).map((value) => `Floors: ${value}`),
    ...(request.pets ?? []).map((value) => `Pets: ${value}`),
  ].slice(0, 4);

  return (
    <div className={cn("rounded-2xl border border-[#E5E5E5] bg-white p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-medium text-[#1A1A1A]">{name}</p>
          <p className="text-sm text-[#666666]">{email}</p>
          <p className="mt-1 text-xs text-[#999999]">{formatDate(request.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={request.status} />
          {request.bookingId ? (
            <StatusBadge status={request.bookingStatus ?? "booking_created"} label="booking linked" />
          ) : null}
        </div>
      </div>

      {tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag}>{renderTag(tag)}</span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-[#999999]">Request ID: {request._id}</p>
        <Link
          href={`/dashboard/requests/${request._id}`}
          className="text-sm font-medium text-[#1A1A1A] underline-offset-4 hover:underline"
        >
          View
        </Link>
      </div>
    </div>
  );
}
