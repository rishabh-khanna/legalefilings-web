"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, IndianRupee } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

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
  profiles?: { full_name: string | null } | null;
};

function deductionsOf(p: PayslipRow) {
  return Number(p.pf_deduction) + Number(p.esi_deduction) + Number(p.professional_tax) + Number(p.tds) + Number(p.lop_deduction);
}

export default function MyPayslipsPage() {
  const [payslips, setPayslips] = useState<PayslipRow[] | null>(null);
  const totalPaid = useMemo(() => (payslips ?? []).reduce((sum, p) => sum + Number(p.net_salary), 0), [payslips]);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      // /api/payroll/payslips returns every payslip in the org (or, for
      // a platform_admin, every org's) once the caller is admin or has
      // the delegated "payslips" tool — it only narrows to "just mine"
      // for a plain staff member with neither. This is the "My
      // Payslips" personal page, so an admin viewing their own history
      // here needs to force that same narrowing explicitly via
      // ?staffId=<their own id>, or they'd see the whole company's
      // payslips pooled together with no way to tell whose was whose.
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const res = await fetch(`/api/payroll/payslips?staffId=${user.id}`);
      const data = await res.json();
      setPayslips(data.payslips ?? []);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  if (payslips === null) {
    return <LoadingBlock />;
  }

  const columns: DataTableColumn<PayslipRow>[] = [
    { key: "employee", header: "Employee", render: (p) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{p.profiles?.full_name ?? "—"}</span>, exportValue: (p) => p.profiles?.full_name ?? "", sortValue: (p) => p.profiles?.full_name },
    {
      key: "period",
      header: "Period",
      className: "w-[18%] whitespace-nowrap",
      render: (p) => (
        <span className="font-medium" style={{ color: "var(--color-ink)" }}>
          {new Date(p.year, p.month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          {Number(p.lop_days) > 0 && (
            <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--color-danger-tint)", color: "var(--color-danger)" }}>
              {Number(p.lop_days)} LOP day{Number(p.lop_days) === 1 ? "" : "s"}
            </span>
          )}
        </span>
      ),
      exportValue: (p) => new Date(p.year, p.month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      sortValue: (p) => new Date(p.year, p.month - 1),
    },
    { key: "gross", header: "Gross Salary", className: "w-[14%] whitespace-nowrap", render: (p) => `₹${Number(p.gross_salary).toLocaleString("en-IN")}`, exportValue: (p) => Number(p.gross_salary), sortValue: (p) => Number(p.gross_salary) },
    { key: "deductions", header: "Deductions", className: "w-[14%] whitespace-nowrap", render: (p) => <span style={{ color: "var(--color-danger)" }}>−₹{deductionsOf(p).toLocaleString("en-IN")}</span>, exportValue: (p) => deductionsOf(p), sortValue: (p) => deductionsOf(p) },
    { key: "net", header: "Net Salary", className: "w-[14%] whitespace-nowrap", render: (p) => <span className="font-semibold" style={{ color: "var(--color-ink)" }}>₹{Number(p.net_salary).toLocaleString("en-IN")}</span>, exportValue: (p) => Number(p.net_salary), sortValue: (p) => Number(p.net_salary) },
    { key: "generated", header: "Generated On", className: "w-[14%] whitespace-nowrap", render: (p) => new Date(p.generated_at).toLocaleDateString("en-IN"), exportValue: (p) => new Date(p.generated_at).toLocaleDateString("en-IN"), sortValue: (p) => p.generated_at },
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
      <DashboardPageHero title="My Payslips" subtitle="Every payslip generated for your account.">
        <div className="relative mt-6 grid grid-cols-2 gap-4">
          <HeroKpi icon={FileText} label="Payslips" value={payslips.length} />
          <HeroKpi icon={IndianRupee} label="Total Paid" value={`₹${totalPaid.toLocaleString("en-IN")}`} />
        </div>
      </DashboardPageHero>

      <DataTable
        columns={columns}
        fixedLayout
        rows={payslips}
        getRowKey={(p) => p.id}
        itemLabel="payslips"
        emptyMessage="No payslips yet."
        dateFilter={{ getDate: (p) => new Date(p.year, p.month - 1, 1) }}
        exportFilename="payslips"
        minWidth={820}
      />
    </div>
  );
}
