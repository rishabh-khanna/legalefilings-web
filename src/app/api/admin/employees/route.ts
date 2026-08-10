import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

// GET /api/admin/employees — admin only (or a staff member individually
// delegated the "employees" tool — see src/lib/tool-grants.ts). Lists
// every staff/admin profile in the caller's own org (platform_admin sees
// every org's) for the Employees management page (Module 2: Add/Edit/
// Delete Employee).
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "employees"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  // organizations(name) only actually matters for a platform_admin, who
  // sees every org's staff pooled together here — without it, employees
  // from different orgs are indistinguishable in the list.
  // organizations!organization_id and department_roles!profiles_department_role_id_fkey
  // both disambiguate their embed — profiles has more than one FK to each
  // (organizations: multiple FKs; department_roles: this one plus
  // department_roles.created_by pointing back at profiles), so PostgREST
  // can't infer either alone (PGRST201, "more than one relationship found").
  let query = supabase
    .from("profiles")
    .select("*, department_roles!profiles_department_role_id_fkey(title, is_manager_level), organizations!organization_id(name)")
    .in("account_type", ["staff", "admin"])
    .order("full_name", { ascending: true });
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employees: data });
}
