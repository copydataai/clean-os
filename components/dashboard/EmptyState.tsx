import { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-white p-10 text-center">
      <h3 className="text-lg font-medium text-[#1A1A1A]">{title}</h3>
      {description ? <p className="mt-2 text-sm text-[#666666]">{description}</p> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
