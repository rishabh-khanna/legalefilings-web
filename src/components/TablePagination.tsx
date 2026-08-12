"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS } from "@/lib/use-pagination";

// One shared pagination bar for every dashboard table — rows-per-page
// selector (20/50/100) plus a "X–Y of Z" range and prev/next, instead of
// each page inventing its own.
//
// Styled as chrome, not content: this sits directly above a bordered
// table card, and giving it its own white card + shadow made two stacked
// panels competing for the same attention. It now reads as a quiet strip
// belonging to the table below it.
export function TablePagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  start,
  end,
  total,
  itemLabel = "results",
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  start: number;
  end: number;
  total: number;
  itemLabel?: string;
}) {
  const navButton =
    "flex h-7 w-7 items-center justify-center rounded-lg border transition-colors hover:border-[var(--color-action)] hover:text-[var(--color-action-dark)] disabled:pointer-events-none disabled:opacity-35";

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-0.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--color-ink-soft)" }}>
          Rows
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-7 rounded-lg border px-2 text-xs font-semibold outline-none"
          style={{ borderColor: "var(--color-line)", color: "var(--color-ink)", backgroundColor: "var(--color-paper-raised)" }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums" style={{ color: "var(--color-ink-soft)" }}>
          {total === 0 ? (
            `No ${itemLabel}`
          ) : (
            <>
              <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
                {start}–{end}
              </span>{" "}
              of {total} {itemLabel}
            </>
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className={navButton}
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)", backgroundColor: "var(--color-paper-raised)" }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-1.5 text-xs font-semibold tabular-nums" style={{ color: "var(--color-ink)" }}>
            {page} <span style={{ color: "var(--color-ink-soft)", fontWeight: 400 }}>/ {totalPages}</span>
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className={navButton}
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)", backgroundColor: "var(--color-paper-raised)" }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
