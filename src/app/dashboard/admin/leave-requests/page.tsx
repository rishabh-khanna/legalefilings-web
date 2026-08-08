"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";

type LeaveRow = {
  id: string;
  staff_id: string;
  leave_type: string;
  leave_types: { name: string; code: string } | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  organization_id: string;
  profiles?: { full_name: string | null } | null;
  organizations?: { name: string | null } | null;
};

const LEAVE_TYPE_FALLBACK_LABELS: Record<string, string> = { sick: "Sick Leave", casual: "Casual Leave", paid: "Paid Leave", unpaid: "Unpaid Leave" };
function leaveRowLabel(r: LeaveRow): string {
  return r.leave_types?.name ?? LEAVE_TYPE_FALLBACK_LABELS[r.leave_type] ?? r.leave_type;
}

const STATUS_STYLE: Record<LeaveRow["status"], { bg: string; fg: string }> = {
  pending: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  approved: { bg: "#d0f4db", fg: "#116a2c" },
  rejected: { bg: "#fde2e2", fg: "#b42318" },
};

export default function AdminLeaveRequestsPage() {
  const [requests, setRequests] = useState<LeaveRow[] | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
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
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      setViewerId(user?.id ?? null);
      await load();
    }, 0);
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

  const [statusFilter, setStatusFilter] = useState<LeaveRow["status"] | "all">("all");
  const [search, setSearch] = useState("");
  const filteredRequests = useMemo(() => {
    return (requests ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${r.profiles?.full_name ?? ""} ${leaveRowLabel(r)} ${r.reason ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  if (requests === null && !error) return <LoadingBlock />;

  // Only a platform_admin's request ever returns more than one org's
  // leave requests pooled together — the column is only worth showing
  // once it's actually ambiguous which org a row belongs to.
  const spansMultipleOrgs = new Set((requests ?? []).map((r) => r.organization_id)).size > 1;

  return (
    <div>
      <DashboardPageHero title="Leave Requests" subtitle="Approve or reject leave requests from your reporting chain.">
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroKpi icon={Clock} label="Pending" value={stats.pending} />
          <HeroKpi icon={CheckCircle2} label="Approved" value={stats.approved} />
          <HeroKpi icon={XCircle} label="Rejected" value={stats.rejected} />
        </div>
      </DashboardPageHero>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-4">
        <ActionMessage message={message} />
      </div>

      {requests?.length !== 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff, leave type, reason…"
            className="w-full max-w-xs rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeaveRow["status"] | "all")}
            className="rounded-lg border px-2.5 py-1.5 text-sm outline-none"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {(search.trim() || statusFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              className="text-xs font-semibold"
              style={{ color: "var(--color-action-dark)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {requests?.length === 0 ? (
        <p className="mt-5 text-sm" style={{ color: "var(--color-ink-soft)" }}>No leave requests yet.</p>
      ) : filteredRequests.length === 0 ? (
        <p className="mt-5 text-sm" style={{ color: "var(--color-ink-soft)" }}>No requests match this search.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <table className="dt-table w-full min-w-[760px]">
            <thead>
              <tr className="text-left">
                <th>#</th>
                <th>Staff</th>
                <th>Leave Type</th>
                <th>Dates</th>
                <th>Reason</th>
                {spansMultipleOrgs && <th>Organization</th>}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r, i) => {
                const style = STATUS_STYLE[r.status];
                return (
                  <tr key={r.id}>
                    <td style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                    <td className="font-semibold" style={{ color: "var(--color-ink)" }}>{r.profiles?.full_name ?? "Staff"}</td>
                    <td style={{ color: "var(--color-ink-soft)" }}>{leaveRowLabel(r)}</td>
                    <td style={{ color: "var(--color-ink-soft)" }}>{r.start_date} → {r.end_date}</td>
                    <td className="max-w-xs italic" style={{ color: "var(--color-ink-soft)" }}>{r.reason ? `“${r.reason}”` : "—"}</td>
                    {spansMultipleOrgs && <td style={{ color: "var(--color-ink-soft)" }}>{r.organizations?.name ?? "—"}</td>}
                    <td>
                      <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>{r.status}</span>
                    </td>
                    <td>
                      {r.status === "pending" && r.staff_id === viewerId && (
                        <p className="text-xs italic" style={{ color: "var(--color-ink-soft)" }}>Awaiting your manager.</p>
                      )}
                      {r.status === "pending" && r.staff_id !== viewerId && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => decide(r.id, "approve")} className="rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>
                            Approve
                          </button>
                          {rejectingId === r.id ? (
                            <>
                              <input autoFocus placeholder="Reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-28 rounded-lg border px-3 py-1.5 text-xs outline-none" style={{ borderColor: "var(--color-line)" }} />
                              <button type="button" disabled={!rejectReason.trim()} onClick={() => decide(r.id, "reject", rejectReason)} className="rounded-full border px-4 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ borderColor: "#b42318", color: "#b42318" }}>
                                Confirm
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
                      {r.status !== "pending" && "—"}
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
