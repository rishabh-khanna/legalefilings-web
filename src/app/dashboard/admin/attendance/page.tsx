"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Users, CalendarCheck, ClipboardList, Check, X } from "lucide-react";
import { formatHoursMinutes } from "@/lib/format-duration";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";
import { TruncatedText } from "@/components/TruncatedText";
import { Tooltip } from "@/components/Tooltip";
import { toISTDateString } from "@/lib/ist-date";

const CORRECTION_STATUS_STYLE: Record<CorrectionRow["status"], { bg: string; fg: string }> = {
  pending: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  approved: { bg: "var(--color-success-tint)", fg: "var(--color-success)" },
  rejected: { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" },
};

type StaffOption = { id: string; name: string };
type AttendanceEvent = { event_type: "check_in" | "check_out"; occurred_at: string; location: string | null; note: string | null };
type DayEntry = [
  string,
  { checkIn?: string; checkInLoc?: string | null; checkOut?: string; checkOutLoc?: string | null; checkInNote?: string | null; checkOutNote?: string | null },
];

// Mirrors AUTO_CLOSE_NOTE in api/cron/close-open-shifts/route.ts — kept as
// a literal here rather than imported, since that file is a server route
// handler and this is a "use client" page. api/attendance already
// `select("*")`s this column, but nothing on this page ever read it —
// the cron route's own comment claims "the UI badges it," which was
// never actually wired up. Worth knowing on a team-wide attendance log
// specifically: an auto-closed row's check-out time is the moment the
// cleanup job ran (up to 14h after the real shift), not when the person
// actually left.
const AUTO_CLOSE_NOTE = "auto-closed: no check-out recorded";
type CorrectionRow = {
  id: string;
  staff_id: string;
  date: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  organization_id: string;
  updated_at: string;
  profiles?: { full_name: string | null } | null;
  organizations?: { name: string | null } | null;
  reviewer?: { full_name: string | null } | null;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function mapLink(location: string | null) {
  if (!location) return null;
  return `https://www.google.com/maps?q=${location}`;
}

function groupByDay(events: AttendanceEvent[]) {
  const byDay = new Map<string, DayEntry[1]>();
  for (const ev of events) {
    // IST calendar day, not the UTC slice. A punch between IST midnight
    // and 5:30 AM falls on the previous UTC day, so slicing the
    // timestamp filed it under the wrong date — the same skew
    // src/lib/ist-date.ts exists to prevent.
    const day = toISTDateString(new Date(ev.occurred_at));
    const entry = byDay.get(day) ?? {};
    if (ev.event_type === "check_in" && !entry.checkIn) {
      entry.checkIn = ev.occurred_at;
      entry.checkInLoc = ev.location;
      entry.checkInNote = ev.note;
    }
    if (ev.event_type === "check_out") {
      entry.checkOut = ev.occurred_at;
      entry.checkOutLoc = ev.location;
      entry.checkOutNote = ev.note;
    }
    byDay.set(day, entry);
  }
  return Array.from(byDay.entries()).sort();
}

// useSearchParams needs a Suspense boundary around it or the whole page
// opts out of static rendering with a build error — this thin wrapper is
// that boundary; the real page (and all its own state) lives below.
export default function AdminAttendancePage() {
  return (
    <Suspense fallback={null}>
      <AdminAttendancePageInner />
    </Suspense>
  );
}

function AdminAttendancePageInner() {
  const searchParams = useSearchParams();
  const { message, showSuccess, showError } = useActionMessage();
  // Present/Absent Today on the Overview HR tiles link here with
  // ?view=today so the number a viewer clicks and the roster they land
  // on are the same one, instead of the log tab's unrelated single-staff
  // month view.
  const initialView = searchParams.get("view") === "today" ? "today" : "log";
  const [view, setView] = useState<"log" | "corrections" | "today">(initialView);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [staffId, setStaffId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [correctionsEmployeeFilter, setCorrectionsEmployeeFilter] = useState<Set<string>>(new Set());
  const [todayStaff, setTodayStaff] = useState<{ id: string; name: string; present: boolean; checkInAt: string | null }[]>([]);
  const [todayLoaded, setTodayLoaded] = useState(false);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/team-members");
      const data = await res.json();
      const members = (data.members ?? []) as { id: string; full_name: string | null; organizationName?: string | null }[];
      const orgCount = new Set(members.map((p) => p.organizationName)).size;
      const opts = members.map((p) => ({
        id: p.id,
        name: orgCount > 1 && p.organizationName ? `${p.full_name ?? "Unnamed"} — ${p.organizationName}` : (p.full_name ?? "Unnamed"),
      }));
      setStaffOptions(opts);
      if (opts[0]) setStaffId(opts[0].id);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  useEffect(() => {
    if (!staffId) return;
    fetch(`/api/attendance?staffId=${staffId}&month=${month}`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events ?? []));
  }, [staffId, month]);

  useEffect(() => {
    fetch("/api/attendance-corrections")
      .then((res) => res.json())
      .then((data) => setCorrections(data.requests ?? []));
  }, []);

  useEffect(() => {
    if (view !== "today" || todayLoaded) return;
    fetch("/api/admin/attendance-today")
      .then((res) => res.json())
      .then((data) => {
        setTodayStaff(data.staff ?? []);
        setTodayLoaded(true);
      });
  }, [view, todayLoaded]);

  async function decideCorrection(id: string, decision: "approve" | "reject") {
    const reason = decision === "reject" ? prompt("Rejection reason?") : undefined;
    if (decision === "reject" && !reason) return;
    const res = await fetch(`/api/attendance-corrections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    if (res.ok) {
      const data = await fetch("/api/attendance-corrections").then((r) => r.json());
      setCorrections(data.requests ?? []);
      if (decision === "approve") {
        const refreshed = await fetch(`/api/attendance?staffId=${staffId}&month=${month}`).then((r) => r.json());
        setEvents(refreshed.events ?? []);
      }
      showSuccess(decision === "approve" ? "Correction approved." : "Correction rejected.");
    } else {
      const data = await res.json().catch(() => null);
      showError(
        res.status === 403
          ? "Only this person's direct manager (or admin) can approve or reject their correction."
          : (data?.error ?? "Failed to save decision.")
      );
    }
  }

  const pendingCorrections = corrections.filter((c) => c.status === "pending");
  // Only a platform_admin's request ever returns more than one org's
  // correction requests pooled together — the org tag is only worth
  // showing once it's actually ambiguous which org a row belongs to.
  const correctionsSpanMultipleOrgs = new Set(corrections.map((c) => c.organization_id)).size > 1;
  const groupedDays = useMemo(() => groupByDay(events), [events]);

  // Replaces the old group-by-employee clustering on the corrections table
  // — one dropdown to narrow the queue to a single person instead of the
  // whole list visually reorganized around them. Built from whoever
  // actually has a correction request, not the full team roster.
  const correctionsEmployeeOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const c of corrections) {
      if (!byId.has(c.staff_id)) byId.set(c.staff_id, c.profiles?.full_name ?? "Staff");
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [corrections]);
  const filteredCorrections = useMemo(
    () => (correctionsEmployeeFilter.size === 0 ? corrections : corrections.filter((c) => correctionsEmployeeFilter.has(c.staff_id))),
    [corrections, correctionsEmployeeFilter]
  );

  const dayColumns: DataTableColumn<DayEntry>[] = [
    { key: "date", header: "Date", render: ([day]) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{day}</span>, exportValue: ([day]) => day, sortValue: ([day]) => day },
    {
      key: "checkIn",
      header: "Check In",
      render: ([, entry]) => {
        const link = mapLink(entry.checkInLoc ?? null);
        return (
          <>
            {entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString("en-IN") : "—"}
            {link && <a href={link} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-xs">📍</a>}
          </>
        );
      },
      exportValue: ([, entry]) => (entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString("en-IN") : ""),
    },
    {
      key: "checkOut",
      header: "Check Out",
      render: ([, entry]) => {
        const link = mapLink(entry.checkOutLoc ?? null);
        return (
          <>
            {entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString("en-IN") : "—"}
            {link && <a href={link} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-xs">📍</a>}
          </>
        );
      },
      exportValue: ([, entry]) => (entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString("en-IN") : ""),
    },
    {
      key: "hours",
      header: "Hours",
      render: ([, entry]) => (entry.checkIn && entry.checkOut ? formatHoursMinutes(new Date(entry.checkOut).getTime() - new Date(entry.checkIn).getTime()) : "—"),
      exportValue: ([, entry]) => (entry.checkIn && entry.checkOut ? formatHoursMinutes(new Date(entry.checkOut).getTime() - new Date(entry.checkIn).getTime()) : ""),
    },
    {
      key: "status",
      header: "Status",
      render: ([, entry]) => {
        if (entry.checkOutNote === AUTO_CLOSE_NOTE) {
          return (
            <Tooltip content="No check-out was ever recorded — this is when the nightly cleanup job auto-closed the shift, not when they actually left.">
              <span className="inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "var(--color-danger-tint)", color: "var(--color-danger)" }}>
                Auto-closed
              </span>
            </Tooltip>
          );
        }
        if (entry.checkInNote === "regularized" || entry.checkOutNote === "regularized") {
          return (
            <Tooltip content="Corrected via an approved attendance correction request.">
              <span className="inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "var(--color-info-tint)", color: "var(--color-info)" }}>
                Regularized
              </span>
            </Tooltip>
          );
        }
        if (entry.checkIn && !entry.checkOut) {
          return (
            <span className="inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
              No check-out yet
            </span>
          );
        }
        return (
          <span className="inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" }}>
            Present
          </span>
        );
      },
      exportValue: ([, entry]) =>
        entry.checkOutNote === AUTO_CLOSE_NOTE
          ? "Auto-closed"
          : entry.checkInNote === "regularized" || entry.checkOutNote === "regularized"
            ? "Regularized"
            : entry.checkIn && !entry.checkOut
              ? "No check-out yet"
              : "Present",
    },
  ];

  // Every column here except Actions is shown for every status, not
  // just pending — the old version only ever rendered pending rows in
  // a plain stacked list, so an approved/rejected correction had no
  // record on this page at all once decided.
  const correctionColumns: DataTableColumn<CorrectionRow>[] = [
    { key: "employee", header: "Employee", render: (c) => <span className="font-semibold" style={{ color: "var(--color-ink)" }}>{c.profiles?.full_name ?? "Staff"}</span>, exportValue: (c) => c.profiles?.full_name ?? "", sortValue: (c) => c.profiles?.full_name },
    { key: "date", header: "Date", className: "w-[10%] whitespace-nowrap", render: (c) => c.date, exportValue: (c) => c.date, sortValue: (c) => c.date },
    { key: "checkIn", header: "Requested Check In", className: "w-[14%] whitespace-nowrap", render: (c) => c.requested_check_in ?? "—", exportValue: (c) => c.requested_check_in ?? "" },
    { key: "checkOut", header: "Requested Check Out", className: "w-[14%] whitespace-nowrap", render: (c) => c.requested_check_out ?? "—", exportValue: (c) => c.requested_check_out ?? "" },
    { key: "reason", header: "Reason", className: "max-w-[180px]", render: (c) => <TruncatedText text={`“${c.reason}”`} italic style={{ color: "var(--color-ink-soft)" }} />, exportValue: (c) => c.reason },
    ...(correctionsSpanMultipleOrgs
      ? [{ key: "org", header: "Organization", render: (c: CorrectionRow) => c.organizations?.name ?? "—", exportValue: (c: CorrectionRow) => c.organizations?.name ?? "Unknown organization" } as DataTableColumn<CorrectionRow>]
      : []),
    {
      key: "status",
      header: "Status",
      className: "w-[10%] whitespace-nowrap",
      render: (c) => (
        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: CORRECTION_STATUS_STYLE[c.status].bg, color: CORRECTION_STATUS_STYLE[c.status].fg }}>
          {c.status}
        </span>
      ),
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
      className: "w-[10%] whitespace-nowrap",
      render: (c) => (c.status === "pending" ? "—" : new Date(c.updated_at).toLocaleDateString("en-IN")),
      exportValue: (c) => (c.status === "pending" ? "" : new Date(c.updated_at).toLocaleDateString("en-IN")),
    },
    {
      key: "actions",
      header: "",
      render: (c) =>
        c.status === "pending" ? (
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => decideCorrection(c.id, "approve")} aria-label="Approve" className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]">
              <Check className="h-4 w-4" style={{ color: "var(--color-success)" }} />
            </button>
            <button type="button" onClick={() => decideCorrection(c.id, "reject")} aria-label="Reject" className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]">
              <X className="h-4 w-4" style={{ color: "var(--color-danger)" }} />
            </button>
          </div>
        ) : (
          "—"
        ),
    },
  ];

  type TodayRow = (typeof todayStaff)[number];
  const todayColumns: DataTableColumn<TodayRow>[] = [
    { key: "name", header: "Name", render: (s) => <span className="font-semibold" style={{ color: "var(--color-ink)" }}>{s.name}</span>, exportValue: (s) => s.name, sortValue: (s) => s.name },
    {
      key: "status",
      header: "Status",
      className: "w-[16%] whitespace-nowrap",
      render: (s) => (
        <span
          className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
          style={s.present ? { backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" } : { backgroundColor: "var(--color-danger-tint)", color: "var(--color-danger)" }}
        >
          {s.present ? "Present" : "Absent"}
        </span>
      ),
      exportValue: (s) => (s.present ? "Present" : "Absent"),
      sortValue: (s) => (s.present ? 1 : 0),
    },
    {
      key: "checkInAt",
      header: "Check In",
      className: "w-[18%] whitespace-nowrap",
      render: (s) => (s.checkInAt ? new Date(s.checkInAt).toLocaleTimeString("en-IN") : "—"),
      exportValue: (s) => (s.checkInAt ? new Date(s.checkInAt).toLocaleTimeString("en-IN") : ""),
      sortValue: (s) => s.checkInAt ?? "",
    },
  ];

  return (
    <div>
      <DashboardPageHero title="Team Attendance" subtitle="Review check-ins and manage correction requests across your team.">
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroKpi icon={Users} label="Team Members" value={staffOptions.length} />
          <HeroKpi icon={CalendarCheck} label="Days Logged" value={groupedDays.length} />
          <HeroKpi icon={ClipboardList} label="Pending Corrections" value={pendingCorrections.length} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1 rounded-full border p-1" style={{ borderColor: "var(--color-line)" }}>
        {([["today", "Today's Status"], ["log", "Attendance Log"], ["corrections", `Correction Requests${pendingCorrections.length > 0 ? ` (${pendingCorrections.length})` : ""}`]] as const).map(([value, label]) => (
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

      {view === "today" && (
        <DataTable
          columns={todayColumns}
          fixedLayout
          rows={todayStaff}
          getRowKey={(s) => s.id}
          itemLabel="team members"
          emptyMessage="No team members yet."
          search={{ placeholder: "Search name…", filter: (s, q) => s.name.toLowerCase().includes(q) }}
          exportFilename="attendance-today"
        />
      )}

      {view === "log" && (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-ink-soft)" }}>Staff</label>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--color-line)" }}>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-ink-soft)" }}>Month</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--color-line)" }} />
            </div>
          </div>

          {/* PDF used to be its own button up here, sitting right beside
              the table's own CSV Export — two controls exporting the same
              staff+month data in different formats read as duplicated,
              not as two real choices. Folded into the Export dropdown
              instead, via exportExtra. */}
          <DataTable
            columns={dayColumns}
            rows={groupedDays}
            getRowKey={([day]) => day}
            itemLabel="days"
            emptyMessage="No attendance for this month."
            dateFilter={{ getDate: ([day]) => day }}
            exportFilename="attendance"
            exportExtra={staffId ? [{ label: "PDF — this staff, this month", href: `/api/admin/reports/attendance?staffId=${staffId}&month=${month}` }] : undefined}
          />
        </>
      )}

      {view === "corrections" && (
        <DataTable
          columns={correctionColumns}
          fixedLayout
          rows={filteredCorrections}
          getRowKey={(c) => c.id}
          itemLabel="requests"
          emptyMessage="No correction requests yet."
          filteredEmptyMessage="No correction requests for this employee."
          search={{ placeholder: "Search employee…", filter: (c, q) => (c.profiles?.full_name ?? "").toLowerCase().includes(q) }}
          exportFilename="correction-requests"
          toolbar={
            <MultiSelect
              options={correctionsEmployeeOptions.map(([id, name]) => ({ value: id, label: name }))}
              selected={correctionsEmployeeFilter}
              onChange={setCorrectionsEmployeeFilter}
              placeholder="All employees"
              searchable
            />
          }
        />
      )}
    </div>
  );
}
