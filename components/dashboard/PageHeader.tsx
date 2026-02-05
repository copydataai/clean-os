import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
};

export default function PageHeader({
  title,
  subtitle,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Dashboard
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-foreground sm:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
