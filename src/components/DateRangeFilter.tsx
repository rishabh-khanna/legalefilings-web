"use client";

// Paired with useDateRangeFilter — the same From/To date-range control on
// every dashboard table that has a date column.
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onClear,
  active,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear: () => void;
  active: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          max={to || undefined}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
          style={{ borderColor: "var(--color-line)" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          min={from || undefined}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
          style={{ borderColor: "var(--color-line)" }}
        />
      </div>
      {active && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border px-3 py-2 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
          style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
        >
          Clear dates
        </button>
      )}
    </div>
  );
}
