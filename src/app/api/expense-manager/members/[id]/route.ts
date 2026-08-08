import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission, logExpenseAudit, type ExpenseBookRole } from "@/lib/expense-manager";

const CHANGEABLE_ROLES: ExpenseBookRole[] = ["admin", "accountant", "employee", "viewer"];

// PATCH /api/expense-manager/members/[id] — change a member's role.
// [id] is the membership row's own id, not the member's profile id. The
// owner's row (role='owner') is fixed — ownership doesn't transfer via
// this route.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: member } = await supabase.from("expense_book_members").select("*").eq("id", id).single();
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (member.role === "owner") return NextResponse.json({ error: "The owner's role can't be changed here" }, { status: 400 });

  const access = await getBookAccess(supabase, profile.id, member.book_owner_id);
  if (!access || !hasPermission(access, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const role = body?.role;
  if (!CHANGEABLE_ROLES.includes(role)) return NextResponse.json({ error: `role must be one of ${CHANGEABLE_ROLES.join(", ")}` }, { status: 400 });

  const { data, error } = await supabase.from("expense_book_members").update({ role }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logExpenseAudit(supabase, {
    bookOwnerId: member.book_owner_id,
    organizationId: member.organization_id,
    actorId: profile.id,
    action: "changed_member_role",
    entityType: "member",
    entityId: member.member_id,
    detail: `Changed to ${role}`,
  });

  return NextResponse.json({ ok: true, member: data });
}

// DELETE /api/expense-manager/members/[id] — revoke access. Can't
// remove the owner's own row (that would leave the book with no owner).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: member } = await supabase.from("expense_book_members").select("*").eq("id", id).single();
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (member.role === "owner") return NextResponse.json({ error: "The owner can't be removed from their own books" }, { status: 400 });

  const access = await getBookAccess(supabase, profile.id, member.book_owner_id);
  if (!access || !hasPermission(access, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("expense_book_members").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logExpenseAudit(supabase, {
    bookOwnerId: member.book_owner_id,
    organizationId: member.organization_id,
    actorId: profile.id,
    action: "removed_member",
    entityType: "member",
    entityId: member.member_id,
  });

  return NextResponse.json({ ok: true });
}
