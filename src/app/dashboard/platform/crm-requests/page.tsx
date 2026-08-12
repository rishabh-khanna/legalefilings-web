"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { Clock, CheckCircle2, XCircle, Check, X } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { TruncatedText } from "@/components/TruncatedText";

type CrmAccessRequest = {
  id: string;
  organization_name: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  review_note: string | null;
  profiles?: { full_name: string | null } | null;
  orders?: { service: string; plan: string } | null;
};

const REQUEST_STATUS_STYLE: Record<"approved" | "rejected", { bg: string; fg: string }> = {
  approved: { bg: "var(--color-success-tint)", fg: "var(--color-success)" },
  rejected: { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" },
};

// Platform-admin only. Split out from Organizations — approving/rejecting
// a customer's request for their own CRM workspace is a distinct review
// queue, not part of managing the org list itself, so it gets its own
// nav entry and page instead of sharing one with Organizations.
export default function CrmRequestsPage() {
  const [view, setView] = useState<"pending" | "reviewed">("pending");
  const [crmRequests, setCrmRequests] = useState<CrmAccessRequest[] | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/crm-access-requests");
    const data = await res.json();
    if (res.ok) setCrmRequests(data.requests);
  }, []);

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, [load]);

  async function handleApproveRequest(id: string) {
    setReviewError(null);
    const res = await fetch(`/api/platform/crm-access-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    const data = await res.json();
    if (res.ok) {
      await load();
    } else {
      setReviewError(data.error ?? "Failed to approve");
    }
  }

  async function handleRejectRequest(id: string) {
    if (!rejectReason.trim()) return;
    setReviewError(null);
    const res = await fetch(`/api/platform/crm-access-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "reject", reason: rejectReason }),
    });
    const data = await res.json();
    if (res.ok) {
      setRejectingId(null);
      setRejectReason("");
      await load();
    } else {
      setReviewError(data.error ?? "Failed to reject");
    }
  }

  const pending = (crmRequests ?? []).filter((r) => r.status === "pending");
  const reviewed = (crmRequests ?? []).filter((r) => r.status !== "pending");

  const pendingColumns: DataTableColumn<CrmAccessRequest>[] = [
    { key: "org", header: "Organization", render: (r) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{r.organization_name}</span>, exportValue: (r) => r.organization_name, sortValue: (r) => r.organization_name },
    { key: "requestedBy", header: "Requested By", render: (r) => r.profiles?.full_name ?? "Unknown", exportValue: (r) => r.profiles?.full_name ?? "Unknown", sortValue: (r) => r.profiles?.full_name },
    { key: "plan", header: "Plan", className: "w-[16%] whitespace-nowrap", render: (r) => r.orders ? `${r.orders.service} — ${r.orders.plan}` : "—", exportValue: (r) => (r.orders ? `${r.orders.service} — ${r.orders.plan}` : "") },
    { key: "requestedOn", header: "Requested On", className: "w-[12%] whitespace-nowrap", render: (r) => new Date(r.created_at).toLocaleDateString("en-IN"), exportValue: (r) => new Date(r.created_at).toLocaleDateString("en-IN"), sortValue: (r) => r.created_at },
    {
      key: "actions",
      header: "Actions",
      className: "w-[26%] text-right",
      render: (r) =>
        rejectingId === r.id ? (
          <div className="flex items-center justify-end gap-2">
            <input
              autoFocus
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason"
              className="w-40 rounded-lg border px-2 py-1.5 text-sm outline-none"
              style={{ borderColor: "var(--color-line)" }}
            />
            <button type="button" onClick={() => handleRejectRequest(r.id)} className="text-sm font-semibold" style={{ color: "var(--color-danger)" }}>Confirm</button>
            <button type="button" onClick={() => { setRejectingId(null); setRejectReason(""); }} className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Cancel</button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => handleApproveRequest(r.id)} aria-label="Approve" className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]">
              <Check className="h-4 w-4" style={{ color: "var(--color-success)" }} />
            </button>
            <button type="button" onClick={() => setRejectingId(r.id)} aria-label="Reject" className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]">
              <X className="h-4 w-4" style={{ color: "var(--color-danger)" }} />
            </button>
          </div>
        ),
    },
  ];

  const reviewedColumns: DataTableColumn<CrmAccessRequest>[] = [
    { key: "org", header: "Organization", render: (r) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{r.organization_name}</span>, exportValue: (r) => r.organization_name, sortValue: (r) => r.organization_name },
    { key: "requestedBy", header: "Requested By", render: (r) => r.profiles?.full_name ?? "Unknown", exportValue: (r) => r.profiles?.full_name ?? "Unknown", sortValue: (r) => r.profiles?.full_name },
    { key: "plan", header: "Plan", className: "w-[16%] whitespace-nowrap", render: (r) => r.orders ? `${r.orders.service} — ${r.orders.plan}` : "—", exportValue: (r) => (r.orders ? `${r.orders.service} — ${r.orders.plan}` : "") },
    { key: "requestedOn", header: "Requested On", className: "w-[12%] whitespace-nowrap", render: (r) => new Date(r.created_at).toLocaleDateString("en-IN"), exportValue: (r) => new Date(r.created_at).toLocaleDateString("en-IN"), sortValue: (r) => r.created_at },
    {
      key: "status",
      header: "Status",
      className: "w-[10%] whitespace-nowrap",
      render: (r) => {
        const style = REQUEST_STATUS_STYLE[r.status as "approved" | "rejected"];
        return (
          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
            {r.status}
          </span>
        );
      },
      exportValue: (r) => r.status,
      sortValue: (r) => r.status,
    },
    {
      key: "note",
      header: "Note",
      className: "max-w-[180px]",
      render: (r) =>
        r.status === "rejected" && r.review_note ? (
          <TruncatedText text={r.review_note} style={{ color: "var(--color-danger)" }} />
        ) : (
          <span style={{ color: "var(--color-ink-soft)" }}>—</span>
        ),
      exportValue: (r) => (r.status === "rejected" ? r.review_note ?? "" : ""),
    },
  ];

  return (
    <div>
      <DashboardPageHero
        title="CRM Requests"
        subtitle="Customers who purchased a plan and asked for their own CRM workspace — approve, reject, and review history."
      >
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroKpi icon={Clock} label="Pending" value={pending.length} />
          <HeroKpi icon={CheckCircle2} label="Approved" value={reviewed.filter((r) => r.status === "approved").length} />
          <HeroKpi icon={XCircle} label="Rejected" value={reviewed.filter((r) => r.status === "rejected").length} />
        </div>
      </DashboardPageHero>

      {reviewError && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-danger)" }}>{reviewError}</p>
      )}

      <div className="mt-6 flex items-center gap-1 rounded-full border p-1" style={{ borderColor: "var(--color-line)" }}>
        {([["pending", `Pending${pending.length > 0 ? ` (${pending.length})` : ""}`], ["reviewed", "Reviewed"]] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            style={view === value ? { backgroundColor: "var(--color-accent)", color: "var(--color-ink)" } : { color: "var(--color-ink-soft)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "pending" && (
        <>
          <p className="mt-4 text-sm" style={{ color: "var(--color-ink-soft)" }}>Customers who purchased a plan and asked for their own CRM workspace.</p>
          <DataTable
            columns={pendingColumns}
            fixedLayout
            rows={pending}
            getRowKey={(r) => r.id}
            itemLabel="requests"
            emptyMessage="No pending requests."
            search={{ placeholder: "Search organization…", filter: (r, q) => r.organization_name.toLowerCase().includes(q) }}
            exportFilename="pending-crm-requests"
          />
        </>
      )}

      {view === "reviewed" && (
        <>
          <p className="mt-4 text-sm" style={{ color: "var(--color-ink-soft)" }}>Approved and rejected workspace requests — including ones turned down.</p>
          <DataTable
            columns={reviewedColumns}
            fixedLayout
            rows={reviewed}
            getRowKey={(r) => r.id}
            itemLabel="requests"
            emptyMessage="No reviewed requests yet."
            search={{ placeholder: "Search organization…", filter: (r, q) => r.organization_name.toLowerCase().includes(q) }}
            exportFilename="reviewed-crm-requests"
          />
        </>
      )}
    </div>
  );
}
