"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, IndianRupee, Users } from "lucide-react";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";

type StaffOption = { id: string; name: string };
type SalaryStructure = { basic: number; hra: number; special_allowance: number; bonus: number; incentives: number; effective_from: string } | null;
type PayslipRow = {
  id: string;
  month: number;
  year: number;
  gross_salary: number;
  net_salary: number;
  generated_at: string;
  profiles?: { full_name: string | null } | null;
};

function currentMonth() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export default function PayrollPage() {
  const { message, showSuccess, showError } = useActionMessage();
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [staffId, setStaffId] = useState("");
  const [structure, setStructure] = useState<SalaryStructure>(null);
  const [basic, setBasic] = useState("");
  const [hra, setHra] = useState("");
  const [specialAllowance, setSpecialAllowance] = useState("");
  const [bonus, setBonus] = useState("");
  const [incentives, setIncentives] = useState("");
  const [savingStructure, setSavingStructure] = useState(false);

  const [genMonth, setGenMonth] = useState(currentMonth().month);
  const [genYear, setGenYear] = useState(currentMonth().year);
  const [generating, setGenerating] = useState(false);

  const [payslips, setPayslips] = useState<PayslipRow[]>([]);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/team-members");
      const data = await res.json();
      const opts = ((data.members ?? []) as { id: string; full_name: string | null }[]).map((p) => ({ id: p.id, name: p.full_name ?? "Unnamed" }));
      setStaffOptions(opts);
      if (opts[0]) setStaffId(opts[0].id);
      await loadPayslips();
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  useEffect(() => {
    if (!staffId) return;
    fetch(`/api/payroll/salary-structure?staffId=${staffId}`)
      .then((res) => res.json())
      .then((data) => {
        setStructure(data.structure ?? null);
        setBasic(data.structure ? String(data.structure.basic) : "");
        setHra(data.structure ? String(data.structure.hra) : "");
        setSpecialAllowance(data.structure ? String(data.structure.special_allowance) : "");
        setBonus(data.structure ? String(data.structure.bonus) : "");
        setIncentives(data.structure ? String(data.structure.incentives) : "");
      });
  }, [staffId]);

  async function loadPayslips() {
    const res = await fetch("/api/payroll/payslips");
    const data = await res.json();
    setPayslips(data.payslips ?? []);
  }

  async function handleSaveStructure(e: React.FormEvent) {
    e.preventDefault();
    setSavingStructure(true);
    const res = await fetch("/api/payroll/salary-structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffId,
        basic: Number(basic),
        hra: Number(hra) || 0,
        specialAllowance: Number(specialAllowance) || 0,
        bonus: Number(bonus) || 0,
        incentives: Number(incentives) || 0,
      }),
    });
    setSavingStructure(false);
    if (res.ok) {
      showSuccess("Salary structure saved.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to save salary structure.");
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/payroll/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: genMonth, year: genYear }),
    });
    const data = await res.json();
    setGenerating(false);
    if (res.ok) {
      showSuccess(data.generated > 0 ? `Generated ${data.generated} payslip(s).` : (data.message ?? "No new payslips to generate."));
      await loadPayslips();
    } else {
      showError(data?.error ?? "Failed to generate payroll.");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-xs font-medium mb-1";

  const payrollTotal = useMemo(() => payslips.reduce((sum, p) => sum + Number(p.net_salary), 0), [payslips]);

  return (
    <div>
      <DashboardPageHero
        title="Payroll"
        subtitle="Set salary structures and generate monthly payslips. PF/ESI/Professional Tax use simplified standard rates — review before relying on them for statutory filing."
      >
        <div className="relative mt-6 grid grid-cols-3 gap-4">
          <HeroKpi icon={Users} label="Employees" value={staffOptions.length} />
          <HeroKpi icon={FileText} label="Payslips" value={payslips.length} />
          <HeroKpi icon={IndianRupee} label="Total Paid" value={`₹${payrollTotal.toLocaleString("en-IN")}`} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>Salary Structure</h3>
          <div className="mt-3">
            <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Employee</label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {structure && (
            <p className="mt-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>
              Current structure effective from {structure.effective_from}. Saving below adds a new structure (history is preserved).
            </p>
          )}
          <form onSubmit={handleSaveStructure} className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Basic (₹)</label>
              <input required type="number" min="0" value={basic} onChange={(e) => setBasic(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>HRA (₹)</label>
              <input type="number" min="0" value={hra} onChange={(e) => setHra(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Special Allowance (₹)</label>
              <input type="number" min="0" value={specialAllowance} onChange={(e) => setSpecialAllowance(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Bonus (₹)</label>
              <input type="number" min="0" value={bonus} onChange={(e) => setBonus(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Incentives (₹)</label>
              <input type="number" min="0" value={incentives} onChange={(e) => setIncentives(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <button
              type="submit"
              disabled={savingStructure}
              className="col-span-2 mt-2 rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              {savingStructure ? "Saving…" : "Save Salary Structure"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>Generate Salary</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>
            Creates a payslip for every employee with a saved salary structure — skips anyone who already has one for the selected month.
          </p>
          <div className="mt-3 flex items-end gap-3">
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Month</label>
              <select value={genMonth} onChange={(e) => setGenMonth(Number(e.target.value))} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{new Date(2000, m - 1).toLocaleDateString("en-IN", { month: "long" })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Year</label>
              <input type="number" value={genYear} onChange={(e) => setGenYear(Number(e.target.value))} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              {generating ? "Generating…" : "Generate Salary"}
            </button>
          </div>
        </div>
      </div>

      <h3 className="mt-8 font-semibold" style={{ color: "var(--color-ink)" }}>Payslips</h3>
      <div className="mt-3 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Employee</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Period</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Net Salary</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {payslips.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{p.profiles?.full_name ?? "—"}</td>
                <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
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
                <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No payslips generated yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
