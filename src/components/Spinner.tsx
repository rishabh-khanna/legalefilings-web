// The one small, inline loading indicator for "this section/list is
// still fetching" — same branded ring + gradient "LE" mark as
// BrandSpinner (used for whole-page loading), just sized down, so every
// loading state in the app reads as the same spinner instead of a
// generic plain ring in some places and the branded one in others.
export function Spinner({ size = 28, label }: { size?: number; label?: string }) {
  const showMark = size >= 20;
  const border = Math.max(2, Math.round(size / 10));
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        <span className="absolute inset-0 rounded-full opacity-15" style={{ border: `${border}px solid var(--color-action)` }} />
        <span
          className="absolute inset-0 animate-spin rounded-full border-transparent"
          style={{ borderWidth: border, borderStyle: "solid", borderTopColor: "var(--color-action)", borderRightColor: "var(--color-action)", animationDuration: "0.9s" }}
        />
        {showMark && (
          <span
            className="absolute flex items-center justify-center rounded-full font-extrabold text-white shadow-sm"
            style={{
              inset: border + 2,
              background: "linear-gradient(135deg, #fdc500, #ff8a3d)",
              fontSize: Math.max(7, size * 0.28),
            }}
          >
            LE
          </span>
        )}
      </span>
      {label && (
        <span className="text-sm font-medium" style={{ color: "var(--color-ink-soft)" }}>
          {label}
        </span>
      )}
    </span>
  );
}

// Centers the spinner in a padded block — the drop-in replacement for a
// standalone `<p>Loading…</p>` returned as a whole page/section's body.
export function LoadingBlock({ label = "Loading…", className = "py-10" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Spinner size={36} label={label} />
    </div>
  );
}
