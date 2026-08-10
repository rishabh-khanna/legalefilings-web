"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { STAFF_LEVEL_LABELS, type AccountType, type CustomerTier, type StaffLevel } from "@/lib/roles";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

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

const STATUS_STYLE: Record<"approved" | "rejected", { bg: string; fg: string }> = {
  approved: { bg: "#d0f4db", fg: "#116a2c" },
  rejected: { bg: "#fde2e2", fg: "#b42318" },
};

// Read-only history — approving/rejecting happens on the separate
// /dashboard/admin/account-requests pending queue. Split out into its
// own page/nav item rather than a second table bolted onto that page.
export default function ReviewedAccountRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/account-requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests);
      } else {
        setError("Could not load requests.");
      }
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const stats = useMemo(() => {
    const all = requests ?? [];
    return {
      pending: all.filter((r) => r.status === "pending").length,
      approved: all.filter((r) => r.status === "approved").length,
      rejected: all.filter((r) => r.status === "rejected").length,
    };
  }, [requests]);

  const reviewedRequests = useMemo(() => (requests ?? []).filter((r) => r.status !== "pending"), [requests]);

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
          {r.message && <p className="mt-0.5 max-w-xs text-xs italic" style={{ color: "var(--color-ink-soft)" }}>&ldquo;{r.message}&rdquo;</p>}
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
      exportValue: (r) => describeRequest(r),
      sortValue: (r) => r.created_at,
    },
    {
      key: "status",
      header: "Status",
      className: "w-[16%] whitespace-nowrap",
      render: (r) => {
        const style = STATUS_STYLE[r.status as "approved" | "rejected"];
        return (
          <>
            <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
              {r.status}
            </span>
            {r.status === "rejected" && r.review_note && (
              <p className="mt-1.5 max-w-[200px] whitespace-normal rounded-lg px-2 py-1 text-xs" style={{ backgroundColor: "#fde2e2", color: "#b42318" }}>
                {r.review_note}
              </p>
            )}
          </>
        );
      },
      exportValue: (r) => r.status,
      sortValue: (r) => r.status,
    },
  ];

  return (
    <div>
      <DashboardPageHero title="Reviewed Account Requests" subtitle="Account requests your team has already approved or rejected.">
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Not a popup like the other two tiles — a pending request
              can't be approved/rejected from this read-only history
              page at all (that only happens on the pending queue), so
              a dead-end list here was exactly what made it look like
              there was no way to act on them. Links straight to where
              you actually can. */}
          <Link href="/dashboard/admin/account-requests">
            <HeroKpi icon={Clock} label="Pending" value={stats.pending} />
          </Link>
          <HeroKpi icon={CheckCircle2} label="Approved" value={stats.approved} />
          <HeroKpi icon={XCircle} label="Rejected" value={stats.rejected} />
        </div>
      </DashboardPageHero>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <DataTable
        columns={columns}
        fixedLayout
        rows={reviewedRequests}
        getRowKey={(r) => r.id}
        itemLabel="requests"
        emptyMessage="No reviewed requests yet."
        search={{ placeholder: "Search by name, email, phone, status…", filter: (r, q) => [r.full_name, r.email, r.phone, describeRequest(r), r.status].some((f) => f?.toLowerCase().includes(q)) }}
        exportFilename="reviewed-account-requests"
        minWidth={760}
      />
    </div>
  );
}
