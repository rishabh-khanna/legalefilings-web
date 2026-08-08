// India has one timezone, no DST — a fixed +5:30 offset from UTC. This
// app runs on serverless infra where the process's local timezone is
// typically UTC, not IST; anything that computes a calendar-day
// boundary with plain `new Date(); .setHours(0,0,0,0)` gets UTC
// midnight, not IST midnight — a ~5.5 hour skew that misattributes
// events between IST midnight and 5:30 AM to the wrong day. The
// birthdays/overdue-invoices crons already handle this correctly for
// their own date math; this is the same fix, shared, for anywhere else
// that needs "today" in IST specifically.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// The UTC instant corresponding to 00:00:00 IST on the current IST
// calendar day — compare timestamptz columns against this, not against
// a plain `new Date()` day-truncation.
export function startOfTodayIST(): Date {
  const shifted = new Date(Date.now() + IST_OFFSET_MS);
  const istMidnightAsUTC = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0, 0, 0);
  return new Date(istMidnightAsUTC - IST_OFFSET_MS);
}

// Which IST calendar day a given instant falls on, as "YYYY-MM-DD" — for
// grouping/comparing events by day on the client (e.g. "is this one of
// today's attendance events"). Plain `date.toISOString().slice(0, 10)`
// gives the UTC calendar day instead, which disagrees with the
// IST-aware server-side check above for anything between IST midnight
// and 5:30 AM — an event the server correctly attributes to the new
// IST day would otherwise silently fail to show up under "today" here.
export function toISTDateString(date: Date): string {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
