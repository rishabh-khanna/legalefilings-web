"use client";

import { PAGE_SIZE_OPTIONS } from "@/lib/use-pagination";

// One shared pagination bar for every dashboard table — rows-per-page
// selector (20/50/100) plus a "X–Y of Z" range and prev/next, instead of
// each page inventing its own. Renders nothing below 1 page so it never
// adds clutter under a short, unfiltered list.
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
  return (
    <div
      className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-2.5 dark:bg-[var(--color-paper-raised)]"
      style={{ borderColor: "var(--color-line)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
          Rows per page
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-lg border bg-white px-2 py-1 text-sm font-semibold outline-none focus:border-[var(--color-action)] dark:bg-[var(--color-paper-raised)]"
          style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>
          {total === 0 ? `No ${itemLabel}` : `${start}–${end} of ${total} ${itemLabel}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)] disabled:pointer-events-none disabled:opacity-40 dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            Prev
          </button>
          <span className="px-1.5 text-xs font-bold" style={{ color: "var(--color-ink)" }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)] disabled:pointer-events-none disabled:opacity-40 dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
