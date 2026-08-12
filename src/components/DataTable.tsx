"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode, type CSSProperties } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Rows3, Rows4, Inbox, SearchX } from "lucide-react";
import { usePagination } from "@/lib/use-pagination";
import { useDateRangeFilter } from "@/lib/use-date-range-filter";
import { TablePagination } from "@/components/TablePagination";
import { ExportButton } from "@/components/ExportButton";
import { DateRangeFilter } from "@/components/DateRangeFilter";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T, rowNumber: number) => ReactNode;
  // Value used for the CSV export column — omit for a column that
  // shouldn't appear in the export at all (an Actions column, say).
  exportValue?: (row: T) => string | number | null | undefined;
  // Value used to sort by this column when its header is clicked —
  // separate from exportValue on purpose: exportValue is often a
  // formatted display string (e.g. a locale date like "8/8/2026"),
  // and sorting those lexicographically gives the wrong chronological
  // order. Provide the actual comparable value here (a raw number, an
  // ISO date string, or a Date) instead. A column with no sortValue
  // just isn't sortable — no header click affordance for it.
  sortValue?: (row: T) => string | number | Date | null | undefined;
  className?: string;
};

// Same rotating tint set used for the sidebar's nav icons and the leads
// board's avatars — reused here rather than a fourth palette, so a
// table's row numbers read as part of the same app. Row number, not row
// identity, drives the rotation: it's a stable always-available integer,
// and the point is decorative rhythm down the column, not per-record
// colour-coding. Retuned onto the new warm ramp.
const ROW_NUMBER_TINTS = [
  { bg: "var(--color-accent-tint)", fg: "var(--color-action-dark)" },
  { bg: "var(--color-info-tint)", fg: "var(--color-info)" },
  { bg: "var(--color-success-tint)", fg: "var(--color-success)" },
  { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" },
  { bg: "#ede9fe", fg: "#5b21b6" },
  { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#e0f2fe", fg: "#075985" },
];

type Density = "comfortable" | "compact";
const DENSITY_KEY = "dt-density";

// Past this many rows on screen, the table gets its own scroll
// container so the header can stick to the top of the card. Below it,
// the table stays in normal page flow — a sticky header on a six-row
// table does nothing except create a stacking context and trap the
// page scroll under the cursor.
const STICKY_THRESHOLD = 12;

// The one shared shape every dashboard table list was independently
// reinventing — a leading "#" column, search, an optional date-range
// filter, pagination, export, and the bordered/rounded card container —
// with search and export always landing on the same row instead of
// stacked. Every table gets all of it (or the pieces it opts into) for
// free instead of a page-by-page copy that drifts out of sync, as
// happened repeatedly before this component existed (misaligned
// filters, missing export buttons, inconsistent containers).
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "No results yet.",
  emptyHint,
  emptyAction,
  filteredEmptyMessage = "No results match your filters.",
  search,
  dateFilter,
  exportFilename,
  exportExtra,
  itemLabel = "results",
  minWidth = 640,
  toolbar,
  renderExpanded,
  isExpanded,
  onRowClick,
  rowStyle,
  fixedLayout,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  // Optional second line + call-to-action for the empty state. An empty
  // table that only says "nothing here" leaves the user to work out
  // whether that's a bug, a filter, or simply a thing they haven't done
  // yet — the hint says which, and the action gives them the way out.
  emptyHint?: ReactNode;
  emptyAction?: ReactNode;
  filteredEmptyMessage?: string;
  // Free-text search across whatever fields the caller wants matched.
  search?: { placeholder: string; filter: (row: T, query: string) => boolean };
  // A date column to drive the shared From/To DateRangeFilter.
  dateFilter?: { getDate: (row: T) => string | Date | null | undefined };
  // Omit to hide the Export button entirely (rare — e.g. sensitive data).
  exportFilename?: string;
  // Extra formats (a formatted PDF, say) folded into the same Export
  // control instead of sitting beside it as a second, competing button —
  // see ExportButton for why. No-op unless exportFilename is also set.
  exportExtra?: { label: string; href: string }[];
  itemLabel?: string;
  minWidth?: number;
  // Extra controls (a status <select>, etc.) rendered next to search.
  toolbar?: ReactNode;
  // For the "click a row to edit it inline" pattern (Employees) — renders
  // a full-width row directly under the row it belongs to.
  renderExpanded?: (row: T) => ReactNode;
  isExpanded?: (row: T) => boolean;
  // For the "click a row to open a detail drawer/modal" pattern (Leads).
  // Cells with their own interactive controls (selects, buttons, links)
  // should call e.stopPropagation() in their own onClick to opt out —
  // the row's onClick is a separate listener from each cell's.
  onRowClick?: (row: T) => void;
  // Per-row inline style (e.g. a colored accent border to flag a row
  // that needs attention) — for anything beyond that, prefer a column
  // instead of reaching for this.
  rowStyle?: (row: T) => CSSProperties | undefined;
  // table-layout: auto (the default) sizes each column from its content,
  // but browsers' rule for handing out *leftover* width — once the
  // table is wider than the sum of its columns' natural content widths,
  // which is the normal case since this table is w-full — is not
  // actually spec-guaranteed, and in practice still spreads surplus
  // width across short columns (dates, badges, counts) even when they
  // carry a "don't grow me" hint, leaving their data stranded on the
  // left with empty space trailing it. table-layout: fixed makes column
  // widths deterministic instead of a browser-dependent heuristic: give
  // every short column an explicit `w-[N%]` className and leave exactly
  // one column (the one meant to absorb the rest, e.g. Name/Organization)
  // with none — fixed layout hands that one column 100% minus the sum
  // of the others, by spec, not by hint.
  fixedLayout?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Density starts at the SSR-safe default and is corrected from
  // localStorage after mount — reading storage during render would
  // produce different markup on server and client and trip hydration.
  const [density, setDensity] = useState<Density>("comfortable");
  useEffect(() => {
    const kickoff = setTimeout(() => {
      const stored = window.localStorage.getItem(DENSITY_KEY);
      if (stored === "compact" || stored === "comfortable") setDensity(stored);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);
  function toggleDensity() {
    setDensity((d) => {
      const next: Density = d === "comfortable" ? "compact" : "comfortable";
      try {
        window.localStorage.setItem(DENSITY_KEY, next);
      } catch {
        // Private-mode/quota failures shouldn't break the toggle itself —
        // the preference just won't survive a reload.
      }
      return next;
    });
  }

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const dr = useDateRangeFilter(rows, dateFilter?.getDate ?? (() => null));
  const dateFiltered = dateFilter ? dr.filtered : rows;

  const filteredRows = useMemo(() => {
    if (!search) return dateFiltered;
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return dateFiltered;
    return dateFiltered.filter((r) => search.filter(r, q));
  }, [dateFiltered, search, debouncedQuery]);

  const sortColumn = sortKey ? columns.find((c) => c.key === sortKey) : undefined;
  const sortedRows = useMemo(() => {
    if (!sortColumn?.sortValue) return filteredRows;
    const getValue = sortColumn.sortValue;
    const withValue = filteredRows.map((row, i) => ({ row, i, value: getValue(row) }));
    withValue.sort((a, b) => {
      const av = a.value;
      const bv = b.value;
      if (av == null && bv == null) return a.i - b.i;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (av instanceof Date || bv instanceof Date) {
        cmp = new Date(av).getTime() - new Date(bv).getTime();
      } else if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return withValue.map((w) => w.row);
  }, [filteredRows, sortColumn, sortDir]);

  const { page, setPage, pageSize, setPageSize, pageItems, totalPages, total, start, end } = usePagination(sortedRows);

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortValue) return;
    if (sortKey !== column.key) {
      setSortKey(column.key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  }

  const exportableColumns = columns.filter((c) => c.exportValue);
  const hasToolbarRow = Boolean(search || dateFilter || exportFilename || toolbar);
  const scrolls = pageItems.length >= STICKY_THRESHOLD;

  const controlBase =
    "inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-xs font-semibold transition-colors";

  return (
    <div>
      {hasToolbarRow && (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-2">
            {search && (
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-ink-soft)" }} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={search.placeholder}
                  className="h-9 w-full rounded-[10px] border bg-[var(--color-paper-raised)] pl-9 pr-3 text-sm outline-none"
                  style={{ borderColor: "var(--color-line)" }}
                />
              </div>
            )}
            {dateFilter && (
              <DateRangeFilter from={dr.from} to={dr.to} onFromChange={dr.setFrom} onToChange={dr.setTo} onClear={dr.clear} active={dr.active} />
            )}
            {toolbar}
          </div>
          <div className="flex items-center gap-2">
            {/* Density is a genuine information-density control, not a
                cosmetic one — Compact fits roughly a third more rows on
                screen, which is the difference between scanning and
                scrolling on a long register. Persisted, because someone
                who wants dense tables wants them on every page. */}
            <button
              type="button"
              onClick={toggleDensity}
              className={`${controlBase} hover:border-[var(--color-action)] hover:text-[var(--color-action-dark)]`}
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
              aria-pressed={density === "compact"}
              title={density === "comfortable" ? "Switch to compact rows" : "Switch to comfortable rows"}
            >
              {density === "comfortable" ? <Rows3 className="h-3.5 w-3.5" /> : <Rows4 className="h-3.5 w-3.5" />}
              {density === "comfortable" ? "Comfortable" : "Compact"}
            </button>
            {exportFilename && (
              <ExportButton
                filename={exportFilename}
                headers={exportableColumns.map((c) => (typeof c.header === "string" ? c.header : c.key))}
                rows={sortedRows.map((row) => exportableColumns.map((c) => c.exportValue!(row) ?? ""))}
                extra={exportExtra}
              />
            )}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title={emptyMessage} hint={emptyHint} action={emptyAction} />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={filteredEmptyMessage}
          hint="Try a broader search term, or clear the filters above."
        />
      ) : (
        <>
          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            start={start}
            end={end}
            total={total}
            itemLabel={itemLabel}
          />
          <div
            className={`mt-3 overflow-x-auto rounded-[14px] border bg-[var(--color-paper-raised)] ${scrolls ? "dt-scroll" : ""}`}
            style={{ borderColor: "var(--color-line)", boxShadow: "var(--shadow-sm)" }}
          >
            <table
              className="dt-table w-full text-left text-sm"
              data-density={density}
              style={{ minWidth, tableLayout: fixedLayout ? "fixed" : undefined }}
            >
              <thead>
                <tr>
                  {/* whitespace-nowrap is load-bearing here, not cosmetic —
                      under fixedLayout this column is a bare 3-4% of the
                      table width, plenty for a single digit but not two.
                      Without it, row 10 onward wrapped as "1" / "0" on
                      separate lines the moment the row number hit double
                      digits — every table with fixedLayout and more than 9
                      rows on a page had this. */}
                  <th className="whitespace-nowrap" style={fixedLayout ? { width: "4%" } : undefined}>#</th>
                  {columns.map((c) => {
                    const sortable = Boolean(c.sortValue);
                    const active = sortKey === c.key;
                    return (
                      <th
                        key={c.key}
                        className={c.className}
                        // Drives both the screen-reader announcement and the
                        // sorted-column styling in globals.css — one source
                        // of truth for "this column is sorted" instead of a
                        // separate visual-only class that can drift out of
                        // sync with what's announced.
                        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                      >
                        {sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c)}
                            className="inline-flex items-center gap-1 transition-colors hover:text-[var(--color-action-dark)]"
                          >
                            {c.header}
                            {/* opacity-40 on var(--color-ink-soft) against
                                this header worked out to roughly 2:1
                                contrast — technically painted, not actually
                                legible at 12px. Full opacity for the idle
                                affordance; the active column gets its own
                                stronger color instead of relying on the icon
                                shape alone to say "sorted, and which way". */}
                            {active ? (
                              sortDir === "asc" ? (
                                <ChevronUp className="h-3.5 w-3.5" style={{ color: "var(--color-action)" }} />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--color-action)" }} />
                              )
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-55" />
                            )}
                          </button>
                        ) : (
                          c.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row, i) => {
                  const rowNumber = start + i;
                  const expanded = renderExpanded && isExpanded?.(row);
                  // rowNumber - 1: start is 1-based, so the very first row
                  // on every page always lands on the same tint otherwise.
                  const tint = ROW_NUMBER_TINTS[(rowNumber - 1) % ROW_NUMBER_TINTS.length];
                  return (
                    <Fragment key={getRowKey(row)}>
                      <tr
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        // Hover comes entirely from the .dt-table tbody
                        // tr:hover rule in globals.css now — a duplicate
                        // Tailwind hover class here previously raced it
                        // for the same specificity, and which one won was
                        // effectively arbitrary based on stylesheet order.
                        className={onRowClick ? "cursor-pointer" : undefined}
                        style={rowStyle?.(row)}
                      >
                        <td className="whitespace-nowrap">
                          {/* min-w-5 + px-1, not a fixed w-5 — a 3-digit row
                              number (rows-per-page goes to 100) would
                              overflow a hard circle; this stays circular for
                              1-2 digits and becomes a small pill beyond. */}
                          <span
                            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
                            style={{ backgroundColor: tint.bg, color: tint.fg }}
                          >
                            {rowNumber}
                          </span>
                        </td>
                        {columns.map((c) => (
                          <td key={c.key} className={c.className}>
                            {c.render(row, rowNumber)}
                          </td>
                        ))}
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={columns.length + 1} className="p-0">
                            {renderExpanded!(row)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// A real empty state rather than one grey sentence: a soft medallion,
// the reason the table is empty, and — where the caller supplies one —
// the action that fills it. This is the screen a new organization sees
// on almost every page, so it does more to set the tone of the product
// than any populated table does.
function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: React.ComponentType<{ className?: string; style?: CSSProperties }>;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="mt-3 flex flex-col items-center justify-center rounded-[14px] border px-6 py-14 text-center"
      style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper-raised)" }}
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}
      >
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
        {title}
      </p>
      {hint && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
          {hint}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
