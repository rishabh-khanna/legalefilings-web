import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { generateTempPassword } from "@/lib/admin-actions";
import { sendAccountCreatedEmail } from "@/lib/email";
import { getBookAccess, hasPermission, logExpenseAudit, type ExpenseBookRole } from "@/lib/expense-manager";

const INVITABLE_ROLES: ExpenseBookRole[] = ["admin", "accountant", "employee", "viewer"];

// GET /api/expense-manager/members?bookOwnerId=... — any member of a
// book can see who else has access to it (reasonable transparency, not
// a manage_users-gated action — only *changing* the team is).
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bookOwnerId = searchParams.get("bookOwnerId") || profile.id;

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("expense_book_members")
    .select("*, profiles!expense_book_members_member_id_fkey(full_name)")
    .eq("book_owner_id", bookOwnerId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data });
}

// POST /api/expense-manager/members — invite someone onto a book
// (Module 12). Gets-or-creates their account by email, same
// resolve-or-create pattern the public checkout flow uses (there's no
// admin.getUserByEmail in the JS client) — an invite either grants
// access to someone who already has a login, or creates a brand-new one
// with a temp password, same as every other "invite" flow in this app.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { bookOwnerId: requestedBookOwnerId, email, fullName, role } = body ?? {};
  const bookOwnerId = requestedBookOwnerId || profile.id;
  if (!email || !INVITABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: `email and a role (${INVITABLE_ROLES.join(", ")}) are required` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: bookProfile } = await supabase.from("expense_business_profiles").select("organization_id").eq("customer_id", bookOwnerId).single();
  if (!bookProfile) return NextResponse.json({ error: "Business profile not found" }, { status: 404 });

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: String(email) });
  if (linkError || !linkData.user) {
    return NextResponse.json({ error: linkError?.message ?? "Failed to resolve account" }, { status: 500 });
  }
  const memberId = linkData.user.id;

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", memberId).maybeSingle();

  let tempPassword: string | null = null;
  if (!existingProfile) {
    tempPassword = generateTempPassword();
    const { error: pwError } = await supabase.auth.admin.updateUserById(memberId, { password: tempPassword, email_confirm: true });
    if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 });

    const { error: profileError } = await supabase.from("profiles").insert({
      id: memberId,
      organization_id: bookProfile.organization_id,
      full_name: fullName ? String(fullName) : String(email).split("@")[0],
      account_type: "customer",
      customer_tier: "free",
      crm_status: "active",
    });
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    try {
      await sendAccountCreatedEmail({ customerName: fullName ? String(fullName) : "there", customerEmail: String(email), tempPassword });
    } catch (err) {
      console.error("Failed to send account-created email:", err);
    }
  }

  const { data: member, error } = await supabase
    .from("expense_book_members")
    .upsert({ book_owner_id: bookOwnerId, member_id: memberId, organization_id: bookProfile.organization_id, role, invited_by: profile.id }, { onConflict: "book_owner_id,member_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logExpenseAudit(supabase, {
    bookOwnerId,
    organizationId: bookProfile.organization_id,
    actorId: profile.id,
    action: "added_member",
    entityType: "member",
    entityId: memberId,
    detail: `${email} as ${role}`,
  });

  return NextResponse.json({ ok: true, member, tempPassword }, { status: 201 });
}
