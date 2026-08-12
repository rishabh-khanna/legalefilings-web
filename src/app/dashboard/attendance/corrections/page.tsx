"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroAction, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";
import { SearchButton } from "@/components/SearchButton";
import { TruncatedText } from "@/components/TruncatedText";
import { Modal } from "@/components/Modal";

type CorrectionRequest = {
  id: string;
  date: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null } | null;
  reviewer?: { full_name: string | null } | null;
};

const STATUS_STYLE: Record<CorrectionRequest["status"], { bg: string; fg: string }> = {
  pending: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  approved: { bg: "var(--color-success-tint)", fg: "var(--color-success)" },
  rejected: { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" },
};

// Split out from /dashboard/attendance — a flat, unpaginated list of
// pending corrections stacked under "History" fell apart once someone
// had more than a handful (no way to see approved/rejected ones at
// all, and nothing to page through). This page is always the caller's
// own corrections (?scope=mine) — the team-wide review queue is the
// separate /dashboard/admin/attendance page's "Correction Requests"
// section, a different audience entirely.
export default function AttendanceCorrectionsPage() {
  const [corrections, setCorrections] = useState<CorrectionRequest[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [corrDate, setCorrDate] = useState("");
  const [corrIn, setCorrIn] = useState("");
  const [corrOut, setCorrOut] = useState("");
  const [corrReason, setCorrReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftStatusFilter, setDraftStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const statusFilterDirty = draftStatusFilter.size !== statusFilter.size || [...draftStatusFilter].some((v) => !statusFilter.has(v));
  // Admin/platform_admin see every correction request here, not just
  // their own — a leader/group_leader (or any lower role) still only
  // sees their own, even though the underlying API would otherwise
  // widen their view to their reporting chain by default (that broader
  // chain view is what the separate Team Attendance admin page is for).
  const [seeAll, setSeeAll] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  async function load(all: boolean) {
    const res = await fetch(`/api/attendance-corrections${all ? "" : "?scope=mine"}`);
    if (res.ok) setCorrections((await res.json()).requests);
  }

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let all = false;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("account_type, is_platform_admin").eq("id", user.id).single();
        all = profile?.account_type === "admin" || profile?.is_platform_admin === true;
      }
      setSeeAll(all);
      await load(all);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/attendance-corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: corrDate, checkIn: corrIn || null, checkOut: corrOut || null, reason: corrReason }),
    });
    setSubmitting(false);
    if (res.ok) {
      setShowForm(false);
      setCorrDate("");
      setCorrIn("");
      setCorrOut("");
      setCorrReason("");
      await load(seeAll);
      showSuccess("Correction request submitted.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to submit correction request.");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  const byStatus = useMemo(() => {
    const all = corrections ?? [];
    return {
      pending: all.filter((c) => c.status === "pending"),
      approved: all.filter((c) => c.status === "approved"),
      rejected: all.filter((c) => c.status === "rejected"),
    };
  }, [corrections]);

  if (corrections === null) {
    return <LoadingBlock />;
  }

  const statusFilteredCorrections = corrections.filter((c) => statusFilter.size === 0 || statusFilter.has(c.status));

  const columns: DataTableColumn<CorrectionRequest>[] = [
    { key: "date", header: "For Date", className: "whitespace-nowrap", render: (c) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{c.date}</span>, exportValue: (c) => c.date, sortValue: (c) => c.date },
    {
      key: "requestedOn",
      header: "Requested On",
      className: "whitespace-nowrap",
      render: (c) => new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      exportValue: (c) => new Date(c.created_at).toLocaleDateString("en-IN"),
      sortValue: (c) => c.created_at,
    },
    { key: "requestedBy", header: "Requested By", render: (c) => c.profiles?.full_name ?? "You", exportValue: (c) => c.profiles?.full_name ?? "", sortValue: (c) => c.profiles?.full_name ?? "You" },
    { key: "checkIn", header: "Requested Check In", render: (c) => c.requested_check_in ?? "—", exportValue: (c) => c.requested_check_in ?? "" },
    { key: "checkOut", header: "Requested Check Out", render: (c) => c.requested_check_out ?? "—", exportValue: (c) => c.requested_check_out ?? "" },
    { key: "reason", header: "Reason", render: (c) => <TruncatedText text={`“${c.reason}”`} italic className="max-w-xs" style={{ color: "var(--color-ink-soft)" }} />, className: "max-w-xs", exportValue: (c) => c.reason },
    {
      key: "status",
      header: "Status",
      render: (c) => {
        const style = STATUS_STYLE[c.status];
        return (
          <>
            <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
              {c.status}
            </span>
            {c.status === "rejected" && c.review_note && (
              <TruncatedText
                text={c.review_note}
                className="mt-1.5 max-w-[160px] rounded-lg px-2 py-1"
                style={{ backgroundColor: "var(--color-danger-tint)", color: "var(--color-danger)" }}
              />
            )}
          </>
        );
      },
      exportValue: (c) => c.status,
      sortValue: (c) => c.status,
    },
    {
      key: "reviewedBy",
      header: "Reviewed By",
      render: (c) => (c.status === "pending" ? <span style={{ color: "var(--color-ink-soft)" }}>—</span> : c.reviewer?.full_name ?? "—"),
      exportValue: (c) => (c.status === "pending" ? "" : c.reviewer?.full_name ?? ""),
    },
    {
      key: "reviewedOn",
      header: "Reviewed On",
      render: (c) => (c.status === "pending" ? "—" : new Date(c.updated_at).toLocaleDateString("en-IN")),
      exportValue: (c) => (c.status === "pending" ? "" : new Date(c.updated_at).toLocaleDateString("en-IN")),
    },
  ];

  return (
    <div>
      <DashboardPageHero
        title="Attendance Correction Requests"
        subtitle={seeAll ? "Every attendance correction request across your organization, and its review status." : "Your own attendance correction requests and their review status."}
        action={
          <HeroAction onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Request a Correction"}
          </HeroAction>
        }
      >
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroKpi icon={Clock} label="Pending" value={byStatus.pending.length} />
          <HeroKpi icon={CheckCircle2} label="Approved" value={byStatus.approved.length} />
          <HeroKpi icon={XCircle} label="Rejected" value={byStatus.rejected.length} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {showForm && (
        <Modal title="Request a Correction" onClose={() => setShowForm(false)}>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <input required type="date" value={corrDate} onChange={(e) => setCorrDate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <div />
          <input type="time" placeholder="Check in" value={corrIn} onChange={(e) => setCorrIn(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <input type="time" placeholder="Check out" value={corrOut} onChange={(e) => setCorrOut(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <textarea required placeholder="Reason" value={corrReason} onChange={(e) => setCorrReason(e.target.value)} className={`${inputClass} sm:col-span-2`} style={{ borderColor: "var(--color-line)" }} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={submitting} className="rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
            >
              Cancel
            </button>
          </div>
        </form>
        </Modal>
      )}

      <DataTable
        columns={columns}
        rows={statusFilteredCorrections}
        getRowKey={(c) => c.id}
        itemLabel="requests"
        emptyMessage={corrections.length === 0 ? "No correction requests yet." : "No requests match this filter."}
        search={{
          placeholder: "Search name, date, reason…",
          filter: (c, q) => `${c.profiles?.full_name ?? ""} ${c.date} ${c.reason}`.toLowerCase().includes(q),
        }}
        dateFilter={{ getDate: (c) => c.date }}
        exportFilename="my-correction-requests"
        toolbar={
          <>
            <MultiSelect
              options={[
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ]}
              selected={draftStatusFilter}
              onChange={setDraftStatusFilter}
              placeholder="All statuses"
            />
            <SearchButton onClick={() => setStatusFilter(draftStatusFilter)} dirty={statusFilterDirty} />
          </>
        }
      />
    </div>
  );
}
