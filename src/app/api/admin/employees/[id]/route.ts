import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

// PATCH /api/admin/employees/[id] — admin only. Covers the org-assigned
// fields an employee shouldn't be able to set on themselves (department,
// designation, UAN/ESIC — issued by the employer/scheme, not self-declared)
// as well as the rest of the employee master record, for the cases HR
// needs to correct something the employee entered wrong.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const {
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
  } = body as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
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

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, employee: data });
}

// DELETE /api/admin/employees/[id] — admin only. Removes the auth user;
// the profile row cascades with it (profiles.id has ON DELETE CASCADE to
// auth.users). Irreversible — the confirming UI makes that explicit.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (id === profile.id) return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
