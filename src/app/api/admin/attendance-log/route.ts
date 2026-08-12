import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { toISTDateString } from "@/lib/ist-date";

// GET /api/admin/attendance-log?month=YYYY-MM — admin only. Every staff
// member's day-grouped check-in/check-out log for the month, in one
// call — backs the Team Attendance page's "Attendance Log" tab when
// "All Staff" is selected (its default), same org-scoping
// /api/admin/attendance-today already uses for the "Today's Status"
// tab. Picking a specific staff member from the dropdown switches the
// page over to the existing per-staff /api/attendance endpoint instead;
// this route only exists for the all-staff case.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const orgScope = canSeeAllOrgs(profile) ? null : profile.organization_id;

  let staffQuery = supabase.from("profiles").select("id, full_name").in("account_type", ["staff", "admin"]);
  if (orgScope) staffQuery = staffQuery.eq("organization_id", orgScope);
  const { data: staffRows, error: staffError } = await staffQuery;
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });
  const staffName = new Map((staffRows ?? []).map((s) => [s.id, s.full_name ?? "Unnamed"]));

  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  // Date.UTC, not new Date(y, m, ...) — see the same note on the
  // per-staff attendance report: local-time construction round-tripped
  // through toISOString() lands a day earlier for any timezone ahead of
  // UTC, silently dropping the month's last day from the range.
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  const eventsQuery = supabase
    .from("attendance_events")
    .select("staff_id, event_type, occurred_at, location, note")
    .in("staff_id", [...staffName.keys()])
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .order("occurred_at", { ascending: true });
  const { data: events, error: eventsError } = await eventsQuery;
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });

  // Grouped by staff+day — the same pairing groupByDay does client-side
  // for a single staff member, just keyed one level deeper here since
  // this spans every staff member's events pooled into one query.
  type Entry = { staffId: string; date: string; checkIn?: string; checkInLoc?: string | null; checkInNote?: string | null; checkOut?: string; checkOutLoc?: string | null; checkOutNote?: string | null };
  const byKey = new Map<string, Entry>();
  for (const ev of events ?? []) {
    const day = toISTDateString(new Date(ev.occurred_at));
    const key = `${ev.staff_id}::${day}`;
    const entry: Entry = byKey.get(key) ?? { staffId: ev.staff_id, date: day };
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
    byKey.set(key, entry);
  }

  const rows = Array.from(byKey.values())
    .map((r) => ({ ...r, staffName: staffName.get(r.staffId) ?? "Unknown" }))
    .sort((a, b) => (a.date === b.date ? a.staffName.localeCompare(b.staffName) : a.date.localeCompare(b.date)));

  return NextResponse.json({ rows });
}
