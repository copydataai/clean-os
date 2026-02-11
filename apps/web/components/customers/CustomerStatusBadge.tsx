import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  lead: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  inactive: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  churned: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

type CustomerStatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
};

export default function CustomerStatusBadge({
  status,
  label,
  className,
}: CustomerStatusBadgeProps) {
  const classes = statusStyles[status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-400";
  const text = label ?? status.replace(/_/g, " ");
  return <Badge className={cn(classes, className)}>{text}</Badge>;
}
