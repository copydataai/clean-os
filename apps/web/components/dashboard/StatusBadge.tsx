import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  quoted: "bg-purple-100 text-purple-700",
  confirmed: "bg-blue-100 text-blue-700",
  booking_created: "bg-indigo-100 text-indigo-700",
  card_saved: "bg-green-100 text-green-700",
  pending_card: "bg-orange-100 text-orange-700",
  scheduled: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  charged: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

type StatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
};

export default function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const classes = statusStyles[status] ?? "bg-gray-100 text-gray-700";
  const text = label ?? status.replace(/_/g, " ");
  return <Badge className={cn(classes, className)}>{text}</Badge>;
}
