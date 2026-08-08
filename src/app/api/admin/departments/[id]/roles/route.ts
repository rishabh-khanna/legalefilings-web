import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

// POST /api/admin/departments/[id]/roles — add a role title to a
// department's ladder. Admin only. rank just needs to be unique within
// the department (lower = more junior) — it's used purely to order the
// ladder for display, reports_to is what actually governs who manages
// whom, so there's no cross-department meaning to keep consistent.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const rank = typeof body?.rank === "number" ? body.rank : null;
  const isManagerLevel = Boolean(body?.isManagerLevel);
  if (!title || rank === null) return NextResponse.json({ error: "title and rank are required" }, { status: 400 });

  const { data, error } = await supabase
    .from("department_roles")
    .insert({ department_id: id, title, rank, is_manager_level: isManagerLevel })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, role: data }, { status: 201 });
}
