// Compact, hand-built badge instead of the raw Trustpilot lockup image —
// that asset's intrinsic size (992x76) didn't match its display attributes
// and stretched to fill flex containers. This renders crisply at any size
// we choose and never distorts.
function Star() {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 items-center justify-center"
      style={{ backgroundColor: "#00b67a" }}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="white">
        <path d="M12 1.5l2.9 6.6 7.1.7-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 8.8l7.1-.7L12 1.5Z" />
      </svg>
    </span>
  );
}

export function TrustBadge({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex w-fit items-center gap-2 ${className}`}>
      <span className="flex items-center gap-0.5">
        <Star />
        <Star />
        <Star />
        <Star />
        <Star />
      </span>
      <span className="text-xs leading-tight" style={{ color: "var(--color-ink)" }}>
        <span className="font-semibold">Excellent</span>{" "}
        <span style={{ color: "var(--color-ink-soft)" }}>on Trustpilot</span>
      </span>
    </div>
  );
}
