"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { STAFF_LEVEL_LABELS, type AccountType, type CustomerTier, type StaffLevel } from "@/lib/roles";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";

type RequestRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  requested_account_type: AccountType | null;
  requested_staff_level: StaffLevel | null;
  requested_customer_tier: CustomerTier | null;
  company: string | null;
  city: string | null;
  state: string | null;
  requested_by: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
};

function describeRequest(r: RequestRow) {
  if (r.requested_account_type === "customer") {
    return `Customer${r.requested_customer_tier ? ` — ${r.requested_customer_tier}` : ""}${r.company ? ` at ${r.company}` : ""}`;
  }
  const level = r.requested_staff_level ? STAFF_LEVEL_LABELS[r.requested_staff_level] : "Staff";
  return level;
}

const STATUS_STYLE: Record<RequestRow["status"], { bg: string; fg: string }> = {
  pending: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  approved: { bg: "#d0f4db", fg: "#116a2c" },
  rejected: { bg: "#fde2e2", fg: "#b42318" },
};

export default function AccountRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/account-requests");
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests);
    } else {
      setError("Could not load requests.");
    }
  }

  useEffect(() => {
    // Deferred (not called synchronously in the effect body) — same pattern
    // used elsewhere in this codebase (CountdownTimer, AiAssistant) to avoid
    // the cascading-render lint rule.
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
        setIsAdmin(profile?.account_type === "admin");
      }
      await load();
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleApprove(id: string) {
    setError(null);
    const res = await fetch(`/api/account-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    const data = await res.json();
    if (res.ok) {
      setTempPasswords((prev) => ({ ...prev, [id]: data.tempPassword }));
      await load();
    } else {
      setError(data.error ?? "Failed to approve");
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    setError(null);
    const res = await fetch(`/api/account-requests/${id}`, {
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
      setError(data.error ?? "Failed to reject");
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

  if (requests === null && !error) {
    return <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>;
  }

  return (
    <div>
      <DashboardPageHero title="Account Requests" subtitle="Self-service staff signups and account requests submitted by your team.">
        <div className="relative mt-6 grid grid-cols-3 gap-4">
          <HeroKpi icon={Clock} label="Pending" value={stats.pending} />
          <HeroKpi icon={CheckCircle2} label="Approved" value={stats.approved} />
          <HeroKpi icon={XCircle} label="Rejected" value={stats.rejected} />
        </div>
      </DashboardPageHero>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-5 space-y-3">
        {(requests ?? []).map((r) => {
          const style = STATUS_STYLE[r.status];
          return (
            <div key={r.id} className="rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{r.full_name}</p>
                  <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>{r.email} · {r.phone || "no phone"}</p>
                  <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
                    Requested: {describeRequest(r)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                    {r.requested_by ? `Requested by ${r.profiles?.full_name ?? "a staff member"}` : "Self-submitted application"}
                  </p>
                  {r.message && <p className="mt-1 text-sm italic" style={{ color: "var(--color-ink-soft)" }}>&ldquo;{r.message}&rdquo;</p>}
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                  {r.status}
                </span>
              </div>

              {tempPasswords[r.id] && (
                <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#d0f4db", color: "#116a2c" }}>
                  Account created. Temporary password (share securely, once): <span className="font-mono font-semibold">{tempPasswords[r.id]}</span>
                </p>
              )}
              {r.status === "rejected" && r.review_note && (
                <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fde2e2", color: "#b42318" }}>
                  Rejected: {r.review_note}
                </p>
              )}

              {r.status === "pending" && isAdmin && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(r.id)}
                    className="rounded-full px-4 py-1.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: "var(--color-action)" }}
                  >
                    Approve
                  </button>
                  {rejectingId === r.id ? (
                    <>
                      <input
                        autoFocus
                        placeholder="Reason for rejection"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="rounded-lg border px-3 py-1.5 text-xs outline-none"
                        style={{ borderColor: "var(--color-line)" }}
                      />
                      <button
                        type="button"
                        onClick={() => handleReject(r.id)}
                        disabled={!rejectReason.trim()}
                        className="rounded-full border px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                        style={{ borderColor: "#b42318", color: "#b42318" }}
                      >
                        Confirm Reject
                      </button>
                      <button type="button" onClick={() => setRejectingId(null)} className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRejectingId(r.id)}
                      className="rounded-full border px-4 py-1.5 text-xs font-semibold"
                      style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
                    >
                      Reject
                    </button>
                  )}
                </div>
              )}
              {r.status === "pending" && !isAdmin && (
                <p className="mt-3 text-xs" style={{ color: "var(--color-ink-soft)" }}>
                  Awaiting admin approval.
                </p>
              )}
            </div>
          );
        })}
        {requests?.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No requests yet.</p>
        )}
      </div>
    </div>
  );
}
