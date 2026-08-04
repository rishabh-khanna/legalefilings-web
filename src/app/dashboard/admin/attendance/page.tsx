"use client";

import { useEffect, useState } from "react";
import { Users, CalendarCheck, ClipboardList } from "lucide-react";
import { formatHoursMinutes } from "@/lib/format-duration";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";

type StaffOption = { id: string; name: string };
type AttendanceEvent = { event_type: "check_in" | "check_out"; occurred_at: string; location: string | null };
type CorrectionRow = {
  id: string;
  date: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  profiles?: { full_name: string | null } | null;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function mapLink(location: string | null) {
  if (!location) return null;
  return `https://www.google.com/maps?q=${location}`;
}

function groupByDay(events: AttendanceEvent[]) {
  const byDay = new Map<string, { checkIn?: string; checkInLoc?: string | null; checkOut?: string; checkOutLoc?: string | null }>();
  for (const ev of events) {
    const day = ev.occurred_at.slice(0, 10);
    const entry = byDay.get(day) ?? {};
    if (ev.event_type === "check_in" && !entry.checkIn) {
      entry.checkIn = ev.occurred_at;
      entry.checkInLoc = ev.location;
    }
    if (ev.event_type === "check_out") {
      entry.checkOut = ev.occurred_at;
      entry.checkOutLoc = ev.location;
    }
    byDay.set(day, entry);
  }
  return Array.from(byDay.entries()).sort();
}

export default function AdminAttendancePage() {
  const { message, showSuccess, showError } = useActionMessage();
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [staffId, setStaffId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/team-members");
      const data = await res.json();
      const opts = ((data.members ?? []) as { id: string; full_name: string | null }[]).map((p) => ({ id: p.id, name: p.full_name ?? "Unnamed" }));
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

  return (
    <div>
      <DashboardPageHero title="Team Attendance" subtitle="Review check-ins and manage correction requests across your team.">
        <div className="relative mt-6 grid grid-cols-3 gap-4">
          <HeroKpi icon={Users} label="Team Members" value={staffOptions.length} />
          <HeroKpi icon={CalendarCheck} label="Days Logged" value={groupByDay(events).length} />
          <HeroKpi icon={ClipboardList} label="Pending Corrections" value={pendingCorrections.length} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

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
        {staffId && (
          <a
            href={`/api/admin/reports/attendance?staffId=${staffId}&month=${month}`}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            Download PDF
          </a>
        )}
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Date</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Check In</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Check Out</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {groupByDay(events).map(([day, entry]) => {
              const hours = entry.checkIn && entry.checkOut
                ? formatHoursMinutes(new Date(entry.checkOut).getTime() - new Date(entry.checkIn).getTime())
                : "—";
              const inLink = mapLink(entry.checkInLoc ?? null);
              const outLink = mapLink(entry.checkOutLoc ?? null);
              return (
                <tr key={day}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{day}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    {entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString("en-IN") : "—"}
                    {inLink && <a href={inLink} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-xs">📍</a>}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    {entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString("en-IN") : "—"}
                    {outLink && <a href={outLink} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-xs">📍</a>}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{hours}</td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No attendance for this month.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 text-lg font-semibold" style={{ color: "var(--color-ink)" }}>Correction Requests</h3>
      <div className="mt-3 space-y-3">
        {pendingCorrections.map((c) => (
          <div key={c.id} className="rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
            <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{c.profiles?.full_name ?? "Staff"} — {c.date}</p>
            <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
              Requested: {c.requested_check_in ?? "—"} → {c.requested_check_out ?? "—"}
            </p>
            <p className="mt-1 text-sm italic" style={{ color: "var(--color-ink-soft)" }}>&ldquo;{c.reason}&rdquo;</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => decideCorrection(c.id, "approve")} className="rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>
                Approve
              </button>
              <button type="button" onClick={() => decideCorrection(c.id, "reject")} className="rounded-full border px-4 py-1.5 text-xs font-semibold" style={{ borderColor: "#b42318", color: "#b42318" }}>
                Reject
              </button>
            </div>
          </div>
        ))}
        {pendingCorrections.length === 0 && <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No pending correction requests.</p>}
      </div>
    </div>
  );
}
