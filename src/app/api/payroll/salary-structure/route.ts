import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

// GET /api/payroll/salary-structure?staffId=... — admin only. Returns the
// most recent salary structure for a staff member, if any.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "payroll"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staffId");
  if (!staffId) return NextResponse.json({ error: "staffId is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!canSeeAllOrgs(profile)) {
    const { data: target } = await supabase.from("profiles").select("organization_id").eq("id", staffId).single();
    if (!target || target.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }
  }
  const { data, error } = await supabase
    .from("salary_structures")
    .select("*")
    .eq("staff_id", staffId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ structure: data });
}

// POST /api/payroll/salary-structure — admin only. Sets (inserts a new
// dated) salary structure for a staff member — kept append-only so past
// payslips stay accurate against the structure that was active when they
// were generated, rather than silently changing history.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "payroll"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { staffId, basic, hra, specialAllowance, bonus, incentives, effectiveFrom } = body ?? {};
  if (!staffId || typeof basic !== "number" || !(basic > 0)) {
    return NextResponse.json({ error: "staffId and a basic salary greater than 0 are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: targetStaff } = await supabase.from("profiles").select("organization_id").eq("id", staffId).single();
  if (!targetStaff || (!canSeeAllOrgs(profile) && targetStaff.organization_id !== profile.organization_id)) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("salary_structures")
    .insert({
      organization_id: targetStaff.organization_id,
      staff_id: staffId,
      basic,
      hra: hra ?? 0,
      special_allowance: specialAllowance ?? 0,
      bonus: bonus ?? 0,
      incentives: incentives ?? 0,
      effective_from: effectiveFrom || new Date().toISOString().slice(0, 10),
      created_by: profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, structure: data }, { status: 201 });
}
