import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";

// DELETE /api/expense-manager/budgets/[id] — remove a category's budget cap.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("expense_budgets").select("book_owner_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Budget not found" }, { status: 404 });

  const access = await getBookAccess(supabase, profile.id, existing.book_owner_id);
  if (!access || !hasPermission(access, "manage_accounts")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("expense_budgets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
