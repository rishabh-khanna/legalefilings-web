"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Plus, XCircle } from "lucide-react";
import { useActionMessage } from "@/lib/use-action-message";
import { useConfirm } from "@/lib/use-confirm";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroAction, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DetailPickerModal, BalanceSummary } from "@/components/DetailPickerModal";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { TruncatedText } from "@/components/TruncatedText";
import { MultiSelect } from "@/components/MultiSelect";
import { SearchButton } from "@/components/SearchButton";
import { countWorkingDays } from "@/lib/working-days";

type LeaveRequest = {
  id: string;
  leave_type: "sick" | "casual" | "paid" | "unpaid";
  leave_type_id: string | null;
  leave_types: { name: string; code: string } | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  review_note: string | null;
  created_at: string;
  // Working days in the range × the half-day fraction — computed
  // server-side (see /api/leave-requests) so this and the admin queue
  // never disagree on what a request actually costs.
  requestedDays: number;
  reviewer?: { full_name: string | null } | null;
};

type LeaveTypeOption = { id: string; name: string; code: string; is_active: boolean };
type LeaveBalance = { leaveType: LeaveTypeOption & { annual_credit_days: number }; year: number; carriedForward: number; accrued: number; used: number; available: number };

const STATUS_STYLE: Record<LeaveRequest["status"], { bg: string; fg: string }> = {
  pending: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  approved: { bg: "var(--color-success-tint)", fg: "var(--color-success)" },
  rejected: { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" },
  // Deliberately neutral, not red — a withdrawn request isn't a refusal
  // and shouldn't read like one next to a genuine rejection.
  cancelled: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
};

// Only future-dated leave can be withdrawn: once it has started the
// person was actually absent, so handing the balance back would pay
// them for days they genuinely took.
function canCancel(r: LeaveRequest): boolean {
  if (r.status !== "pending" && r.status !== "approved") return false;
  return r.start_date > new Date().toISOString().slice(0, 10);
}

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
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [halfDay, setHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<"first_half" | "second_half">("first_half");
  const { message, showSuccess, showError } = useActionMessage();
  const { confirm, confirmDialog } = useConfirm();

  async function load() {
    const [reqRes, balancesRes, holidaysRes] = await Promise.all([
      fetch("/api/leave-requests?scope=mine"),
      fetch("/api/leave-balances"),
      fetch("/api/holidays"),
    ]);
    if (reqRes.ok) setRequests((await reqRes.json()).requests);
    if (balancesRes.ok) setBalances((await balancesRes.json()).balances);
    if (holidaysRes.ok) {
      const { holidays } = await holidaysRes.json();
      setHolidayDates(new Set((holidays ?? []).map((h: { date: string }) => String(h.date).slice(0, 10))));
    }
    setLoading(false);
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const selectedBalance = balances.find((b) => b.leaveType.id === leaveTypeId);
  // Must match the server exactly (working days x fraction, holidays
  // excluded) — a preview counting raw calendar days would tell someone
  // a Friday-to-Monday request costs 4 days while the API charges 2.
  const requestedDays =
    startDate && endDate ? countWorkingDays(startDate, endDate, holidayDates) * (halfDay ? 0.5 : 1) : 0;

  async function handleCancel(r: LeaveRequest) {
    const isPending = r.status === "pending";
    const confirmText = isPending
      ? "Withdraw this leave request?"
      : "Cancel this approved leave? The days go back to your balance.";
    if (!(await confirm(confirmText, { confirmLabel: isPending ? "Withdraw" : "Cancel Leave", danger: true }))) return;
    setCancellingId(r.id);
    const res = await fetch(`/api/leave-requests/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "cancel" }),
    });
    setCancellingId(null);
    if (res.ok) {
      showSuccess(isPending ? "Request withdrawn." : "Leave cancelled — the days are back in your balance.");
      // Reload rather than patch in place: cancelling an approved
      // request changes the balance cards above the table too.
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Could not cancel this request.");
    }
  }

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
      body: JSON.stringify({ leaveTypeId: leaveTypeId || null, startDate, endDate, reason, halfDay, halfDayPeriod }),
    });
    setSubmitting(false);
    if (res.ok) {
      setShowForm(false);
      setLeaveTypeId("");
      setStartDate("");
      setEndDate("");
      setReason("");
      setHalfDay(false);
      setHalfDayPeriod("first_half");
      await load();
      showSuccess("Leave request submitted.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to submit leave request.");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  const leaveByStatus = useMemo(() => {
    return {
      pending: requests.filter((r) => r.status === "pending"),
      approved: requests.filter((r) => r.status === "approved"),
      rejected: requests.filter((r) => r.status === "rejected"),
    };
  }, [requests]);

  const [draftStatusFilter, setDraftStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const statusFilterDirty = draftStatusFilter.size !== statusFilter.size || [...draftStatusFilter].some((v) => !statusFilter.has(v));
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => statusFilter.size === 0 || statusFilter.has(r.status));
  }, [requests, statusFilter]);

  if (loading) {
    return <LoadingBlock />;
  }

  const columns: DataTableColumn<LeaveRequest>[] = [
    { key: "type", header: "Leave Type", className: "w-[14%] whitespace-nowrap", render: (r) => <span className="font-semibold" style={{ color: "var(--color-ink)" }}>{requestLabel(r)}</span>, exportValue: (r) => requestLabel(r), sortValue: (r) => requestLabel(r) },
    { key: "dates", header: "Dates", className: "w-[16%] whitespace-nowrap", render: (r) => `${r.start_date} → ${r.end_date}`, exportValue: (r) => `${r.start_date} to ${r.end_date}`, sortValue: (r) => r.start_date },
    {
      key: "totalDays",
      header: "Total Days",
      className: "w-[8%] whitespace-nowrap",
      render: (r) => <span className="font-semibold tabular-nums" style={{ color: "var(--color-ink)" }}>{r.requestedDays}</span>,
      exportValue: (r) => r.requestedDays,
      sortValue: (r) => r.requestedDays,
    },
    {
      key: "requestedOn",
      header: "Requested On",
      className: "w-[12%] whitespace-nowrap",
      render: (r) => new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      exportValue: (r) => new Date(r.created_at).toLocaleDateString("en-IN"),
      sortValue: (r) => r.created_at,
    },
    { key: "reason", header: "Reason", className: "max-w-[180px]", render: (r) => (r.reason ? <TruncatedText text={`“${r.reason}”`} italic style={{ color: "var(--color-ink-soft)" }} /> : "—"), exportValue: (r) => r.reason ?? "" },
    {
      key: "status",
      header: "Status",
      className: "w-[10%] whitespace-nowrap",
      render: (r) => (
        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: STATUS_STYLE[r.status].bg, color: STATUS_STYLE[r.status].fg }}>
          {r.status}
        </span>
      ),
      exportValue: (r) => r.status,
      sortValue: (r) => r.status,
    },
    {
      key: "note",
      header: "Note",
      className: "max-w-[160px]",
      render: (r) =>
        r.status === "rejected" && r.review_note ? (
          <TruncatedText text={r.review_note} style={{ color: "var(--color-danger)" }} />
        ) : (
          <span style={{ color: "var(--color-ink-soft)" }}>—</span>
        ),
      exportValue: (r) => (r.status === "rejected" ? r.review_note ?? "" : ""),
    },
    {
      key: "reviewedBy",
      header: "Reviewed By",
      className: "w-[10%] whitespace-nowrap",
      render: (r) => (r.status === "pending" ? <span style={{ color: "var(--color-ink-soft)" }}>—</span> : r.reviewer?.full_name ?? "—"),
      exportValue: (r) => (r.status === "pending" ? "" : r.reviewer?.full_name ?? ""),
      sortValue: (r) => r.reviewer?.full_name,
    },
    {
      key: "actions",
      header: "",
      className: "w-[12%] whitespace-nowrap",
      render: (r) =>
        canCancel(r) ? (
          <button
            type="button"
            onClick={() => handleCancel(r)}
            disabled={cancellingId === r.id}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-red-50 disabled:opacity-60"
            style={{ borderColor: "var(--color-line)", color: "var(--color-danger)" }}
          >
            {cancellingId === r.id ? "Cancelling…" : r.status === "pending" ? "Withdraw" : "Cancel"}
          </button>
        ) : null,
    },
  ];

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
          <HeroKpi icon={CalendarDays} label="Total" value={requests.length} />
          <HeroKpi icon={Clock} label="Pending" value={leaveByStatus.pending.length} />
          <HeroKpi icon={CheckCircle2} label="Approved" value={leaveByStatus.approved.length} />
          <HeroKpi icon={XCircle} label="Rejected" value={leaveByStatus.rejected.length} />
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
      {confirmDialog}

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
            <input
              required
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (halfDay) setEndDate(e.target.value);
              }}
              className={inputClass}
              style={{ borderColor: "var(--color-line)" }}
            />
            <input
              required
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={halfDay}
              className={inputClass}
              style={{ borderColor: "var(--color-line)" }}
            />
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-ink)" }}>
                <input
                  type="checkbox"
                  checked={halfDay}
                  onChange={(e) => {
                    setHalfDay(e.target.checked);
                    // A half day is always one date — mirror start into
                    // end so the form can't submit a range the API and
                    // the DB constraint would both reject.
                    if (e.target.checked) setEndDate(startDate);
                  }}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: "var(--color-action)" }}
                />
                Half day
              </label>
              {halfDay && (
                <select
                  value={halfDayPeriod}
                  onChange={(e) => setHalfDayPeriod(e.target.value as "first_half" | "second_half")}
                  className="rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                  style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                >
                  <option value="first_half">First half</option>
                  <option value="second_half">Second half</option>
                </select>
              )}
            </div>
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

      <DataTable
        columns={columns}
        fixedLayout
        rows={filteredRequests}
        getRowKey={(r) => r.id}
        itemLabel="requests"
        emptyMessage={requests.length === 0 ? "No leave requests yet." : "No requests match this filter."}
        exportFilename="my-leave-requests"
        toolbar={
          <>
            <MultiSelect
              options={[
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              selected={draftStatusFilter}
              onChange={setDraftStatusFilter}
              placeholder="All statuses"
            />
            <SearchButton onClick={() => setStatusFilter(draftStatusFilter)} dirty={statusFilterDirty} />
            {statusFilter.size > 0 && (
              <button
                type="button"
                onClick={() => { setDraftStatusFilter(new Set()); setStatusFilter(new Set()); }}
                className="text-xs font-semibold"
                style={{ color: "var(--color-action-dark)" }}
              >
                Clear filters
              </button>
            )}
          </>
        }
      />
    </div>
  );
}
