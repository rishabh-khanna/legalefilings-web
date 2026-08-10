import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

// GET /api/cron/close-open-shifts — closes attendance shifts somebody
// forgot to clock out of.
//
// A check-in with no matching check-out previously stayed open forever.
// Nothing detected it, so the shift silently ran for days, hours-worked
// reporting was meaningless for that day, and the record could never
// resolve itself. Roughly one staff-day in eight was affected.
//
// The auto-close is deliberately loud rather than invisible: the
// generated event carries AUTO_CLOSE_NOTE, the UI badges it, and the
// employee is expected to file an attendance correction with the real
// time. The correction workflow already exists and is built for exactly
// this — the point here is to stop the shift dangling and to make the
// gap visible, not to guess someone's hours and quietly bank it.
//
// Same fail-CLOSED auth as the other cron routes.

// Longer than any plausible real shift. Below this we assume someone is
// genuinely still clocked in and leave them alone.
const STALE_AFTER_HOURS = 14;
// What the generated check-out is stamped at, measured from the
// check-in. A standard working day — a documented default, not a
// measurement, which is why the note says so and a correction is invited.
const ASSUMED_SHIFT_HOURS = 9;

export const AUTO_CLOSE_NOTE = "auto-closed: no check-out recorded";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const profile = await getCurrentProfile();
    if (!profile?.is_platform_admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 3600_000).toISOString();

  // Only look at events old enough to be stale. Someone clocked in an
  // hour ago is just at work.
  const { data: events, error } = await supabase
    .from("attendance_events")
    .select("id, staff_id, organization_id, event_type, occurred_at")
    .lte("occurred_at", cutoff)
    .order("occurred_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Walk each staff member's timeline in order; whatever their last
  // event is tells us whether they're still clocked in. Done in memory
  // rather than per-staff queries because the alternative is N round
  // trips for what is one ordered scan.
  type Ev = { id: string; staff_id: string; organization_id: string; event_type: string; occurred_at: string };
  const lastByStaff = new Map<string, Ev>();
  for (const e of (events ?? []) as Ev[]) {
    lastByStaff.set(e.staff_id, e);
  }

  // Anything they did AFTER the cutoff means they're active — don't
  // close those, even if their last pre-cutoff event was a check-in.
  const staleStaffIds = Array.from(lastByStaff.entries())
    .filter(([, e]) => e.event_type === "check_in")
    .map(([staffId]) => staffId);
  if (staleStaffIds.length === 0) {
    return NextResponse.json({ ok: true, closed: 0 });
  }

  const { data: recent } = await supabase
    .from("attendance_events")
    .select("staff_id")
    .gt("occurred_at", cutoff)
    .in("staff_id", staleStaffIds);
  const activeSince = new Set((recent ?? []).map((r) => r.staff_id));

  const toInsert = staleStaffIds
    .filter((id) => !activeSince.has(id))
    .map((staffId) => {
      const openEvent = lastByStaff.get(staffId)!;
      const closeAt = new Date(new Date(openEvent.occurred_at).getTime() + ASSUMED_SHIFT_HOURS * 3600_000);
      return {
        staff_id: staffId,
        organization_id: openEvent.organization_id,
        event_type: "check_out" as const,
        occurred_at: closeAt.toISOString(),
        note: AUTO_CLOSE_NOTE,
      };
    });

  if (toInsert.length === 0) return NextResponse.json({ ok: true, closed: 0 });

  const { error: insertError } = await supabase.from("attendance_events").insert(toInsert);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ ok: true, closed: toInsert.length });
}
