import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

// GET /api/payroll/payslips — a staff member sees their own; admin (or a
// staff member individually delegated the "payslips" tool) sees
// everyone's (optionally filtered by ?staffId=).
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestedStaffId = searchParams.get("staffId");

  const supabase = getSupabaseAdmin();
  // organizations(name) only actually matters for a platform_admin, who
  // sees every org's payslips pooled together here — without it, rows
  // from different orgs are indistinguishable in the list.
  // Two FKs to profiles (staff_id, generated_by) — both need the
  // explicit profiles!payslips_<column>_fkey form, PostgREST can't
  // infer either from "profiles" alone with two on the same table.
  let query = supabase
    .from("payslips")
    .select("*, profiles!payslips_staff_id_fkey(full_name), organizations(name), generator:profiles!payslips_generated_by_fkey(full_name)")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (profile.account_type === "admin" || (await hasToolAccess(profile, "payslips"))) {
    if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
    if (requestedStaffId) query = query.eq("staff_id", requestedStaffId);
  } else {
    query = query.eq("staff_id", profile.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payslips: data });
}
