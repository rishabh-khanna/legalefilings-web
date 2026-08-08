"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Plus, XCircle } from "lucide-react";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroAction, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DetailPickerModal, BalanceSummary } from "@/components/DetailPickerModal";

type LeaveRequest = {
  id: string;
  leave_type: "sick" | "casual" | "paid" | "unpaid";
  leave_type_id: string | null;
  leave_types: { name: string; code: string } | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
};

type LeaveTypeOption = { id: string; name: string; code: string; is_active: boolean };
type LeaveBalance = { leaveType: LeaveTypeOption & { annual_credit_days: number }; year: number; carriedForward: number; accrued: number; used: number; available: number };

const STATUS_STYLE: Record<LeaveRequest["status"], { bg: string; fg: string }> = {
  pending: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  approved: { bg: "#d0f4db", fg: "#116a2c" },
  rejected: { bg: "#fde2e2", fg: "#b42318" },
};

function requestLabel(r: LeaveRequest): string {
  if (r.leave_types) return r.leave_types.name;
  if (r.leave_type === "unpaid") return "Unpaid Leave";
  return r.leave_type === "sick" ? "Sick Leave" : r.leave_type === "casual" ? "Casual Leave" : "Paid Leave";
}

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  async function load() {
    const [reqRes, balancesRes] = await Promise.all([
      fetch("/api/leave-requests?scope=mine"),
      fetch("/api/leave-balances"),
    ]);
    if (reqRes.ok) setRequests((await reqRes.json()).requests);
    if (balancesRes.ok) setBalances((await balancesRes.json()).balances);
    setLoading(false);
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const selectedBalance = balances.find((b) => b.leaveType.id === leaveTypeId);
  const requestedDays =
    startDate && endDate
      ? Math.round((new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86400000) + 1
      : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Blocked client-side too, not just server-side — same rule
    // (paid-leave types are hard-capped at the remaining balance;
    // Unpaid Leave, leaveTypeId === "", has no limit) so the error
    // shows up before a round trip instead of only after Submit.
    if (selectedBalance && requestedDays > selectedBalance.available) {
      showError(`Only ${selectedBalance.available.toFixed(1)} day(s) of ${selectedBalance.leaveType.name} available — reduce the range or choose Unpaid Leave.`);
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/leave-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveTypeId: leaveTypeId || null, startDate, endDate, reason }),
    });
    setSubmitting(false);
    if (res.ok) {
      setShowForm(false);
      setLeaveTypeId("");
      setStartDate("");
      setEndDate("");
      setReason("");
      await load();
      showSuccess("Leave request submitted.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to submit leave request.");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  const leaveStats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "pending").length;
    const approved = requests.filter((r) => r.status === "approved").length;
    const rejected = requests.filter((r) => r.status === "rejected").length;
    return { total: requests.length, pending, approved, rejected };
  }, [requests]);

  const [statusFilter, setStatusFilter] = useState<LeaveRequest["status"] | "all">("all");
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => statusFilter === "all" || r.status === statusFilter);
  }, [requests, statusFilter]);

  if (loading) {
    return <LoadingBlock />;
  }

  return (
    <div>
      <DashboardPageHero
        title="Leave"
        subtitle="Apply for leave and track the status of your requests."
        action={
          <HeroAction icon={Plus} onClick={() => setShowForm(true)}>
            Apply for Leave
          </HeroAction>
        }
      >
        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HeroKpi icon={CalendarDays} label="Total" value={leaveStats.total} />
          <HeroKpi icon={Clock} label="Pending" value={leaveStats.pending} />
          <HeroKpi icon={CheckCircle2} label="Approved" value={leaveStats.approved} />
          <HeroKpi icon={XCircle} label="Rejected" value={leaveStats.rejected} />
        </div>
      </DashboardPageHero>

      {balances.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((b) => (
            <div key={b.leaveType.id} className="rounded-xl border bg-white px-4 py-3 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)", opacity: b.leaveType.is_active ? 1 : 0.65 }}>
              <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                {b.leaveType.name} <span className="font-normal" style={{ color: "var(--color-ink-soft)" }}>({b.leaveType.code})</span>
                {!b.leaveType.is_active && (
                  <span className="ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
                    Deactivated
                  </span>
                )}
              </p>
              <p className="mt-1 text-2xl font-extrabold" style={{ color: "var(--color-ink)" }}>{b.available.toFixed(1)} <span className="text-xs font-normal" style={{ color: "var(--color-ink-soft)" }}>days available</span></p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>{b.used} used · {b.carriedForward} carried in · {b.accrued.toFixed(1)} accrued this year</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowForm(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="grid w-full max-w-lg gap-3 rounded-2xl border bg-white p-5 shadow-xl sm:grid-cols-2 dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            <p className="text-sm font-bold sm:col-span-2" style={{ color: "var(--color-ink)" }}>Apply for Leave</p>
            <div className="sm:col-span-2">
              <DetailPickerModal
                value={leaveTypeId}
                onChange={setLeaveTypeId}
                options={balances
                  .filter((b) => b.leaveType.is_active)
                  .map((b) => ({
                    value: b.leaveType.id,
                    label: b.leaveType.name,
                    detail: `${b.available.toFixed(1)} days available`,
                  }))}
                emptyOptionLabel={{ value: "", label: "Unpaid Leave", detail: "No balance limit" }}
              />
            </div>
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            {requestedDays > 0 && (
              <div className="sm:col-span-2">
                {selectedBalance ? (
                  <BalanceSummary
                    available={selectedBalance.available}
                    requested={requestedDays}
                    overflowNote="This exceeds your balance — reduce the range or apply for Unpaid Leave instead."
                  />
                ) : (
                  <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Unpaid Leave has no balance limit — all {requestedDays} day{requestedDays === 1 ? "" : "s"} will be unpaid.</p>
                )}
              </div>
            )}
            <textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} sm:col-span-2`} style={{ borderColor: "var(--color-line)" }} />
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting || (!!selectedBalance && requestedDays > selectedBalance.available)}
                className="rounded-full px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "var(--color-action)" }}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
                style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {requests.length !== 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeaveRequest["status"] | "all")}
            className="rounded-lg border px-2.5 py-1.5 text-sm outline-none"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {statusFilter !== "all" && (
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className="text-xs font-semibold"
              style={{ color: "var(--color-action-dark)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="mt-5 text-sm" style={{ color: "var(--color-ink-soft)" }}>No leave requests yet.</p>
      ) : filteredRequests.length === 0 ? (
        <p className="mt-5 text-sm" style={{ color: "var(--color-ink-soft)" }}>No requests match this filter.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <table className="dt-table w-full min-w-[640px]">
            <thead>
              <tr className="text-left">
                <th>#</th>
                <th>Leave Type</th>
                <th>Dates</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r, i) => {
                const style = STATUS_STYLE[r.status];
                return (
                  <tr key={r.id}>
                    <td style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                    <td className="font-semibold" style={{ color: "var(--color-ink)" }}>{requestLabel(r)}</td>
                    <td style={{ color: "var(--color-ink-soft)" }}>{r.start_date} → {r.end_date}</td>
                    <td className="max-w-xs italic" style={{ color: "var(--color-ink-soft)" }}>{r.reason ? `“${r.reason}”` : "—"}</td>
                    <td>
                      <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                        {r.status}
                      </span>
                    </td>
                    <td className="max-w-xs" style={{ color: r.status === "rejected" && r.review_note ? "#b42318" : "var(--color-ink-soft)" }}>
                      {r.status === "rejected" && r.review_note ? r.review_note : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
