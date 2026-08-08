"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, IndianRupee } from "lucide-react";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useDateRangeFilter } from "@/lib/use-date-range-filter";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { LoadingBlock } from "@/components/Spinner";
import { ExportButton } from "@/components/ExportButton";

type PayslipRow = {
  id: string;
  month: number;
  year: number;
  gross_salary: number;
  net_salary: number;
  generated_at: string;
  organization_id: string;
  profiles?: { full_name: string | null } | null;
  organizations?: { name: string | null } | null;
};

// The full company-wide payslip register — split out from
// /dashboard/admin/payroll (which is just the salary-structure form and
// the "Generate Salary" action) so viewing/filtering/paginating past
// payslips doesn't mean scrolling past a form every time.
export default function AdminPayslipsPage() {
  const [payslips, setPayslips] = useState<PayslipRow[] | null>(null);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/payroll/payslips");
      const data = await res.json();
      setPayslips(data.payslips ?? []);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const payrollTotal = useMemo(() => (payslips ?? []).reduce((sum, p) => sum + Number(p.net_salary), 0), [payslips]);
  const dateFilter = useDateRangeFilter(payslips ?? [], (p) => p.generated_at);
  const { page, setPage, pageSize, setPageSize, pageItems: pagedPayslips, totalPages, total, start, end } = usePagination(dateFilter.filtered);

  if (payslips === null) {
    return <LoadingBlock />;
  }

  // Only a platform_admin's request ever returns more than one org's
  // payslips pooled together — the column is only worth showing once
  // it's actually ambiguous which org a row belongs to.
  const spansMultipleOrgs = new Set(payslips.map((p) => p.organization_id)).size > 1;

  return (
    <div>
      <DashboardPageHero
        title="Payslips"
        subtitle="Every payslip generated across the company."
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

      <div className="mt-5">
        <DateRangeFilter
          from={dateFilter.from}
          to={dateFilter.to}
          onFromChange={dateFilter.setFrom}
          onToChange={dateFilter.setTo}
          onClear={dateFilter.clear}
          active={dateFilter.active}
        />
      </div>

      <div className="mt-3 flex justify-end">
        <ExportButton
          filename="payslips"
          headers={["Employee", "Period", "Net Salary", ...(spansMultipleOrgs ? ["Organization"] : [])]}
          rows={dateFilter.filtered.map((p) => [
            p.profiles?.full_name ?? "—",
            new Date(p.year, p.month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
            Number(p.net_salary),
            ...(spansMultipleOrgs ? [p.organizations?.name ?? "Unknown organization"] : []),
          ])}
        />
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        start={start}
        end={end}
        total={total}
        itemLabel="payslips"
      />

      <div className="mt-3 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="dt-table w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Employee</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Period</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Net Salary</th>
              {spansMultipleOrgs && <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Organization</th>}
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {pagedPayslips.map((p, i) => (
              <tr key={p.id}>
                <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{p.profiles?.full_name ?? "—"}</td>
                <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                  {new Date(p.year, p.month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                </td>
                <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>₹{Number(p.net_salary).toLocaleString("en-IN")}</td>
                {spansMultipleOrgs && <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{p.organizations?.name ?? "—"}</td>}
                <td className="px-4 py-3">
                  <a href={`/api/payroll/payslips/${p.id}/download`} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>
                    Download PDF
                  </a>
                </td>
              </tr>
            ))}
            {payslips.length === 0 && (
              <tr>
                <td colSpan={spansMultipleOrgs ? 6 : 5} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No payslips generated yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
