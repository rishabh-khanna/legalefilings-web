import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canManageStaff } from "@/lib/reporting-chain";

// POST /api/attendance — clock in/out for the logged-in staff member.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const eventType = body?.type;
  if (eventType !== "check_in" && eventType !== "check_out") {
    return NextResponse.json({ error: "type must be 'check_in' or 'check_out'" }, { status: 400 });
  }
  const location =
    typeof body?.location?.lat === "number" && typeof body?.location?.lng === "number"
      ? `${body.location.lat},${body.location.lng}`
      : null;

  const supabase = getSupabaseAdmin();

  // The "already clocked in / not clocked in" guard used to be a plain
  // SELECT-then-INSERT here — a race between two near-simultaneous
  // requests (double-click, two tabs) could let both through before
  // either wrote. record_attendance_event does the same check and the
  // insert as one atomic database transaction (advisory-locked per
  // staff member), so a losing concurrent request fails cleanly instead
  // of both succeeding.
  // No .single() here — record_attendance_event returns a plain
  // attendance_events row (not SETOF), which PostgREST already hands
  // back as a single JSON object for RPC calls; .single() is for
  // unwrapping the array a table .select() normally returns and isn't
  // the right tool for an RPC that's already scalar.
  const { data, error } = await supabase.rpc("record_attendance_event", {
    p_staff_id: profile.id,
    p_organization_id: profile.organization_id,
    p_event_type: eventType,
    p_location: location,
  });

  if (error) {
    if (error.message?.includes("already_clocked_in")) return NextResponse.json({ error: "Already clocked in" }, { status: 409 });
    if (error.message?.includes("not_clocked_in")) return NextResponse.json({ error: "Not clocked in" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, event: data }, { status: 201 });
}

// GET /api/attendance — own history, or (admin, or a leader/group_leader
// for their own reporting chain) another staff member's via ?staffId=,
// optionally scoped to ?month=YYYY-MM.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const requestedStaffId = searchParams.get("staffId");
  const month = searchParams.get("month");

  let staffId: string | null = profile.id;
  if (requestedStaffId && requestedStaffId !== profile.id) {
    staffId = (await canManageStaff(profile, requestedStaffId)) ? requestedStaffId : null;
  }
  if (!staffId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  let query = supabase.from("attendance_events").select("*").eq("staff_id", staffId).order("occurred_at", { ascending: true });
  if (month) {
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    // Date.UTC, not new Date(y, m, ...) — the latter is local time and
  // toISOString() converts it back to UTC, which lands a day earlier for
  // any timezone ahead of UTC. As an exclusive month-end bound in IST
  // that silently dropped the last day of every month from the range.
    const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    query = query.gte("occurred_at", start).lt("occurred_at", end);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data });
}
