"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ChevronDown, FileText, Table2 } from "lucide-react";
import { downloadCSV } from "@/lib/export-table";

type ExtraExport = { label: string; href: string };

// Shared "Export" control for every dashboard table — CSV (opens
// directly in Excel/Sheets) of whatever rows are currently passed in,
// so it naturally respects whatever filters/search/date-range a page
// has already applied rather than always dumping the unfiltered table.
//
// `extra` is optional and only a couple of pages pass it (a formatted
// PDF alongside the raw CSV, e.g. Team Attendance's per-staff monthly
// report) — those two used to sit as two separate buttons exporting
// overlapping data, which read as duplicated rather than as two real
// choices. Passing it turns this into a small dropdown; every other
// call site renders exactly the plain single button it always has.
export function ExportButton({
  filename,
  headers,
  rows,
  disabled,
  extra,
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  disabled?: boolean;
  extra?: ExtraExport[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const buttonClass =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white/70 px-3 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white disabled:opacity-50";
  const buttonStyle = { borderColor: "var(--color-line)", color: "var(--color-ink)" };

  if (!extra || extra.length === 0) {
    return (
      <button
        type="button"
        onClick={() => downloadCSV(filename, headers, rows)}
        disabled={disabled || rows.length === 0}
        className={buttonClass}
        style={buttonStyle}
        title="Export the currently filtered rows as a CSV file (opens in Excel or Google Sheets)"
      >
        <Download className="h-4 w-4" /> Export
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={disabled} className={buttonClass} style={buttonStyle} aria-expanded={open}>
        <Download className="h-4 w-4" /> Export
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 mt-1.5 w-56 overflow-hidden rounded-xl border bg-white py-1 shadow-xl dark:bg-[var(--color-paper-raised)]"
          style={{ borderColor: "var(--color-line)" }}
        >
          <button
            type="button"
            onClick={() => {
              downloadCSV(filename, headers, rows);
              setOpen(false);
            }}
            disabled={rows.length === 0}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[var(--gold-50)] disabled:pointer-events-none disabled:opacity-40"
            style={{ color: "var(--color-ink)" }}
          >
            <Table2 className="h-4 w-4 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
            CSV — all rows below
          </button>
          {extra.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--gold-50)]"
              style={{ color: "var(--color-ink)" }}
            >
              <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
