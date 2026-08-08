"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, IndianRupee } from "lucide-react";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useDateRangeFilter } from "@/lib/use-date-range-filter";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExportButton } from "@/components/ExportButton";

type PayslipRow = {
  id: string;
  month: number;
  year: number;
  gross_salary: number;
  net_salary: number;
  lop_days: number;
  pf_deduction: number;
  esi_deduction: number;
  professional_tax: number;
  tds: number;
  lop_deduction: number;
  generated_at: string;
};

export default function MyPayslipsPage() {
  const [payslips, setPayslips] = useState<PayslipRow[] | null>(null);
  const totalPaid = useMemo(() => (payslips ?? []).reduce((sum, p) => sum + Number(p.net_salary), 0), [payslips]);
  const dateFilter = useDateRangeFilter(payslips ?? [], (p) => new Date(p.year, p.month - 1, 1));
  const { page, setPage, pageSize, setPageSize, pageItems: pagedPayslips, totalPages, total, start, end } = usePagination(dateFilter.filtered);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/payroll/payslips");
      const data = await res.json();
      setPayslips(data.payslips ?? []);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  if (payslips === null) {
    return <LoadingBlock />;
  }

  return (
    <div>
      <DashboardPageHero title="My Payslips" subtitle="Every payslip generated for your account.">
        <div className="relative mt-6 grid grid-cols-2 gap-4">
          <HeroKpi icon={FileText} label="Payslips" value={payslips.length} />
          <HeroKpi icon={IndianRupee} label="Total Paid" value={`₹${totalPaid.toLocaleString("en-IN")}`} />
        </div>
      </DashboardPageHero>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter
          from={dateFilter.from}
          to={dateFilter.to}
          onFromChange={dateFilter.setFrom}
          onToChange={dateFilter.setTo}
          onClear={dateFilter.clear}
          active={dateFilter.active}
        />
        <ExportButton
          filename="payslips"
          headers={["Period", "Gross Salary", "Deductions", "Net Salary", "LOP Days", "Generated On"]}
          rows={dateFilter.filtered.map((p) => [
            new Date(p.year, p.month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
            Number(p.gross_salary),
            Number(p.pf_deduction) + Number(p.esi_deduction) + Number(p.professional_tax) + Number(p.tds) + Number(p.lop_deduction),
            Number(p.net_salary),
            Number(p.lop_days),
            new Date(p.generated_at).toLocaleDateString("en-IN"),
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
        <table className="dt-table w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Period</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Gross Salary</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Deductions</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Net Salary</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Generated On</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {pagedPayslips.map((p, i) => {
              const deductions = Number(p.pf_deduction) + Number(p.esi_deduction) + Number(p.professional_tax) + Number(p.tds) + Number(p.lop_deduction);
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>
                    {new Date(p.year, p.month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    {Number(p.lop_days) > 0 && (
                      <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "#fde2e2", color: "#b42318" }}>
                        {Number(p.lop_days)} LOP day{Number(p.lop_days) === 1 ? "" : "s"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>₹{Number(p.gross_salary).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3" style={{ color: "#b42318" }}>−₹{deductions.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>₹{Number(p.net_salary).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{new Date(p.generated_at).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <a href={`/api/payroll/payslips/${p.id}/download`} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>
                      Download PDF
                    </a>
                  </td>
                </tr>
              );
            })}
            {payslips.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No payslips yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
