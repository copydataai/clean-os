import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  applicant: "bg-purple-100 text-purple-700",
  onboarding: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  inactive: "bg-amber-100 text-amber-700",
  terminated: "bg-red-100 text-red-700",
};

type CleanerStatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
};

export default function CleanerStatusBadge({
  status,
  label,
  className,
}: CleanerStatusBadgeProps) {
  const classes = statusStyles[status] ?? "bg-gray-100 text-gray-700";
  const text = label ?? status.replace(/_/g, " ");
  return <Badge className={cn(classes, className)}>{text}</Badge>;
}
