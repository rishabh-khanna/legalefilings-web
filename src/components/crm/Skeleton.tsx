export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ backgroundColor: "var(--color-line)", opacity: 0.5 }} />;
}

export function SkeletonKpiCard() {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-line)" }}>
      <Skeleton className="h-9 w-9 rounded-full" />
      <Skeleton className="mt-3 h-6 w-16" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
