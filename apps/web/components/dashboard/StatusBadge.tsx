import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  requested: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  quoted: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-400",
  sent: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  delivery_delayed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  queued: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-400",
  skipped: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  expired: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  send_failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  booking_created: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
  card_saved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  pending_card: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  scheduled: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  in_progress: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  service_completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  payment_failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  charged: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  cancelled: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400",
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
  const classes = statusStyles[status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-400";
  const text = label ?? getStatusLabel(status, context);
  return <Badge className={cn(classes, className)}>{text}</Badge>;
}
