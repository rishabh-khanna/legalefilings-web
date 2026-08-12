"use client";

import { useEffect, useState } from "react";
import { Clock, IndianRupee, CalendarCheck, Users, Building2, Receipt, Download, CalendarRange } from "lucide-react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";

// Same rotating tint set the row-number badges and lead avatars use
// elsewhere in the app, so this page's icons read as part of the same
// system instead of introducing a fifth palette. Assigned by hand per
// report rather than by array position, so a given report keeps its
// colour if the list is ever reordered.
const TINTS = {
  gold: { bg: "var(--color-accent-tint)", fg: "var(--color-action-dark)" },
  blue: { bg: "var(--color-info-tint)", fg: "var(--color-info)" },
  green: { bg: "var(--color-success-tint)", fg: "var(--color-success)" },
  purple: { bg: "#ede9fe", fg: "#5b21b6" },
  pink: { bg: "#fce7f3", fg: "#9d174d" },
  red: { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" },
};

// Grouped by what an admin is actually pulling this for — day-to-day
// people-ops data vs. the one finance export — rather than one flat
// list of six identical-looking cards.
const REPORT_GROUPS = [
  {
    label: "People & HR",
    reports: [
      { type: "attendance", label: "Attendance Report", description: "Every clock in/out event, optionally filtered by month below.", filterable: true, icon: Clock, tint: TINTS.blue },
      { type: "salary", label: "Salary Report", description: "Payslip totals across all employees, optionally filtered by month below.", filterable: true, icon: IndianRupee, tint: TINTS.green },
      { type: "leave", label: "Leave Report", description: "Every leave request and its status.", filterable: false, icon: CalendarCheck, tint: TINTS.gold },
      { type: "employees", label: "Employee List", description: "Every staff/admin account with core details.", filterable: false, icon: Users, tint: TINTS.purple },
      { type: "department", label: "Department-wise Report", description: "Employees grouped by department.", filterable: false, icon: Building2, tint: TINTS.pink },
    ],
  },
  {
    label: "Finance",
    reports: [
      { type: "invoice-ageing", label: "Invoice Ageing Report", description: "Every unpaid/overdue invoice with balance outstanding and days overdue (1-30 / 30-60 / 60-90 / 90+).", filterable: false, icon: Receipt, tint: TINTS.red },
    ],
  },
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

  return (
    <div>
      <DashboardPageHero
        title="Data Exports"
        subtitle={
          spansMultipleOrgs
            ? "Export data as CSV — opens directly in Excel or Google Sheets. Every export below pools every organization's data together, with an Organization column to tell rows apart."
            : "Export data as CSV — opens directly in Excel or Google Sheets."
        }
      >
        {/* Moved inside the hero, as a real toolbar control rather than a
            plain label+input sitting under it — it drives two of the six
            cards below, so it reads as part of the same unit instead of a
            page setting. */}
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          <label
            htmlFor="report-month"
            className="flex items-center gap-2 rounded-full border px-3.5 py-2"
            style={{ borderColor: "var(--gold-200)", backgroundColor: "color-mix(in srgb, var(--color-paper-raised) 70%, transparent)" }}
          >
            <CalendarRange className="h-4 w-4" style={{ color: "var(--color-action-dark)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>
              Month
            </span>
            <input
              id="report-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent text-sm font-medium outline-none"
              style={{ color: "var(--color-ink)" }}
            />
          </label>
          <span className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
            Applies to Attendance &amp; Salary only — every other report below always covers everything.
          </span>
        </div>
      </DashboardPageHero>

      <div className="space-y-8">
        {REPORT_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--color-ink-soft)" }}>
              {group.label}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.reports.map((r) => {
                const Icon = r.icon;
                return (
                  <div
                    key={r.type}
                    className="group relative flex flex-col gap-4 rounded-[16px] border p-5 transition-all duration-200 hover:-translate-y-0.5"
                    style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper-raised)", boxShadow: "var(--shadow-xs)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-md)")}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-xs)")}
                  >
                    <div className="flex items-start gap-3.5">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] transition-transform duration-200 group-hover:scale-105"
                        style={{ backgroundColor: r.tint.bg, color: r.tint.fg }}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold" style={{ color: "var(--color-ink)" }}>
                            {r.label}
                          </p>
                          {r.filterable && month && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                              style={{ backgroundColor: "var(--gold-100)", color: "var(--color-action-dark)" }}
                            >
                              {new Date(`${month}-01`).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
                          {r.description}
                        </p>
                      </div>
                    </div>

                    <a
                      href={reportHref(r.type)}
                      className="inline-flex items-center justify-center gap-1.5 self-start rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 hover:border-[var(--color-action)] hover:bg-[var(--gold-50)] hover:text-[var(--color-action-dark)]"
                      style={{ borderColor: "var(--color-line-strong)", color: "var(--color-ink)" }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
