// A sweeping shimmer (see `.skeleton` in globals.css) rather than a
// global opacity pulse. The sweep implies content arriving from a
// direction; a pulse just says "something is missing here", which reads
// as a stalled page. The gradient is warm-tinted so loading state sits
// in the same family as the loaded UI instead of flashing a cold grey
// block into a warm layout.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
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

// Matches the shape of a populated DataTable card, so the page doesn't
// visibly re-flow when real rows land — a spinner in a blank box always
// does, because it occupies none of the space the content will.
export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="mt-3 overflow-hidden rounded-[14px] border"
      style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper-raised)" }}
    >
      <div className="flex items-center gap-4 px-4 py-3" style={{ backgroundColor: "var(--color-paper-sunken)" }}>
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-3 w-20" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3"
          style={{ borderTop: "1px solid color-mix(in srgb, var(--color-line) 55%, transparent)" }}
        >
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="ml-auto h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
