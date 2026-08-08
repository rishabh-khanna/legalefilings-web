import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { hasToolAccess } from "@/lib/tool-grants";

// PATCH /api/admin/employees/[id] — admin only. Covers the org-assigned
// fields an employee shouldn't be able to set on themselves (department,
// designation, UAN/ESIC — issued by the employer/scheme, not self-declared)
// as well as the rest of the employee master record, for the cases HR
// needs to correct something the employee entered wrong.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "employees"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const {
    employeeId,
    department,
    designation,
    dateOfJoining,
    uanNumber,
    esicNumber,
    aadhaarNumber,
    panNumber,
    bankAccountNumber,
    bankIfsc,
    bankName,
    staffLevel,
    departmentId,
    departmentRoleId,
    reportsTo,
    isActive,
  } = body as Record<string, unknown>;

  const supabase = getSupabaseAdmin();

  // Reactivating (undoing a deactivate) unbans the auth account first —
  // no point flipping the profile flag back if they still can't log in.
  if (isActive === true) {
    const { error: unbanError } = await supabase.auth.admin.updateUserById(id, { ban_duration: "none" });
    if (unbanError) return NextResponse.json({ error: unbanError.message }, { status: 500 });
  }

  // Department/Designation are mandatory on the employee master record —
  // enforced here (not just client-side in the edit form) since this is
  // the only route that ever sets them. Only checked when the request is
  // actually the edit-form submission (both keys present) — a
  // reactivate-only call (`{isActive: true}`, no department/designation
  // keys at all) isn't touching these fields and shouldn't be blocked by
  // a rule about a form it didn't submit; that would trap any legacy
  // employee who predates this requirement in a permanent "can't
  // reactivate until someone backfills their department" state.
  if (typeof department === "string" && typeof designation === "string") {
    if (!department.trim() || !designation.trim()) {
      return NextResponse.json({ error: "Department and Designation are required." }, { status: 400 });
    }
  }

  const patch: Record<string, unknown> = {};
  if (typeof isActive === "boolean") patch.is_active = isActive;
  if (typeof employeeId === "string") patch.employee_id = employeeId || null;
  if (typeof department === "string") patch.department = department || null;
  if (typeof designation === "string") patch.designation = designation || null;
  if (typeof dateOfJoining === "string") patch.date_of_joining = dateOfJoining || null;
  if (typeof uanNumber === "string") patch.uan_number = uanNumber || null;
  if (typeof esicNumber === "string") patch.esic_number = esicNumber || null;
  if (typeof aadhaarNumber === "string") patch.aadhaar_number = aadhaarNumber || null;
  if (typeof panNumber === "string") patch.pan_number = panNumber || null;
  if (typeof bankAccountNumber === "string") patch.bank_account_number = bankAccountNumber || null;
  if (typeof bankIfsc === "string") patch.bank_ifsc = bankIfsc || null;
  if (typeof bankName === "string") patch.bank_name = bankName || null;
  if (staffLevel === "rater" || staffLevel === "leader" || staffLevel === "group_leader") patch.staff_level = staffLevel;
  // departmentId/departmentRoleId (the configurable-hierarchy fields) —
  // cleared together when departmentId is unset, since a role only
  // makes sense within the department it belongs to.
  if (typeof departmentId === "string") {
    patch.department_id = departmentId || null;
    if (!departmentId) patch.department_role_id = null;
  }
  if (typeof departmentRoleId === "string") patch.department_role_id = departmentRoleId || null;
  if (typeof reportsTo === "string") patch.reports_to = reportsTo || null;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  // reports_to used to only be settable at account-creation time (see
  // /api/admin/create-user) — there was no way to reassign who someone
  // reports to afterward, which left canApproveFor/canManageStaff (both
  // driven entirely by this field) permanently fixed from whatever was
  // picked on day one. Same organization + no-self-report guard as
  // create-user, plus a cycle guard create-user didn't need (a brand
  // new hire can't already have subordinates): the proposed manager
  // can't already be someone who reports up through this employee,
  // directly or transitively — that would wire a loop into the chain
  // canManageStaff/canApproveFor walk.
  if (typeof patch.reports_to === "string") {
    if (patch.reports_to === id) {
      return NextResponse.json({ error: "An employee can't report to themselves" }, { status: 400 });
    }
    const { data: manager } = await supabase.from("profiles").select("organization_id, account_type").eq("id", patch.reports_to).single();
    if (!manager || manager.organization_id !== profile.organization_id || manager.account_type === "customer") {
      return NextResponse.json({ error: "reportsTo must be a staff member in your own organization" }, { status: 400 });
    }
    const subordinates = await getReportingChainIds(id);
    if (subordinates.includes(patch.reports_to)) {
      return NextResponse.json({ error: "That person already reports up through this employee — can't create a reporting loop" }, { status: 400 });
    }
  }

  // A role only means anything within the department it belongs to —
  // nothing in the schema enforces that pairing, so a caller setting
  // departmentRoleId without also (correctly) setting departmentId in
  // the same request could otherwise leave a profile pointing at a role
  // from a different department than its own department_id.
  if (typeof patch.department_role_id === "string") {
    const effectiveDepartmentId =
      typeof patch.department_id === "string" || patch.department_id === null
        ? (patch.department_id as string | null)
        : (await supabase.from("profiles").select("department_id").eq("id", id).single()).data?.department_id ?? null;
    const { data: role } = await supabase.from("department_roles").select("department_id").eq("id", patch.department_role_id).single();
    if (!role || role.department_id !== effectiveDepartmentId) {
      return NextResponse.json({ error: "That role doesn't belong to the selected department" }, { status: 400 });
    }
  }

  let query = supabase.from("profiles").update(patch).eq("id", id);
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  const { data, error } = await query.select().single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "That Employee ID is already in use." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, employee: data });
}

// DELETE /api/admin/employees/[id] — admin only.
//
// attendance_events/leave_requests/payslips/salary_structures/
// employee_documents/generated_letters/attendance_corrections all
// reference profiles(id) with no ON DELETE cascade — deliberately, since
// payroll/attendance history needs to survive someone leaving, for
// compliance. That meant a hard delete used to just throw a raw
// foreign-key-violation error for any employee who'd ever clocked in,
// requested leave, or had a payslip generated — i.e. almost every real
// employee within days of joining, despite the old comment here
// claiming this was "irreversible" and safe. Now: hard-delete only when
// there's truly zero history (a mis-created account); otherwise
// deactivate instead — block their login (Supabase Auth ban) and flag
// the profile, keeping every historical record intact.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "employees"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (id === profile.id) return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!canSeeAllOrgs(profile)) {
    const { data: target } = await supabase.from("profiles").select("organization_id").eq("id", id).single();
    if (!target || target.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
  }

  const historyChecks = await Promise.all([
    supabase.from("attendance_events").select("id", { count: "exact", head: true }).eq("staff_id", id),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("staff_id", id),
    supabase.from("attendance_corrections").select("id", { count: "exact", head: true }).eq("staff_id", id),
    supabase.from("payslips").select("id", { count: "exact", head: true }).eq("staff_id", id),
    supabase.from("salary_structures").select("id", { count: "exact", head: true }).eq("staff_id", id),
    supabase.from("employee_documents").select("id", { count: "exact", head: true }).eq("staff_id", id),
    supabase.from("generated_letters").select("id", { count: "exact", head: true }).eq("staff_id", id),
  ]);
  const hasHistory = historyChecks.some((r) => (r.count ?? 0) > 0);

  if (hasHistory) {
    const { error: banError } = await supabase.auth.admin.updateUserById(id, { ban_duration: "876000h" });
    if (banError) return NextResponse.json({ error: banError.message }, { status: 500 });
    const { error: deactivateError } = await supabase.from("profiles").update({ is_active: false }).eq("id", id);
    if (deactivateError) return NextResponse.json({ error: deactivateError.message }, { status: 500 });
    return NextResponse.json({ ok: true, deactivated: true });
  }

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deactivated: false });
}
