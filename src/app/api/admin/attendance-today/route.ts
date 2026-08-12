import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";

// GET /api/admin/attendance-today — admin only. Per-staff Present/Absent
// for today, the exact roster and "present" definition (checked in since
// local midnight) the Overview page's "Present Today" / "Absent Today"
// KPI tiles already count — this is what backs those tiles' destination
// page (see the "today" view on Team Attendance) so the number a viewer
// clicks and the list they land on actually agree, instead of landing on
// an unrelated single-staff month log.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const orgScope = canSeeAllOrgs(profile) ? null : profile.organization_id;

  let staffQuery = supabase.from("profiles").select("id, full_name").in("account_type", ["staff", "admin"]).order("full_name", { ascending: true });
  if (orgScope) staffQuery = staffQuery.eq("organization_id", orgScope);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  let checkinsQuery = supabase
    .from("attendance_events")
    .select("staff_id, occurred_at")
    .eq("event_type", "check_in")
    .gte("occurred_at", todayStart.toISOString())
    .order("occurred_at", { ascending: true });
  if (orgScope) checkinsQuery = checkinsQuery.eq("organization_id", orgScope);

  const [{ data: staffRows, error: staffError }, { data: checkinRows, error: checkinError }] = await Promise.all([staffQuery, checkinsQuery]);
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });
  if (checkinError) return NextResponse.json({ error: checkinError.message }, { status: 500 });

  // First check-in per staff member, not the last — "present" is set the
  // moment they clock in at all today, and a second check-in on the same
  // day (after a correction, say) shouldn't push the displayed time later.
  const firstCheckIn = new Map<string, string>();
  for (const row of checkinRows ?? []) {
    if (!firstCheckIn.has(row.staff_id)) firstCheckIn.set(row.staff_id, row.occurred_at);
  }

  const staff = (staffRows ?? []).map((s) => ({
    id: s.id,
    name: s.full_name ?? "Unnamed",
    present: firstCheckIn.has(s.id),
    checkInAt: firstCheckIn.get(s.id) ?? null,
  }));

  return NextResponse.json({ staff });
}
