import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

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

  // Guard against double clock-ins/outs — look at today's most recent event.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data: last } = await supabase
    .from("attendance_events")
    .select("event_type")
    .eq("staff_id", profile.id)
    .gte("occurred_at", startOfDay.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventType === "check_in" && last?.event_type === "check_in") {
    return NextResponse.json({ error: "Already clocked in" }, { status: 409 });
  }
  if (eventType === "check_out" && (!last || last.event_type === "check_out")) {
    return NextResponse.json({ error: "Not clocked in" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("attendance_events")
    .insert({ staff_id: profile.id, event_type: eventType, location })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, event: data }, { status: 201 });
}

// GET /api/attendance — own history, or (admin only) another staff
// member's via ?staffId=, optionally scoped to ?month=YYYY-MM.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const requestedStaffId = searchParams.get("staffId");
  const month = searchParams.get("month");

  const staffId = requestedStaffId && requestedStaffId !== profile.id
    ? (profile.account_type === "admin" ? requestedStaffId : null)
    : profile.id;
  if (!staffId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  let query = supabase.from("attendance_events").select("*").eq("staff_id", staffId).order("occurred_at", { ascending: true });
  if (month) {
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const end = new Date(y, m, 1).toISOString().slice(0, 10);
    query = query.gte("occurred_at", start).lt("occurred_at", end);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data });
}
