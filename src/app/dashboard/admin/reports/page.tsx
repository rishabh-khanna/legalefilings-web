"use client";

import { useState } from "react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";

const REPORTS = [
  { type: "attendance", label: "Attendance Report", description: "Every clock in/out event, optionally filtered by month below.", filterable: true },
  { type: "salary", label: "Salary Report", description: "Payslip totals across all employees, optionally filtered by month below.", filterable: true },
  { type: "leave", label: "Leave Report", description: "Every leave request and its status.", filterable: false },
  { type: "employees", label: "Employee List", description: "Every staff/admin account with core details.", filterable: false },
  { type: "department", label: "Department-wise Report", description: "Employees grouped by department.", filterable: false },
];

export default function ReportsPage() {
  const [month, setMonth] = useState("");

  function reportHref(type: string) {
    const params = new URLSearchParams({ type });
    if (month) {
      const [y, m] = month.split("-");
      if (type === "attendance") params.set("month", month);
      if (type === "salary") {
        params.set("month", String(Number(m)));
        params.set("year", y);
      }
    }
    return `/api/reports?${params.toString()}`;
  }

  const inputClass = "rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  return (
    <div>
      <DashboardPageHero title="Reports" subtitle="Export data as CSV — opens directly in Excel or Google Sheets." />

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>
          Month filter (applies to Attendance &amp; Salary reports only)
        </label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <div key={r.type} className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
            <div>
              <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{r.label}</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>{r.description}</p>
            </div>
            <a
              href={reportHref(r.type)}
              className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              Export CSV
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
