import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

// PATCH /api/admin/departments/[id] — rename a department. Admin only.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "departments"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  let query = supabase.from("departments").update({ name }).eq("id", id);
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  const { data, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, department: data });
}

// DELETE /api/admin/departments/[id] — admin only. Any staff currently
// assigned to this department (or one of its roles) falls back to no
// department/role rather than being blocked — the FK columns on
// profiles are nullable for exactly this reason, so deleting a
// department is never destructive to the staff rows themselves.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "departments"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  if (!canSeeAllOrgs(profile)) {
    const { data: dept } = await supabase.from("departments").select("organization_id").eq("id", id).single();
    if (!dept || dept.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }
  }

  await supabase.from("profiles").update({ department_id: null, department_role_id: null }).eq("department_id", id);
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
