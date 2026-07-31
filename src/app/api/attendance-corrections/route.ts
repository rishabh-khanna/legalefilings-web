import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("attendance_corrections")
    .select("*, profiles!attendance_corrections_staff_id_fkey(full_name)")
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
  const { date, checkIn, checkOut, reason } = body ?? {};
  if (!date || !reason) {
    return NextResponse.json({ error: "date and reason are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_corrections")
    .insert({
      staff_id: profile.id,
      date,
      requested_check_in: checkIn ?? null,
      requested_check_out: checkOut ?? null,
      reason,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, request: data }, { status: 201 });
}
