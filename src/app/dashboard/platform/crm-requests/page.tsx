"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { Clock, CheckCircle2, XCircle } from "lucide-react";

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
  approved: { bg: "#d0f4db", fg: "#116a2c" },
  rejected: { bg: "#fde2e2", fg: "#b42318" },
};

// Platform-admin only. Split out from Organizations — approving/rejecting
// a customer's request for their own CRM workspace is a distinct review
// queue, not part of managing the org list itself, so it gets its own
// nav entry and page instead of sharing one with Organizations.
export default function CrmRequestsPage() {
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

      <div className="mt-6 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
          <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Pending CRM Requests</h2>
          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Customers who purchased a plan and asked for their own CRM workspace.</p>
        </div>
        {reviewError && (
          <p className="px-4 pt-3 text-sm" style={{ color: "#b42318" }}>{reviewError}</p>
        )}
        {crmRequests === null ? (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>
        ) : pending.length === 0 ? (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>No pending requests.</p>
        ) : (
          <table className="dt-table w-full min-w-[640px]">
            <thead>
              <tr className="text-left">
                <th>#</th>
                <th>Organization</th>
                <th>Requested By</th>
                <th>Requested On</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                  <td className="font-medium" style={{ color: "var(--color-ink)" }}>{r.organization_name}</td>
                  <td style={{ color: "var(--color-ink-soft)" }}>{r.profiles?.full_name ?? "Unknown"}</td>
                  <td style={{ color: "var(--color-ink-soft)" }}>{new Date(r.created_at).toLocaleDateString("en-IN")}</td>
                  <td className="text-right">
                    {rejectingId === r.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          autoFocus
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason"
                          className="w-40 rounded-lg border px-2 py-1.5 text-sm outline-none"
                          style={{ borderColor: "var(--color-line)" }}
                        />
                        <button type="button" onClick={() => handleRejectRequest(r.id)} className="text-sm font-semibold" style={{ color: "#b42318" }}>Confirm</button>
                        <button type="button" onClick={() => { setRejectingId(null); setRejectReason(""); }} className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        <button type="button" onClick={() => setRejectingId(r.id)} className="text-sm font-medium" style={{ color: "#b42318" }}>Reject</button>
                        <button
                          type="button"
                          onClick={() => handleApproveRequest(r.id)}
                          className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
                          style={{ backgroundColor: "var(--color-action)" }}
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
          <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Reviewed CRM Requests</h2>
          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Approved and rejected workspace requests — including ones turned down.</p>
        </div>
        {crmRequests === null ? (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>
        ) : reviewed.length === 0 ? (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>No reviewed requests yet.</p>
        ) : (
          <table className="dt-table w-full min-w-[640px]">
            <thead>
              <tr className="text-left">
                <th>#</th>
                <th>Organization</th>
                <th>Requested By</th>
                <th>Requested On</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {reviewed.map((r, i) => {
                const style = REQUEST_STATUS_STYLE[r.status as "approved" | "rejected"];
                return (
                  <tr key={r.id}>
                    <td style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                    <td className="font-medium" style={{ color: "var(--color-ink)" }}>{r.organization_name}</td>
                    <td style={{ color: "var(--color-ink-soft)" }}>{r.profiles?.full_name ?? "Unknown"}</td>
                    <td style={{ color: "var(--color-ink-soft)" }}>{new Date(r.created_at).toLocaleDateString("en-IN")}</td>
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
        )}
      </div>
    </div>
  );
}
