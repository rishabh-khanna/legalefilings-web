"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, XCircle, Check, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useActionMessage } from "@/lib/use-action-message";
import { useConfirm } from "@/lib/use-confirm";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { TruncatedText } from "@/components/TruncatedText";
import { MultiSelect } from "@/components/MultiSelect";
import { SearchButton } from "@/components/SearchButton";

type LeaveRow = {
  id: string;
  staff_id: string;
  leave_type: string;
  leave_types: { name: string; code: string } | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  review_note: string | null;
  organization_id: string;
  created_at: string;
  // Working days in the range × the half-day fraction — computed
  // server-side (see /api/leave-requests) so this and the self-service
  // /dashboard/leave page never disagree on what a request costs.
  requestedDays: number;
  profiles?: { full_name: string | null } | null;
  organizations?: { name: string | null } | null;
};

const LEAVE_TYPE_FALLBACK_LABELS: Record<string, string> = { sick: "Sick Leave", casual: "Casual Leave", paid: "Paid Leave", unpaid: "Unpaid Leave" };
function leaveRowLabel(r: LeaveRow): string {
  return r.leave_types?.name ?? LEAVE_TYPE_FALLBACK_LABELS[r.leave_type] ?? r.leave_type;
}

const STATUS_STYLE: Record<LeaveRow["status"], { bg: string; fg: string }> = {
  pending: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  approved: { bg: "var(--color-success-tint)", fg: "var(--color-success)" },
  rejected: { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" },
  // Neutral, not red — a cancelled request isn't a refusal.
  cancelled: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
};

// Approved future leave can be called back by the approver; once it has
// started the person was actually absent, so the balance stays spent.
function canCancel(r: LeaveRow): boolean {
  if (r.status !== "approved") return false;
  return r.start_date > new Date().toISOString().slice(0, 10);
}

export default function AdminLeaveRequestsPage() {
  const [requests, setRequests] = useState<LeaveRow[] | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { message, showSuccess, showError } = useActionMessage();
  const { confirm, confirmDialog } = useConfirm();

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

  async function cancelApproved(r: LeaveRow) {
    const who = r.profiles?.full_name ?? "this employee";
    if (!(await confirm(`Cancel ${who}'s approved leave? The days go back to their balance.`, { confirmLabel: "Cancel Leave", danger: true }))) return;
    const res = await fetch(`/api/leave-requests/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "cancel" }),
    });
    if (res.ok) {
      await load();
      showSuccess("Leave cancelled — the days are back in their balance.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to cancel this leave.");
    }
  }

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

  const byStatus = useMemo(() => {
    const all = requests ?? [];
    return {
      pending: all.filter((r) => r.status === "pending"),
      approved: all.filter((r) => r.status === "approved"),
      rejected: all.filter((r) => r.status === "rejected"),
    };
  }, [requests]);

  const [draftStatusFilter, setDraftStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [draftStaffFilter, setDraftStaffFilter] = useState<Set<string>>(new Set());
  const [staffFilter, setStaffFilter] = useState<Set<string>>(new Set());
  const leaveFiltersDirty =
    draftStatusFilter.size !== statusFilter.size || [...draftStatusFilter].some((v) => !statusFilter.has(v)) ||
    draftStaffFilter.size !== staffFilter.size || [...draftStaffFilter].some((v) => !staffFilter.has(v));
  const statusFilteredRequests = useMemo(() => {
    return (requests ?? []).filter((r) => statusFilter.size === 0 || statusFilter.has(r.status));
  }, [requests, statusFilter]);
  // Replaces the old group-by-staff clustering — one dropdown to narrow
  // the table to a single person instead of the whole queue visually
  // reorganized around them. Built from whoever actually has a request
  // (across all statuses, not just the current status filter), so
  // switching Status back to "All" never leaves a stale-looking option.
  const staffOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of requests ?? []) {
      if (!byId.has(r.staff_id)) byId.set(r.staff_id, r.profiles?.full_name ?? "Staff");
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);
  const filteredRequests = useMemo(
    () => (staffFilter.size === 0 ? statusFilteredRequests : statusFilteredRequests.filter((r) => staffFilter.has(r.staff_id))),
    [statusFilteredRequests, staffFilter]
  );

  if (requests === null && !error) return <LoadingBlock />;

  // Only a platform_admin's request ever returns more than one org's
  // leave requests pooled together — the column is only worth showing
  // once it's actually ambiguous which org a row belongs to.
  const spansMultipleOrgs = new Set((requests ?? []).map((r) => r.organization_id)).size > 1;

  const columns: DataTableColumn<LeaveRow>[] = [
    { key: "staff", header: "Staff", render: (r) => <span className="font-semibold" style={{ color: "var(--color-ink)" }}>{r.profiles?.full_name ?? "Staff"}</span>, exportValue: (r) => r.profiles?.full_name ?? "", sortValue: (r) => r.profiles?.full_name },
    { key: "type", header: "Leave Type", className: "w-[12%] whitespace-nowrap", render: (r) => leaveRowLabel(r), exportValue: (r) => leaveRowLabel(r), sortValue: (r) => leaveRowLabel(r) },
    { key: "dates", header: "Dates", className: "w-[14%] whitespace-nowrap", render: (r) => `${r.start_date} → ${r.end_date}`, exportValue: (r) => `${r.start_date} to ${r.end_date}`, sortValue: (r) => r.start_date },
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
      className: "w-[10%] whitespace-nowrap",
      render: (r) => new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      exportValue: (r) => new Date(r.created_at).toLocaleDateString("en-IN"),
      sortValue: (r) => r.created_at,
    },
    { key: "reason", header: "Reason", className: "max-w-[180px]", render: (r) => (r.reason ? <TruncatedText text={`“${r.reason}”`} italic style={{ color: "var(--color-ink-soft)" }} /> : "—"), exportValue: (r) => r.reason ?? "" },
    ...(spansMultipleOrgs
      ? [{ key: "org", header: "Organization", render: (r: LeaveRow) => r.organizations?.name ?? "—", exportValue: (r: LeaveRow) => r.organizations?.name ?? "Unknown organization" } as DataTableColumn<LeaveRow>]
      : []),
    {
      key: "status",
      header: "Status",
      className: "w-[10%] whitespace-nowrap",
      render: (r) => (
        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: STATUS_STYLE[r.status].bg, color: STATUS_STYLE[r.status].fg }}>{r.status}</span>
      ),
      exportValue: (r) => r.status,
      sortValue: (r) => r.status,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => {
        if (r.status === "pending" && r.staff_id === viewerId) {
          return <p className="text-xs italic" style={{ color: "var(--color-ink-soft)" }}>Awaiting your manager.</p>;
        }
        if (r.status === "pending" && r.staff_id !== viewerId) {
          return (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => decide(r.id, "approve")} aria-label="Approve" className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]">
                <Check className="h-4 w-4" style={{ color: "var(--color-success)" }} />
              </button>
              {rejectingId === r.id ? (
                <>
                  <input autoFocus placeholder="Reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-28 rounded-lg border px-3 py-1.5 text-xs outline-none" style={{ borderColor: "var(--color-line)" }} />
                  <button type="button" disabled={!rejectReason.trim()} onClick={() => decide(r.id, "reject", rejectReason)} className="rounded-full border px-4 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>
                    Confirm
                  </button>
                  <button type="button" onClick={() => setRejectingId(null)} className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Cancel</button>
                </>
              ) : (
                <button type="button" onClick={() => setRejectingId(r.id)} aria-label="Reject" className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]">
                  <X className="h-4 w-4" style={{ color: "var(--color-danger)" }} />
                </button>
              )}
            </div>
          );
        }
        if (canCancel(r)) {
          return (
            <button
              type="button"
              onClick={() => cancelApproved(r)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-red-50"
              style={{ borderColor: "var(--color-line)", color: "var(--color-danger)" }}
            >
              Cancel leave
            </button>
          );
        }
        return "—";
      },
    },
  ];

  return (
    <div>
      <DashboardPageHero title="Leave Requests" subtitle="Approve or reject leave requests from your reporting chain.">
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroKpi icon={Clock} label="Pending" value={byStatus.pending.length} />
          <HeroKpi icon={CheckCircle2} label="Approved" value={byStatus.approved.length} />
          <HeroKpi icon={XCircle} label="Rejected" value={byStatus.rejected.length} />
        </div>
      </DashboardPageHero>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-4">
        <ActionMessage message={message} />
      </div>
      {confirmDialog}

      <DataTable
        columns={columns}
        fixedLayout
        rows={filteredRequests}
        getRowKey={(r) => r.id}
        itemLabel="requests"
        emptyMessage={(requests ?? []).length === 0 ? "No leave requests yet." : "No requests match this filter."}
        filteredEmptyMessage="No requests match this search."
        search={{
          placeholder: "Search staff, leave type, reason…",
          filter: (r, q) => `${r.profiles?.full_name ?? ""} ${leaveRowLabel(r)} ${r.reason ?? ""}`.toLowerCase().includes(q),
        }}
        exportFilename="leave-requests"
        minWidth={760}
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
            <MultiSelect
              options={staffOptions.map(([id, name]) => ({ value: id, label: name }))}
              selected={draftStaffFilter}
              onChange={setDraftStaffFilter}
              placeholder="All staff"
              searchable
            />
            <SearchButton
              onClick={() => {
                setStatusFilter(draftStatusFilter);
                setStaffFilter(draftStaffFilter);
              }}
              dirty={leaveFiltersDirty}
            />
          </>
        }
      />
    </div>
  );
}
