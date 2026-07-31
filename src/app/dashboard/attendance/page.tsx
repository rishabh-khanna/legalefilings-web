"use client";

import { useEffect, useRef, useState } from "react";
import { formatHoursMinutes } from "@/lib/format-duration";

type AttendanceEvent = {
  id: string;
  event_type: "check_in" | "check_out";
  occurred_at: string;
  location: string | null;
  note: string | null;
};
type CorrectionRequest = {
  id: string;
  date: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
};

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
  return Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function getLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    );
  });
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function AttendancePage() {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [corrDate, setCorrDate] = useState("");
  const [corrIn, setCorrIn] = useState("");
  const [corrOut, setCorrOut] = useState("");
  const [corrReason, setCorrReason] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const [eventsRes, correctionsRes] = await Promise.all([fetch("/api/attendance"), fetch("/api/attendance-corrections")]);
    if (eventsRes.ok) setEvents((await eventsRes.json()).events);
    if (correctionsRes.ok) setCorrections((await correctionsRes.json()).requests);
    setLoading(false);
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todaysEvents = events.filter((e) => e.occurred_at.slice(0, 10) === today);
  const lastEvent = todaysEvents[todaysEvents.length - 1];
  const clockedIn = lastEvent?.event_type === "check_in";

  useEffect(() => {
    if (clockedIn) {
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [clockedIn]);

  async function handleClock(type: "check_in" | "check_out") {
    setClocking(true);
    setError(null);
    const location = await getLocation();
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, location }),
    });
    const data = await res.json();
    setClocking(false);
    if (res.ok) {
      await load();
    } else {
      setError(data.error ?? "Failed to record");
    }
  }

  async function handleCorrectionSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/attendance-corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: corrDate, checkIn: corrIn || null, checkOut: corrOut || null, reason: corrReason }),
    });
    if (res.ok) {
      setShowCorrectionForm(false);
      setCorrDate("");
      setCorrIn("");
      setCorrOut("");
      setCorrReason("");
      await load();
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>;
  }

  const elapsedMs = clockedIn && lastEvent ? now - new Date(lastEvent.occurred_at).getTime() : 0;

  return (
    <div>
      <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
        Attendance
      </h1>

      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div>
          <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Today</p>
          <p className="text-lg font-semibold" style={{ color: "var(--color-ink)" }}>
            {clockedIn ? "Clocked in" : "Not clocked in"}
          </p>
        </div>
        {clockedIn && (
          <div>
            <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Elapsed</p>
            <p className="text-lg font-mono font-semibold tabular-nums" style={{ color: "var(--color-ink)" }}>
              {formatElapsed(elapsedMs)}
            </p>
          </div>
        )}
        <button
          type="button"
          disabled={clocking || clockedIn}
          onClick={() => handleClock("check_in")}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: "#1a9d5b" }}
        >
          Clock In
        </button>
        <button
          type="button"
          disabled={clocking || !clockedIn}
          onClick={() => handleClock("check_out")}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: "#b42318" }}
        >
          Clock Out
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: "var(--color-ink)" }}>History</h2>
        <button
          type="button"
          onClick={() => setShowCorrectionForm((v) => !v)}
          className="text-sm font-medium"
          style={{ color: "var(--color-action-dark)" }}
        >
          {showCorrectionForm ? "Cancel" : "Request a correction →"}
        </button>
      </div>

      {showCorrectionForm && (
        <form onSubmit={handleCorrectionSubmit} className="mt-3 grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <input required type="date" value={corrDate} onChange={(e) => setCorrDate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <div />
          <input type="time" placeholder="Check in" value={corrIn} onChange={(e) => setCorrIn(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <input type="time" placeholder="Check out" value={corrOut} onChange={(e) => setCorrOut(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <textarea required placeholder="Reason" value={corrReason} onChange={(e) => setCorrReason(e.target.value)} className={`${inputClass} sm:col-span-2`} style={{ borderColor: "var(--color-line)" }} />
          <button type="submit" className="sm:col-span-2 rounded-full py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>
            Submit Request
          </button>
        </form>
      )}

      {corrections.length > 0 && (
        <div className="mt-4 space-y-2">
          {corrections.filter((c) => c.status === "pending").map((c) => (
            <p key={c.id} className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
              Correction request for {c.date} — pending review.
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="w-full min-w-[520px] text-left text-sm">
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
                    {inLink && (
                      <a href={inLink} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-xs underline" style={{ color: "var(--color-action-dark)" }}>
                        📍
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    {entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString("en-IN") : "—"}
                    {outLink && (
                      <a href={outLink} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-xs underline" style={{ color: "var(--color-action-dark)" }}>
                        📍
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{hours}</td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No attendance recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
