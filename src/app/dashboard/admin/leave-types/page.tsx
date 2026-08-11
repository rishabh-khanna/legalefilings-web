"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { RequiredMark } from "@/components/RequiredMark";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

type LeaveType = { id: string; name: string; code: string; annual_credit_days: number; carry_forward_cap: number; is_active: boolean; creator?: { full_name: string | null } | null };

// Admin-only (or a staff member individually delegated the "leave_types"
// tool). Each org defines its own leave types here — a yearly credit
// (accrued monthly, computed on read rather than via a cron — see
// src/lib/leave-balance.ts) and how many unused days carry into the next
// year before the rest lapses. Staff picks from these (or "Unpaid",
// which is fixed and never shown here) on the Leave page.
export default function LeaveTypesPage() {
  const [types, setTypes] = useState<LeaveType[] | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [annualCreditDays, setAnnualCreditDays] = useState("12");
  const [carryForwardCap, setCarryForwardCap] = useState("5");
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { message, showSuccess, showError } = useActionMessage();

  async function load() {
    const res = await fetch("/api/leave-types");
    const data = await res.json();
    if (res.ok) setTypes(data.leaveTypes);
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleCreate() {
    if (!name.trim() || !code.trim()) return;
    setCreating(true);
    const res = await fetch("/api/leave-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), code: code.trim(), annualCreditDays: Number(annualCreditDays), carryForwardCap: Number(carryForwardCap) }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      setCode("");
      setAnnualCreditDays("12");
      setCarryForwardCap("5");
      showSuccess("Leave type created.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to create leave type.");
    }
  }

  async function handleUpdate(t: LeaveType, patch: Record<string, unknown>) {
    setSavingId(t.id);
    const res = await fetch(`/api/leave-types/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavingId(null);
    if (res.ok) {
      showSuccess("Updated.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to update.");
    }
  }

  const inputClass = "w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-action)]";

  const columns: DataTableColumn<LeaveType>[] = [
    {
      key: "name",
      header: "Name",
      render: (t) => <>{t.name} <span className="font-normal" style={{ color: "var(--color-ink-soft)" }}>({t.code})</span></>,
      className: "font-semibold",
      exportValue: (t) => `${t.name} (${t.code})`,
      sortValue: (t) => t.name,
    },
    {
      key: "days",
      header: "Days/Year",
      className: "w-[16%] whitespace-nowrap",
      render: (t) => (
        <input
          type="number"
          min="0"
          defaultValue={t.annual_credit_days}
          disabled={savingId === t.id}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v) && v !== t.annual_credit_days) handleUpdate(t, { annualCreditDays: v });
          }}
          className="w-20 rounded-lg border px-2 py-1 text-xs"
          style={{ borderColor: "var(--color-line)" }}
        />
      ),
      exportValue: (t) => t.annual_credit_days,
      sortValue: (t) => t.annual_credit_days,
    },
    {
      key: "carryForward",
      header: "Carry-Forward Cap",
      className: "w-[20%] whitespace-nowrap",
      render: (t) => (
        <input
          type="number"
          min="0"
          defaultValue={t.carry_forward_cap}
          disabled={savingId === t.id}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v) && v !== t.carry_forward_cap) handleUpdate(t, { carryForwardCap: v });
          }}
          className="w-20 rounded-lg border px-2 py-1 text-xs"
          style={{ borderColor: "var(--color-line)" }}
        />
      ),
      exportValue: (t) => t.carry_forward_cap,
    },
    {
      key: "createdBy",
      header: "Created By",
      className: "w-[16%] whitespace-nowrap",
      render: (t) => <span style={{ color: "var(--color-ink-soft)" }}>{t.creator?.full_name ?? "—"}</span>,
      exportValue: (t) => t.creator?.full_name ?? "",
      sortValue: (t) => t.creator?.full_name,
    },
    {
      key: "actions",
      header: "",
      render: (t) => (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Deactivate "${t.name}"? Staff won't be able to apply for this leave type anymore, but existing leave records are unaffected.`)) handleUpdate(t, { isActive: false });
          }}
          disabled={savingId === t.id}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
          style={{ borderColor: "var(--color-line)" }}
        >
          Deactivate
        </button>
      ),
    },
  ];

  return (
    <div>
      <DashboardPageHero title="Leave Types" subtitle="Define the leave types your team can apply for, with a yearly credit and carry-forward cap.">
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:max-w-xs">
          <HeroKpi icon={CalendarClock} label="Active Types" value={(types ?? []).filter((t) => t.is_active).length} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      <div className="mt-3 rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Add Leave Type</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Name<RequiredMark /></label>
            <input placeholder="e.g. Earned Leave" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Code<RequiredMark /></label>
            <input placeholder="e.g. EL" value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <input type="number" min="0" placeholder="Days/year" value={annualCreditDays} onChange={(e) => setAnnualCreditDays(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} title="Credited monthly (annual / 12), computed automatically" />
          <input type="number" min="0" placeholder="Carry-forward cap" value={carryForwardCap} onChange={(e) => setCarryForwardCap(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} title="Max unused days that carry into next year; 0 = no carry-forward" />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !name.trim() || !code.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>Days/year accrues monthly automatically. Carry-forward cap is the max unused balance that rolls into next year — the rest lapses.</p>
      </div>

      {types === null ? (
        <LoadingBlock className="mt-6" />
      ) : (
        <DataTable
          columns={columns}
          fixedLayout
          rows={types}
          getRowKey={(t) => t.id}
          itemLabel="leave types"
          emptyMessage="No leave types yet — add one above."
          search={{ placeholder: "Search leave type…", filter: (t, q) => `${t.name} ${t.code}`.toLowerCase().includes(q) }}
          exportFilename="leave-types"
          minWidth={560}
        />
      )}
    </div>
  );
}
