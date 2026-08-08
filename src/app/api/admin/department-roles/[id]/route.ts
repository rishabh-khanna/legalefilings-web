import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";
import type { Profile } from "@/lib/roles";

async function assertOwnsRole(profile: Profile, id: string) {
  if (!(await hasToolAccess(profile, "departments"))) return false;
  if (canSeeAllOrgs(profile)) return true;
  const supabase = getSupabaseAdmin();
  const { data: role } = await supabase.from("department_roles").select("department_id, departments(organization_id)").eq("id", id).single();
  const orgId = (role?.departments as unknown as { organization_id: string } | null)?.organization_id;
  return orgId === profile.organization_id;
}

// PATCH /api/admin/department-roles/[id] — rename/reorder/retitle a role,
// or flip is_manager_level. Admin only.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await assertOwnsRole(profile, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  if (typeof body?.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (typeof body?.rank === "number") patch.rank = body.rank;
  if (typeof body?.isManagerLevel === "boolean") patch.is_manager_level = body.isManagerLevel;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("department_roles").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, role: data });
}

// DELETE /api/admin/department-roles/[id] — admin only. Anyone currently
// assigned this role falls back to no role (department stays intact),
// same reasoning as deleting a department.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await assertOwnsRole(profile, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  await supabase.from("profiles").update({ department_role_id: null }).eq("department_role_id", id);
  const { error } = await supabase.from("department_roles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
