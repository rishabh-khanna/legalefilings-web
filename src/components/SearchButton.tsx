"use client";

import { Search } from "lucide-react";

// The one "apply these filters" button every status/type MultiSelect
// toolbar filter uses — paired with a page's own draft/applied filter
// state (selecting an option updates the draft; only clicking this
// commits it to what the table actually filters by). Same visual
// treatment as DateRangeFilter's own Search button so the two read as
// one convention, not two different ones that happen to share a label.
export function SearchButton({ onClick, dirty }: { onClick: () => void; dirty: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!dirty}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white transition-opacity disabled:cursor-default disabled:opacity-40"
      style={{ backgroundColor: "var(--color-action)" }}
    >
      <Search className="h-3.5 w-3.5" />
      Search
    </button>
  );
}
