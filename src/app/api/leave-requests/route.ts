import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";

// A leader/group_leader sees their own request plus their reporting
// chain's (so they can review their team, not just themselves); admin
// sees everything; a rater sees only their own.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("leave_requests")
    .select("*, profiles!leave_requests_staff_id_fkey(full_name)")
    .order("created_at", { ascending: false });

  if (profile.account_type !== "admin") {
    const chain = await getReportingChainIds(profile.id);
    query = query.in("staff_id", [profile.id, ...chain]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { leaveType, startDate, endDate, reason } = body ?? {};
  if (!leaveType || !startDate || !endDate) {
    return NextResponse.json({ error: "leaveType, startDate, and endDate are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      staff_id: profile.id,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, request: data }, { status: 201 });
}
