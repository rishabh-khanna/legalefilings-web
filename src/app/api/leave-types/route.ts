import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { hasToolAccess } from "@/lib/tool-grants";

// GET /api/leave-types — any staff/admin in the org (needed to populate
// the "Apply for Leave" type picker for everyone, not just admin).
// Deliberately NOT canSeeAllOrgs-bypassed for platform_admin, unlike most
// list routes in this app — leave types are an "apply for my own leave"
// / "manage my own org's HR config" concern, never a cross-org oversight
// one (same reasoning as Business Finance having no automatic
// platform_admin reach). Every org seeds its own "Casual Leave"/"Sick
// Leave" pair (see seedDefaultLeaveTypes), so a platform_admin bypass
// here would merge every org's identically-named types into one
// duplicate-riddled picker.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("leave_types")
    .select("*, creator:profiles!leave_types_created_by_fkey(full_name)")
    .eq("organization_id", profile.organization_id)
    .eq("is_active", true)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leaveTypes: data });
}

// POST /api/leave-types — admin only (or a staff member individually
// delegated the "leave_types" tool).
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "leave_types"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  const annualCreditDays = typeof body?.annualCreditDays === "number" ? body.annualCreditDays : NaN;
  const carryForwardCap = typeof body?.carryForwardCap === "number" ? body.carryForwardCap : 0;
  if (!name || !code || Number.isNaN(annualCreditDays) || annualCreditDays < 0) {
    return NextResponse.json({ error: "name, code, and a non-negative annualCreditDays are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("leave_types")
    .insert({ organization_id: profile.organization_id, name, code, annual_credit_days: annualCreditDays, carry_forward_cap: Math.max(0, carryForwardCap), created_by: profile.id })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "A leave type with that code already exists." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, leaveType: data }, { status: 201 });
}
