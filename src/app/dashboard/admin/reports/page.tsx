"use client";

import { useEffect, useState } from "react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";

const REPORTS = [
  { type: "attendance", label: "Attendance Report", description: "Every clock in/out event, optionally filtered by month below.", filterable: true },
  { type: "salary", label: "Salary Report", description: "Payslip totals across all employees, optionally filtered by month below.", filterable: true },
  { type: "leave", label: "Leave Report", description: "Every leave request and its status.", filterable: false },
  { type: "employees", label: "Employee List", description: "Every staff/admin account with core details.", filterable: false },
  { type: "department", label: "Department-wise Report", description: "Employees grouped by department.", filterable: false },
  { type: "invoice-ageing", label: "Invoice Ageing Report", description: "Every unpaid/overdue invoice with balance outstanding and days overdue (1-30 / 30-60 / 60-90 / 90+).", filterable: false },
];

export default function ReportsPage() {
  const [month, setMonth] = useState("");
  // Cheap way to tell whether this viewer is a platform_admin without a
  // dedicated "who am I" endpoint — /api/team-members already pools every
  // org's staff for one and stays scoped to just this org otherwise, so
  // more than one distinct org name showing up means every export below
  // will be cross-org too (the same canSeeAllOrgs check /api/reports uses).
  const [spansMultipleOrgs, setSpansMultipleOrgs] = useState(false);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/team-members");
      const data = await res.json();
      const members = (data.members ?? []) as { organizationName?: string | null }[];
      setSpansMultipleOrgs(new Set(members.map((m) => m.organizationName)).size > 1);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

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
      <DashboardPageHero
        title="Data Exports"
        subtitle={
          spansMultipleOrgs
            ? "Export data as CSV — opens directly in Excel or Google Sheets. Every export below pools every organization's data together, with an Organization column to tell rows apart."
            : "Export data as CSV — opens directly in Excel or Google Sheets."
        }
      />

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
