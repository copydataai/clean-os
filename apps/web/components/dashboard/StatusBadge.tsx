import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700",
  quoted: "bg-purple-100 text-purple-700",
  confirmed: "bg-blue-100 text-blue-700",
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-violet-100 text-violet-700",
  accepted: "bg-emerald-100 text-emerald-700",
  expired: "bg-rose-100 text-rose-700",
  send_failed: "bg-red-100 text-red-700",
  booking_created: "bg-indigo-100 text-indigo-700",
  card_saved: "bg-green-100 text-green-700",
  pending_card: "bg-orange-100 text-orange-700",
  scheduled: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-cyan-100 text-cyan-700",
  completed: "bg-green-100 text-green-700",
  service_completed: "bg-green-100 text-green-700",
  payment_failed: "bg-red-100 text-red-700",
  charged: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-zinc-200 text-zinc-700",
};

type StatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
  context?: "default" | "funnel";
};

function getStatusLabel(status: string, context: "default" | "funnel") {
  if (status === "failed") return "failed (legacy)";
  if (context === "funnel" && status === "completed") return "service completed";
  return status.replace(/_/g, " ");
}

export default function StatusBadge({
  status,
  label,
  className,
  context = "default",
}: StatusBadgeProps) {
  const classes = statusStyles[status] ?? "bg-gray-100 text-gray-700";
  const text = label ?? getStatusLabel(status, context);
  return <Badge className={cn(classes, className)}>{text}</Badge>;
}
