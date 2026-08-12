"use client";

import { Search } from "lucide-react";
import { DatePicker } from "@/components/DatePicker";

// Paired with useDateRangeFilter — the same From/To date-range control on
// every dashboard table that has a date column. Built on the shared
// DatePicker popup calendar rather than a bare <input type="date"> —
// one visual upgrade here reaches every table in the app that filters
// by date, the same "shared component cascades everywhere" pattern
// DataTable itself is built on.
//
// Picking a date doesn't filter anything on its own — the table only
// re-filters when Search is clicked (see useDateRangeFilter's own note
// on why). The Search button fills solid gold while there's a picked
// date not yet applied (dirty), so there's always a visible reason to
// click it rather than a plain always-on button that may or may not do
// anything.
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onClear,
  onSearch,
  dirty,
  active,
  hideSearchButton,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear: () => void;
  onSearch: () => void;
  dirty: boolean;
  active: boolean;
  // DataTable renders one combined Search button covering its search
  // box and this date range together — set when this is rendered
  // inside DataTable so there isn't a second, redundant button right
  // next to it. Standalone usages (outside DataTable) leave this unset
  // and keep their own button.
  hideSearchButton?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>From</label>
        <DatePicker value={from} onChange={onFromChange} max={to || undefined} placeholder="Any" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>To</label>
        <DatePicker value={to} onChange={onToChange} min={from || undefined} placeholder="Any" />
      </div>
      {!hideSearchButton && (
        <button
          type="button"
          onClick={onSearch}
          disabled={!dirty}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white transition-opacity disabled:cursor-default disabled:opacity-40"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          <Search className="h-3.5 w-3.5" />
          Search
        </button>
      )}
      {active && (
        <button
          type="button"
          onClick={onClear}
          // text-sm, not text-xs — this sits in the same bottom-aligned row
          // as the two date inputs and Export, and the smaller line-height
          // made it 4px shorter than everything beside it.
          className="rounded-lg border px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
          style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
        >
          Clear dates
        </button>
      )}
    </div>
  );
}
