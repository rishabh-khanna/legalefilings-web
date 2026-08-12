"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clock3, CalendarCheck, Hourglass } from "lucide-react";
import { formatHoursMinutes } from "@/lib/format-duration";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { toISTDateString } from "@/lib/ist-date";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

type DayEntry = [string, { checkIn?: string; checkInLoc?: string | null; checkOut?: string; checkOutLoc?: string | null; checkOutAutoClosed?: boolean }];

type AttendanceEvent = {
  id: string;
  event_type: "check_in" | "check_out";
  occurred_at: string;
  location: string | null;
  note: string | null;
};

function mapLink(location: string | null) {
  if (!location) return null;
  return `https://www.google.com/maps?q=${location}`;
}

function groupByDay(events: AttendanceEvent[]) {
  const byDay = new Map<string, { checkIn?: string; checkInLoc?: string | null; checkOut?: string; checkOutLoc?: string | null; checkOutAutoClosed?: boolean }>();
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
    }
    if (ev.event_type === "check_out") {
      entry.checkOut = ev.occurred_at;
      entry.checkOutLoc = ev.location;
      // A check-out the nightly job generated because none was recorded
      // — the time is a documented assumption, not a real punch, so the
      // row says so and points at the correction flow.
      entry.checkOutAutoClosed = (ev.note ?? "").startsWith("auto-closed");
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

type PendingCorrection = { id: string; date: string; requested_check_in: string | null; requested_check_out: string | null };

export default function AttendancePage() {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [pendingCorrections, setPendingCorrections] = useState<PendingCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const [eventsRes, correctionsRes] = await Promise.all([fetch("/api/attendance"), fetch("/api/attendance-corrections?scope=mine")]);
    if (eventsRes.ok) setEvents((await eventsRes.json()).events);
    if (correctionsRes.ok) {
      const { requests } = await correctionsRes.json();
      setPendingCorrections((requests ?? []).filter((c: PendingCorrection & { status: string }) => c.status === "pending"));
    }
    setLoading(false);
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  // IST calendar day, not UTC — matches the server-side clock-in/out
  // guard (src/app/api/attendance/route.ts), which is IST-aware for the
  // same reason: plain UTC slicing puts the day boundary at 5:30 AM IST
  // instead of midnight, so an event correctly recorded under the new
  // IST day would otherwise silently fail to show up under "today" here.
  const today = toISTDateString(new Date());
  const todaysEvents = events.filter((e) => toISTDateString(new Date(e.occurred_at)) === today);
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
      showSuccess(type === "check_in" ? "Clocked in." : "Clocked out.");
    } else {
      showError(data.error ?? "Failed to record");
    }
  }

  const groupedDays = useMemo(() => groupByDay(events), [events]);

  if (loading) {
    return <LoadingBlock />;
  }

  const elapsedMs = clockedIn && lastEvent ? now - new Date(lastEvent.occurred_at).getTime() : 0;

  const columns: DataTableColumn<DayEntry>[] = [
    { key: "date", header: "Date", render: ([day]) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{day}</span>, exportValue: ([day]) => day, sortValue: ([day]) => day },
    {
      key: "checkIn",
      header: "Check In",
      render: ([, entry]) => {
        const link = mapLink(entry.checkInLoc ?? null);
        return (
          <>
            {entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString("en-IN") : "—"}
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-xs underline" style={{ color: "var(--color-action-dark)" }}>
                📍
              </a>
            )}
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
            {entry.checkOutAutoClosed && (
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: "var(--color-action-tint)", color: "var(--color-action-dark)" }}
                title="No check-out was recorded, so this time is an estimate. Request a correction to set the real one."
              >
                estimated
              </span>
            )}
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-xs underline" style={{ color: "var(--color-action-dark)" }}>
                📍
              </a>
            )}
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
  ];

  return (
    <div>
      <DashboardPageHero title="Attendance" subtitle="Clock in, track your hours, and request corrections.">
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroKpi icon={Clock3} label="Today" value={clockedIn ? "Clocked In" : "Not Clocked In"} />
          <HeroKpi icon={CalendarCheck} label="Days Logged" value={groupedDays.length} />
          <HeroKpi icon={Hourglass} label="Pending Corrections" value={pendingCorrections.length} />
        </div>
      </DashboardPageHero>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
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
          style={{ backgroundColor: "var(--color-danger)" }}
        >
          Clock Out
        </button>
      </div>

      <div className="mt-4">
        <ActionMessage message={message} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: "var(--color-ink)" }}>Attendance Log</h2>
        <Link href="/dashboard/attendance/corrections" className="text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
          Attendance Correction Requests{pendingCorrections.length > 0 ? ` (${pendingCorrections.length} pending)` : ""} →
        </Link>
      </div>

      <DataTable
        columns={columns}
        rows={groupedDays}
        getRowKey={([day]) => day}
        itemLabel="days"
        emptyMessage="No attendance recorded yet."
        dateFilter={{ getDate: ([day]) => day }}
        exportFilename="attendance"
      />
    </div>
  );
}
