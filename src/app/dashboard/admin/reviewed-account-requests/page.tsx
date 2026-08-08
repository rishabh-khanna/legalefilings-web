"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { STAFF_LEVEL_LABELS, type AccountType, type CustomerTier, type StaffLevel } from "@/lib/roles";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { ExportButton } from "@/components/ExportButton";

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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const stats = useMemo(() => {
    const all = requests ?? [];
    return {
      pending: all.filter((r) => r.status === "pending").length,
      approved: all.filter((r) => r.status === "approved").length,
      rejected: all.filter((r) => r.status === "rejected").length,
    };
  }, [requests]);

  const reviewedRequests = useMemo(() => (requests ?? []).filter((r) => r.status !== "pending"), [requests]);

  const filteredRequests = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return reviewedRequests;
    return reviewedRequests.filter((r) =>
      [r.full_name, r.email, r.phone, describeRequest(r), r.status].some((f) => f?.toLowerCase().includes(q))
    );
  }, [reviewedRequests, debouncedSearch]);

  const { page, setPage, pageSize, setPageSize, pageItems: pagedRequests, totalPages, total, start, end } = usePagination(filteredRequests);

  if (requests === null && !error) {
    return <LoadingBlock />;
  }

  return (
    <div>
      <DashboardPageHero title="Reviewed Account Requests" subtitle="Account requests your team has already approved or rejected.">
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroKpi icon={Clock} label="Pending" value={stats.pending} />
          <HeroKpi icon={CheckCircle2} label="Approved" value={stats.approved} />
          <HeroKpi icon={XCircle} label="Rejected" value={stats.rejected} />
        </div>
      </DashboardPageHero>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {reviewedRequests.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, status…"
            className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <ExportButton
            filename="reviewed-account-requests"
            headers={["Name", "Email", "Phone", "Requested", "Status", "Note"]}
            rows={filteredRequests.map((r) => [
              r.full_name ?? "",
              r.email ?? "",
              r.phone ?? "",
              describeRequest(r),
              r.status,
              r.status === "rejected" ? (r.review_note ?? "") : "",
            ])}
          />
        </div>
      )}

      {requests === null ? (
        <LoadingBlock className="mt-6" />
      ) : reviewedRequests.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>No reviewed requests yet.</p>
      ) : filteredRequests.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>No requests match this search.</p>
      ) : (
        <>
          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            start={start}
            end={end}
            total={total}
            itemLabel="requests"
          />
          <div className="mt-3 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
            <table className="dt-table w-full min-w-[760px]">
              <thead>
                <tr className="text-left">
                  <th>#</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Requested</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedRequests.map((r, i) => {
                  const style = STATUS_STYLE[r.status as "approved" | "rejected"];
                  return (
                    <tr key={r.id}>
                      <td style={{ color: "var(--color-ink-soft)" }}>{start + i}</td>
                      <td>
                        <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{r.full_name}</p>
                        {r.message && <p className="mt-0.5 max-w-xs text-xs italic" style={{ color: "var(--color-ink-soft)" }}>&ldquo;{r.message}&rdquo;</p>}
                      </td>
                      <td style={{ color: "var(--color-ink-soft)" }}>
                        {r.email}
                        <br />
                        {r.phone || "no phone"}
                      </td>
                      <td style={{ color: "var(--color-ink-soft)" }}>
                        {describeRequest(r)}
                        <br />
                        {r.requested_by ? `via ${r.profiles?.full_name ?? "a staff member"}` : "self-submitted"}
                      </td>
                      <td>
                        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                          {r.status}
                        </span>
                        {r.status === "rejected" && r.review_note && (
                          <p className="mt-1.5 max-w-[200px] rounded-lg px-2 py-1 text-xs" style={{ backgroundColor: "#fde2e2", color: "#b42318" }}>
                            {r.review_note}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
