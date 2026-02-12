export default function OnboardingRowsSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="surface-card overflow-hidden rounded-2xl p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-44 rounded bg-muted/70" />
            <div className="h-3 w-72 rounded bg-muted/50" />
            <div className="h-3 w-56 rounded bg-muted/40" />
            <div className="h-7 w-28 rounded bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
