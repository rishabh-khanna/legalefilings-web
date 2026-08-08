import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";

// GET /api/holidays — any signed-in user (staff/admin) can view their
// own org's calendar; RLS also enforces this directly (see migration
// 20260808000000), but routing through the API keeps the pattern
// consistent with everything else in this app.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  // organizations(name) only actually matters for a platform_admin, who
  // sees every org's calendar pooled together here — without it, two
  // orgs' identically-named holidays (e.g. "Diwali") are indistinguishable.
  let query = supabase.from("holidays").select("*, organizations(name)").order("date", { ascending: true });
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holidays: data });
}

// POST /api/holidays — admin only.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { name, date, type } = body ?? {};
  if (!name || !date) return NextResponse.json({ error: "name and date are required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("holidays")
    .insert({ organization_id: profile.organization_id, name, date, type: type ?? "company", created_by: profile.id })
    .select()
    .single();

  if (error) {
    // 23505 = holidays_org_date_idx (organization_id, date) — one
    // holiday per calendar date per org; a second attempt on the same
    // date (double-submit, or genuinely picking an already-used date)
    // gets a clear message instead of a duplicate row or a raw 500.
    if (error.code === "23505") {
      return NextResponse.json({ error: "A holiday is already scheduled on this date. Remove it first if you want to replace it." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, holiday: data }, { status: 201 });
}
