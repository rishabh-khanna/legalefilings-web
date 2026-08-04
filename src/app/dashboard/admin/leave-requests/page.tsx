"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";

type LeaveRow = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  profiles?: { full_name: string | null } | null;
};

const STATUS_STYLE: Record<LeaveRow["status"], { bg: string; fg: string }> = {
  pending: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  approved: { bg: "#d0f4db", fg: "#116a2c" },
  rejected: { bg: "#fde2e2", fg: "#b42318" },
};

export default function AdminLeaveRequestsPage() {
  const [requests, setRequests] = useState<LeaveRow[] | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { message, showSuccess, showError } = useActionMessage();

  async function load() {
    const res = await fetch("/api/leave-requests");
    if (res.ok) setRequests((await res.json()).requests);
    else setError("Could not load — admin access required.");
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function decide(id: string, decision: "approve" | "reject", reason?: string) {
    const res = await fetch(`/api/leave-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    if (res.ok) {
      setRejectingId(null);
      setRejectReason("");
      await load();
      showSuccess(decision === "approve" ? "Leave approved." : "Leave rejected.");
    } else {
      const data = await res.json().catch(() => null);
      showError(
        res.status === 403
          ? "Only this person's direct manager (or admin) can approve or reject their leave."
          : (data?.error ?? "Failed to save decision.")
      );
    }
  }

  const stats = useMemo(() => {
    const all = requests ?? [];
    return {
      pending: all.filter((r) => r.status === "pending").length,
      approved: all.filter((r) => r.status === "approved").length,
      rejected: all.filter((r) => r.status === "rejected").length,
    };
  }, [requests]);

  if (requests === null && !error) return <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>;

  return (
    <div>
      <DashboardPageHero title="Leave Requests" subtitle="Approve or reject leave requests from your reporting chain.">
        <div className="relative mt-6 grid grid-cols-3 gap-4">
          <HeroKpi icon={Clock} label="Pending" value={stats.pending} />
          <HeroKpi icon={CheckCircle2} label="Approved" value={stats.approved} />
          <HeroKpi icon={XCircle} label="Rejected" value={stats.rejected} />
        </div>
      </DashboardPageHero>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-4">
        <ActionMessage message={message} />
      </div>

      <div className="mt-5 space-y-3">
        {(requests ?? []).map((r) => {
          const style = STATUS_STYLE[r.status];
          return (
            <div key={r.id} className="rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{r.profiles?.full_name ?? "Staff"}</p>
                  <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>{r.leave_type} · {r.start_date} → {r.end_date}</p>
                  {r.reason && <p className="mt-1 text-sm italic" style={{ color: "var(--color-ink-soft)" }}>&ldquo;{r.reason}&rdquo;</p>}
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>{r.status}</span>
              </div>

              {r.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => decide(r.id, "approve")} className="rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>
                    Approve
                  </button>
                  {rejectingId === r.id ? (
                    <>
                      <input autoFocus placeholder="Reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="rounded-lg border px-3 py-1.5 text-xs outline-none" style={{ borderColor: "var(--color-line)" }} />
                      <button type="button" disabled={!rejectReason.trim()} onClick={() => decide(r.id, "reject", rejectReason)} className="rounded-full border px-4 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ borderColor: "#b42318", color: "#b42318" }}>
                        Confirm Reject
                      </button>
                      <button type="button" onClick={() => setRejectingId(null)} className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setRejectingId(r.id)} className="rounded-full border px-4 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}>
                      Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {requests?.length === 0 && <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No leave requests yet.</p>}
      </div>
    </div>
  );
}
