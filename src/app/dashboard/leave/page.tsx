"use client";

import { useEffect, useState } from "react";

type LeaveRequest = {
  id: string;
  leave_type: "sick" | "casual" | "paid" | "unpaid";
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<LeaveRequest["status"], { bg: string; fg: string }> = {
  pending: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  approved: { bg: "#d0f4db", fg: "#116a2c" },
  rejected: { bg: "#fde2e2", fg: "#b42318" },
};

const LEAVE_TYPE_LABELS: Record<LeaveRequest["leave_type"], string> = {
  sick: "Sick Leave",
  casual: "Casual Leave",
  paid: "Paid Leave",
  unpaid: "Unpaid Leave",
};

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveRequest["leave_type"]>("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch("/api/leave-requests");
    if (res.ok) setRequests((await res.json()).requests);
    setLoading(false);
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/leave-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveType, startDate, endDate, reason }),
    });
    setSubmitting(false);
    if (res.ok) {
      setShowForm(false);
      setStartDate("");
      setEndDate("");
      setReason("");
      await load();
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
          Leave
        </h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: "var(--color-ink-fixed)" }}
        >
          {showForm ? "Cancel" : "+ Apply for Leave"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-5 grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as typeof leaveType)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <div />
          <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} sm:col-span-2`} style={{ borderColor: "var(--color-line)" }} />
          <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      )}

      <div className="mt-5 space-y-3">
        {requests.map((r) => {
          const style = STATUS_STYLE[r.status];
          return (
            <div key={r.id} className="rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{LEAVE_TYPE_LABELS[r.leave_type]}</p>
                  <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>{r.start_date} → {r.end_date}</p>
                  {r.reason && <p className="mt-1 text-sm italic" style={{ color: "var(--color-ink-soft)" }}>&ldquo;{r.reason}&rdquo;</p>}
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                  {r.status}
                </span>
              </div>
              {r.status === "rejected" && r.review_note && (
                <p className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fde2e2", color: "#b42318" }}>
                  Rejected: {r.review_note}
                </p>
              )}
            </div>
          );
        })}
        {requests.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No leave requests yet.</p>
        )}
      </div>
    </div>
  );
}
