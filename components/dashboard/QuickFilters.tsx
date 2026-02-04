import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterOption = {
  key: string;
  label: string;
  active: boolean;
  onClick: () => void;
};

type QuickFiltersProps = {
  options: FilterOption[];
  className?: string;
};

export default function QuickFilters({ options, className }: QuickFiltersProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => (
        <Button
          key={option.key}
          variant={option.active ? "default" : "outline"}
          size="sm"
          onClick={option.onClick}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
