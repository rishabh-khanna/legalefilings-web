import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";

// PATCH /api/expense-manager/accounts/[id] — edit account details or
// toggle is_active (a "closed" bank account stays visible in reports
// but drops out of the "pay from" picker on new transactions, rather
// than being deleted and losing its transaction history's account link).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("expense_accounts").select("customer_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const access = await getBookAccess(supabase, profile.id, existing.customer_id);
  if (!access || !hasPermission(access, "manage_accounts")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { bankName, accountName, isActive } = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof bankName === "string" && bankName) patch.bank_name = bankName;
  if (typeof accountName === "string" && accountName) patch.account_name = accountName;
  if (typeof isActive === "boolean") patch.is_active = isActive;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  const { data, error } = await supabase.from("expense_accounts").update(patch).eq("id", id).select().single();
  if (error || !data) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  return NextResponse.json({ ok: true, account: data });
}

// DELETE /api/expense-manager/accounts/[id] — only succeeds if no
// transaction has ever been recorded against it (the foreign key has no
// cascade — deleting an account out from under real transaction history
// would silently corrupt every report that reads it). If it's ever been
// used, closing it (PATCH isActive: false) is the right move instead.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("expense_accounts").select("customer_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const access = await getBookAccess(supabase, profile.id, existing.customer_id);
  if (!access || !hasPermission(access, "manage_accounts")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("expense_accounts").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return NextResponse.json({ error: "This account has transactions recorded against it — close it instead of deleting." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
