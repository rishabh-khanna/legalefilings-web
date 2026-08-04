"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, IndianRupee } from "lucide-react";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";

type PayslipRow = { id: string; month: number; year: number; net_salary: number };

export default function MyPayslipsPage() {
  const [payslips, setPayslips] = useState<PayslipRow[] | null>(null);
  const totalPaid = useMemo(() => (payslips ?? []).reduce((sum, p) => sum + Number(p.net_salary), 0), [payslips]);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/payroll/payslips");
      const data = await res.json();
      setPayslips(data.payslips ?? []);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  if (payslips === null) {
    return <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>;
  }

  return (
    <div>
      <DashboardPageHero title="My Payslips" subtitle="Every payslip generated for your account.">
        <div className="relative mt-6 grid grid-cols-2 gap-4">
          <HeroKpi icon={FileText} label="Payslips" value={payslips.length} />
          <HeroKpi icon={IndianRupee} label="Total Paid" value={`₹${totalPaid.toLocaleString("en-IN")}`} />
        </div>
      </DashboardPageHero>

      <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Period</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Net Salary</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {payslips.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>
                  {new Date(p.year, p.month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                </td>
                <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>₹{Number(p.net_salary).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3">
                  <a href={`/api/payroll/payslips/${p.id}/download`} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>
                    Download PDF
                  </a>
                </td>
              </tr>
            ))}
            {payslips.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No payslips yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
