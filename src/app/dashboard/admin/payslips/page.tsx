"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, IndianRupee } from "lucide-react";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";
import { SearchButton } from "@/components/SearchButton";

type PayslipRow = {
  id: string;
  staff_id: string;
  month: number;
  year: number;
  gross_salary: number;
  net_salary: number;
  generated_at: string;
  organization_id: string;
  profiles?: { full_name: string | null } | null;
  organizations?: { name: string | null } | null;
  generator?: { full_name: string | null } | null;
};

// The full company-wide payslip register — split out from
// /dashboard/admin/payroll (which is just the salary-structure form and
// the "Generate Salary" action) so viewing/filtering/paginating past
// payslips doesn't mean scrolling past a form every time.
export default function AdminPayslipsPage() {
  const [payslips, setPayslips] = useState<PayslipRow[] | null>(null);
  const [draftEmployeeFilter, setDraftEmployeeFilter] = useState<Set<string>>(new Set());
  const [employeeFilter, setEmployeeFilter] = useState<Set<string>>(new Set());
  const employeeFilterDirty = draftEmployeeFilter.size !== employeeFilter.size || [...draftEmployeeFilter].some((v) => !employeeFilter.has(v));

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/payroll/payslips");
      const data = await res.json();
      setPayslips(data.payslips ?? []);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const payrollTotal = useMemo(() => (payslips ?? []).reduce((sum, p) => sum + Number(p.net_salary), 0), [payslips]);

  // Replaces the old group-by-employee clustering — one dropdown to narrow
  // the table to a single person instead of the whole register visually
  // reorganized around them. Built from whoever's actually in the current
  // data (not a separate staff-list fetch), so it never lists someone with
  // zero payslips to filter down to.
  const employeeOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const p of payslips ?? []) {
      if (!byId.has(p.staff_id)) byId.set(p.staff_id, p.profiles?.full_name ?? "Unknown");
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [payslips]);
  const filteredPayslips = useMemo(
    () => (employeeFilter.size === 0 ? (payslips ?? []) : (payslips ?? []).filter((p) => employeeFilter.has(p.staff_id))),
    [payslips, employeeFilter]
  );

  if (payslips === null) {
    return <LoadingBlock />;
  }

  // Only a platform_admin's request ever returns more than one org's
  // payslips pooled together — the column is only worth showing once
  // it's actually ambiguous which org a row belongs to.
  const spansMultipleOrgs = new Set(payslips.map((p) => p.organization_id)).size > 1;

  const columns: DataTableColumn<PayslipRow>[] = [
    { key: "employee", header: "Employee", render: (p) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{p.profiles?.full_name ?? "—"}</span>, exportValue: (p) => p.profiles?.full_name ?? "", sortValue: (p) => p.profiles?.full_name },
    {
      key: "period",
      header: "Period",
      className: "w-[18%] whitespace-nowrap",
      render: (p) => new Date(p.year, p.month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      exportValue: (p) => new Date(p.year, p.month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      sortValue: (p) => new Date(p.year, p.month - 1),
    },
    { key: "net", header: "Net Salary", className: "w-[14%] whitespace-nowrap", render: (p) => <span className="font-semibold" style={{ color: "var(--color-ink)" }}>₹{Number(p.net_salary).toLocaleString("en-IN")}</span>, exportValue: (p) => Number(p.net_salary), sortValue: (p) => Number(p.net_salary) },
    {
      key: "generatedOn",
      header: "Generated",
      className: "w-[14%] whitespace-nowrap",
      render: (p) => (
        <>
          {new Date(p.generated_at).toLocaleDateString("en-IN")}
          {p.generator?.full_name && <span className="block text-xs" style={{ color: "var(--color-ink-soft)" }}>by {p.generator.full_name}</span>}
        </>
      ),
      exportValue: (p) => `${new Date(p.generated_at).toLocaleDateString("en-IN")}${p.generator?.full_name ? ` (${p.generator.full_name})` : ""}`,
      sortValue: (p) => p.generated_at,
    },
    ...(spansMultipleOrgs
      ? [{ key: "org", header: "Organization", render: (p: PayslipRow) => p.organizations?.name ?? "—", exportValue: (p: PayslipRow) => p.organizations?.name ?? "Unknown organization" } as DataTableColumn<PayslipRow>]
      : []),
    {
      key: "actions",
      header: "",
      render: (p) => (
        <a href={`/api/payroll/payslips/${p.id}/download`} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>
          Download PDF
        </a>
      ),
    },
  ];

  return (
    <div>
      <DashboardPageHero
        title="Payslips"
        subtitle={spansMultipleOrgs ? "Every payslip generated across every organization, pooled here for platform-level support." : "Every payslip generated across the company."}
        action={
          <Link
            href="/dashboard/admin/payroll"
            className="inline-flex items-center gap-1.5 rounded-full border bg-white/70 px-4 py-2 text-sm font-semibold backdrop-blur-xl transition-colors hover:bg-white"
            style={{ borderColor: "var(--color-accent)", color: "var(--color-ink)" }}
          >
            <ArrowLeft className="h-4 w-4" /> Salary Structure & Generate
          </Link>
        }
      >
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <HeroKpi icon={FileText} label="Payslips" value={payslips.length} />
          <HeroKpi icon={IndianRupee} label="Total Paid" value={`₹${payrollTotal.toLocaleString("en-IN")}`} />
        </div>
      </DashboardPageHero>

      <DataTable
        columns={columns}
        fixedLayout
        rows={filteredPayslips}
        getRowKey={(p) => p.id}
        itemLabel="payslips"
        emptyMessage="No payslips generated yet."
        filteredEmptyMessage="No payslips for this employee in the selected range."
        search={{ placeholder: "Search employee…", filter: (p, q) => (p.profiles?.full_name ?? "").toLowerCase().includes(q) }}
        dateFilter={{ getDate: (p) => p.generated_at }}
        exportFilename="payslips"
        toolbar={
          <>
            <MultiSelect
              options={employeeOptions.map(([id, name]) => ({ value: id, label: name }))}
              selected={draftEmployeeFilter}
              onChange={setDraftEmployeeFilter}
              placeholder="All employees"
              searchable
            />
            <SearchButton onClick={() => setEmployeeFilter(draftEmployeeFilter)} dirty={employeeFilterDirty} />
          </>
        }
      />
    </div>
  );
}
