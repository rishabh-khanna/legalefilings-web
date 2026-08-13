"use client";

import { useState, useEffect } from "react";
import { DataTable, type DataTableColumn } from "./DataTable";

type MobileDataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  mobileCardRender?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  search?: { placeholder: string; filter: (row: T, query: string) => boolean };
  dateFilter?: { getDate: (row: T) => string };
  exportFilename?: string;
  itemLabel?: string;
  onRowClick?: (row: T) => void;
};

/**
 * Mobile-friendly wrapper for DataTable
 * Automatically switches to card view on small screens
 */
export function MobileDataTable<T>({
  columns,
  rows,
  getRowKey,
  mobileCardRender,
  emptyMessage,
  search,
  dateFilter,
  exportFilename,
  itemLabel = "items",
  onRowClick,
}: MobileDataTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Mobile card view
  if (isMobile && mobileCardRender) {
    return (
      <div className="space-y-3">
        {/* Search and filters */}
        {search && (
          <div className="sticky top-0 z-10 bg-white p-2 border-b" style={{ borderColor: "var(--color-line)" }}>
            <input
              type="search"
              placeholder={search.placeholder}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--color-line)" }}
            />
          </div>
        )}

        {/* Card list */}
        {rows.length === 0 ? (
          <div className="py-8 text-center" style={{ color: "var(--color-ink-soft)" }}>
            {emptyMessage || `No ${itemLabel} found.`}
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={getRowKey(row)}
              onClick={() => onRowClick?.(row)}
              className="rounded-xl border bg-white p-4 transition-shadow active:shadow-md"
              style={{ borderColor: "var(--color-line)" }}
            >
              {mobileCardRender(row)}
            </div>
          ))
        )}
      </div>
    );
  }

  // Desktop table view
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={getRowKey}
      emptyMessage={emptyMessage}
      search={search}
      dateFilter={dateFilter}
      exportFilename={exportFilename}
      itemLabel={itemLabel}
      onRowClick={onRowClick}
    />
  );
}

/**
 * Mobile-optimized card component for lead/order data
 */
export function MobileLeadCard({ lead }: { lead: any }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold" style={{ color: "var(--color-ink)" }}>
            {lead.name}
          </p>
          {lead.company && (
            <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
              {lead.company}
            </p>
          )}
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            backgroundColor: lead.statusBg || "var(--color-accent-tint)",
            color: lead.statusFg || "var(--color-action)",
          }}
        >
          {lead.status}
        </span>
      </div>

      <div className="space-y-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>{lead.email}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span>{lead.phone}</span>
        </div>

        {(lead.city || lead.state) && (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{[lead.city, lead.state].filter(Boolean).join(", ")}</span>
          </div>
        )}
      </div>

      {lead.created_at && (
        <div className="pt-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>
          {new Date(lead.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      )}
    </div>
  );
}

/**
 * Mobile-optimized card for sessions
 */
export function MobileSessionCard({ session }: { session: any }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold" style={{ color: "var(--color-ink)" }}>
            {session.userName || session.userEmail}
          </p>
          <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
            {session.userEmail}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={
            session.isActive
              ? { backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" }
              : { backgroundColor: "var(--color-ink-tint)", color: "var(--color-ink-soft)" }
          }
        >
          {session.isActive ? "Active" : "Ended"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        <div>
          <p className="text-xs uppercase" style={{ color: "var(--color-ink-soft)" }}>Device</p>
          <p style={{ color: "var(--color-ink)" }}>{session.deviceType}</p>
        </div>
        <div>
          <p className="text-xs uppercase" style={{ color: "var(--color-ink-soft)" }}>Browser</p>
          <p style={{ color: "var(--color-ink)" }}>{session.browser}</p>
        </div>
        <div>
          <p className="text-xs uppercase" style={{ color: "var(--color-ink-soft)" }}>Duration</p>
          <p style={{ color: "var(--color-ink)" }}>{session.duration}</p>
        </div>
        <div>
          <p className="text-xs uppercase" style={{ color: "var(--color-ink-soft)" }}>IP</p>
          <p className="font-mono text-xs" style={{ color: "var(--color-ink)" }}>{session.ipAddress}</p>
        </div>
      </div>
    </div>
  );
}
