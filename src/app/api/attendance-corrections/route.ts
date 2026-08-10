import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { canSeeAllOrgs } from "@/lib/organization";

// Without ?scope=mine: a leader/group_leader (or admin/platform_admin)
// sees their reporting chain's (or, for admin/platform_admin, the whole
// org's/every org's) correction requests — the Team Attendance admin
// page wants this. With ?scope=mine: always just the caller's own
// requests, regardless of role — the personal Attendance page's own
// "Correction Requests" view uses this, since an admin's personal
// history shouldn't silently include their whole team's requests just
// because their role would otherwise see everything.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mineOnly = searchParams.get("scope") === "mine";

  const supabase = getSupabaseAdmin();
  // organizations(name) only actually matters for a platform_admin, who
  // sees every org's correction requests pooled together here —
  // without it, two same-named staff across different orgs (or just any
  // row) are indistinguishable in the list.
  // profiles!attendance_corrections_reviewed_by_fkey — who actually
  // approved/rejected it, so the requester can see who made the call,
  // not just what the call was.
  let query = supabase
    .from("attendance_corrections")
    .select("*, profiles!attendance_corrections_staff_id_fkey(full_name), reviewer:profiles!attendance_corrections_reviewed_by_fkey(full_name), organizations(name)")
    .order("created_at", { ascending: false });

  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  if (mineOnly) {
    query = query.eq("staff_id", profile.id);
  } else if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
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
      organization_id: profile.organization_id,
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
