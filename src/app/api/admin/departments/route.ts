import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

// GET /api/admin/departments — any staff/admin in the org can list
// departments and their role ladders (it's org structure, not sensitive
// data — used to populate the assignment dropdown on the Employees page
// as well as the admin-only Departments management page).
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  // organizations(name) only actually matters for a platform_admin, who
  // sees every org's departments pooled together here — without it,
  // e.g. two different orgs' "Operations" department render as
  // indistinguishable duplicate cards.
  let query = supabase
    .from("departments")
    .select("*, department_roles(*, creator:profiles!department_roles_created_by_fkey(full_name)), organizations(name), creator:profiles!departments_created_by_fkey(full_name)")
    .order("name");
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const departments = (data ?? []).map((d) => ({
    ...d,
    department_roles: (d.department_roles ?? []).sort((a: { rank: number }, b: { rank: number }) => a.rank - b.rank),
  }));
  return NextResponse.json({ departments });
}

// POST /api/admin/departments — admin only. Creates an empty department;
// role titles are added separately via /api/admin/departments/[id]/roles.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "departments"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("departments")
    .insert({ organization_id: profile.organization_id, name, created_by: profile.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, department: data }, { status: 201 });
}
