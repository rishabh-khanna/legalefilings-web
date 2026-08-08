"use client";

import { Download } from "lucide-react";
import { downloadCSV } from "@/lib/export-table";

// Shared "Export" control for every dashboard table — CSV (opens
// directly in Excel/Sheets) of whatever rows are currently passed in,
// so it naturally respects whatever filters/search/date-range a page
// has already applied rather than always dumping the unfiltered table.
export function ExportButton({
  filename,
  headers,
  rows,
  disabled,
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => downloadCSV(filename, headers, rows)}
      disabled={disabled || rows.length === 0}
      // py-2/text-sm, not the smaller py-1.5/text-xs this used to have —
      // this button sits directly beside date-range and status-filter
      // inputs on every table page, all of which use py-2/text-sm; the
      // mismatch made Export sit visibly shorter than its neighbors in
      // the same filter row.
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white/70 px-3 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white disabled:opacity-50"
      style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
      title="Export the currently filtered rows as a CSV file (opens in Excel or Google Sheets)"
    >
      <Download className="h-4 w-4" /> Export
    </button>
  );
}
