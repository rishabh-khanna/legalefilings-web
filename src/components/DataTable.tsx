"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode, type CSSProperties } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
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
  filteredEmptyMessage = "No results match your filters.",
  search,
  dateFilter,
  exportFilename,
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
  filteredEmptyMessage?: string;
  // Free-text search across whatever fields the caller wants matched.
  search?: { placeholder: string; filter: (row: T, query: string) => boolean };
  // A date column to drive the shared From/To DateRangeFilter.
  dateFilter?: { getDate: (row: T) => string | Date | null | undefined };
  // Omit to hide the Export button entirely (rare — e.g. sensitive data).
  exportFilename?: string;
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

  return (
    <div>
      {hasToolbarRow && (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-2">
            {search && (
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-ink-soft)" }} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={search.placeholder}
                  className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-action)]"
                  style={{ borderColor: "var(--color-line)" }}
                />
              </div>
            )}
            {dateFilter && (
              <DateRangeFilter from={dr.from} to={dr.to} onFromChange={dr.setFrom} onToChange={dr.setTo} onClear={dr.clear} active={dr.active} />
            )}
            {toolbar}
          </div>
          {exportFilename && (
            <ExportButton
              filename={exportFilename}
              headers={exportableColumns.map((c) => (typeof c.header === "string" ? c.header : c.key))}
              rows={sortedRows.map((row) => exportableColumns.map((c) => c.exportValue!(row) ?? ""))}
            />
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>{emptyMessage}</p>
      ) : filteredRows.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>{filteredEmptyMessage}</p>
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
          <div className="mt-3 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
            <table className="dt-table w-full text-left text-sm" style={{ minWidth, tableLayout: fixedLayout ? "fixed" : undefined }}>
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
                      <th key={c.key} className={c.className}>
                        {sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c)}
                            className="inline-flex items-center gap-1 transition-colors hover:text-[var(--color-action-dark)]"
                          >
                            {c.header}
                            {/* opacity-40 on var(--color-ink-soft) (#5b6b81) against
                                this header's near-white gradient worked out to
                                roughly 2:1 contrast — technically painted, not
                                actually legible at 12px. Full opacity for the
                                idle affordance; the active column gets its own
                                stronger color instead of relying on the icon
                                shape alone to say "sorted, and which way". */}
                            {active ? (
                              sortDir === "asc" ? (
                                <ChevronUp className="h-3.5 w-3.5" style={{ color: "var(--color-action-dark)" }} />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--color-action-dark)" }} />
                              )
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5" />
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
                  return (
                    <Fragment key={getRowKey(row)}>
                      <tr
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        className={onRowClick ? "cursor-pointer transition-colors hover:bg-[var(--color-paper)]" : undefined}
                        style={rowStyle?.(row)}
                      >
                        <td className="whitespace-nowrap" style={{ color: "var(--color-ink-soft)" }}>{rowNumber}</td>
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
