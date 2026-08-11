"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, XCircle, Check, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { STAFF_LEVEL_LABELS, type AccountType, type CustomerTier, type StaffLevel } from "@/lib/roles";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { TruncatedText } from "@/components/TruncatedText";

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
  department: string | null;
  designation: string | null;
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
  // Department/designation only exist on a staff request (see
  // 20260910000000_account_request_department.sql) — showing them here is
  // what the reviewer approves into the account, so leaving them invisible
  // pre-approval was exactly how they used to go missing unnoticed.
  const role = r.designation && r.department ? `${r.designation}, ${r.department}` : r.designation || r.department;
  return role ? `${level} — ${role}` : level;
}

// Reviewed (approved/rejected) history moved to its own page/nav item —
// see /dashboard/admin/reviewed-account-requests — so this page is only
// ever the pending review queue.
export default function AccountRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
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

  const pendingRequests = useMemo(() => (requests ?? []).filter((r) => r.status === "pending"), [requests]);

  if (requests === null && !error) {
    return <LoadingBlock />;
  }

  const columns: DataTableColumn<RequestRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <>
          <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{r.full_name}</p>
          {r.message && <TruncatedText text={`“${r.message}”`} italic className="mt-0.5 max-w-xs text-xs" style={{ color: "var(--color-ink-soft)" }} />}
        </>
      ),
      exportValue: (r) => r.full_name,
      sortValue: (r) => r.full_name,
    },
    {
      key: "contact",
      header: "Contact",
      render: (r) => <>{r.email}<br />{r.phone || "no phone"}</>,
      exportValue: (r) => `${r.email} / ${r.phone || "no phone"}`,
      sortValue: (r) => r.email,
    },
    {
      key: "requested",
      header: "Requested",
      render: (r) => <>{describeRequest(r)}<br />{r.requested_by ? `via ${r.profiles?.full_name ?? "a staff member"}` : "self-submitted"}</>,
      exportValue: (r) => `${describeRequest(r)} (${r.requested_by ? `via ${r.profiles?.full_name ?? "a staff member"}` : "self-submitted"})`,
      sortValue: (r) => r.created_at,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) =>
        isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleApprove(r.id)}
              aria-label="Approve"
              className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]"
            >
              <Check className="h-4 w-4" style={{ color: "#116a2c" }} />
            </button>
            {rejectingId === r.id ? (
              <>
                <input
                  autoFocus
                  placeholder="Reason for rejection"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-32 rounded-lg border px-3 py-1.5 text-xs outline-none"
                  style={{ borderColor: "var(--color-line)" }}
                />
                <button
                  type="button"
                  onClick={() => handleReject(r.id)}
                  disabled={!rejectReason.trim()}
                  className="rounded-full border px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                  style={{ borderColor: "#b42318", color: "#b42318" }}
                >
                  Confirm
                </button>
                <button type="button" onClick={() => setRejectingId(null)} className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setRejectingId(r.id)}
                aria-label="Reject"
                className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]"
              >
                <X className="h-4 w-4" style={{ color: "#b42318" }} />
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Awaiting admin approval.</p>
        ),
    },
  ];

  return (
    <div>
      <DashboardPageHero title="Account Requests" subtitle="Self-service staff signups and account requests submitted by your team — review and approve the pending ones here.">
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroKpi icon={Clock} label="Pending" value={stats.pending} />
          <HeroKpi icon={CheckCircle2} label="Approved" value={stats.approved} />
          <HeroKpi icon={XCircle} label="Rejected" value={stats.rejected} />
        </div>
      </DashboardPageHero>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <h2 className="mt-6 text-lg font-semibold" style={{ color: "var(--color-ink)" }}>Pending Account Requests</h2>
      <p className="mt-0.5 text-sm" style={{ color: "var(--color-ink-soft)" }}>Awaiting your review — approve to create the account or reject with a reason.</p>
      <DataTable
        columns={columns}
        rows={pendingRequests}
        getRowKey={(r) => r.id}
        itemLabel="requests"
        emptyMessage="No pending requests."
        search={{ placeholder: "Search name, email…", filter: (r, q) => `${r.full_name} ${r.email}`.toLowerCase().includes(q) }}
        exportFilename="pending-account-requests"
        minWidth={760}
      />
    </div>
  );
}
