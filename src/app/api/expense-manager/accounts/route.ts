import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission, logExpenseAudit } from "@/lib/expense-manager";

// GET /api/expense-manager/accounts?bookOwnerId=... — defaults to the
// caller's own books; a member with access to someone else's books
// (Module 12) passes bookOwnerId to see theirs instead.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bookOwnerId = searchParams.get("bookOwnerId") || profile.id;

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("expense_accounts")
    .select("*")
    .eq("customer_id", bookOwnerId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data });
}

// POST /api/expense-manager/accounts — add a bank account after initial
// setup. Restricted to 'manage_accounts' (owner/admin only) — opening a
// new account is a structural change to the books, not a day-to-day
// entry an accountant/employee should be able to make on their own.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { bookOwnerId: requestedBookOwnerId, bankName, accountName, openingBalance, openingDate } = body ?? {};
  const bookOwnerId = requestedBookOwnerId || profile.id;
  if (!bankName || !accountName) {
    return NextResponse.json({ error: "bankName and accountName are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "manage_accounts")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const opening = typeof openingBalance === "number" ? openingBalance : 0;
  const { data: bookProfile } = await supabase.from("expense_business_profiles").select("organization_id").eq("customer_id", bookOwnerId).single();

  const { data, error } = await supabase
    .from("expense_accounts")
    .insert({
      customer_id: bookOwnerId,
      organization_id: bookProfile?.organization_id ?? profile.organization_id,
      bank_name: String(bankName),
      account_name: String(accountName),
      opening_balance: opening,
      opening_date: openingDate ? String(openingDate) : new Date().toISOString().slice(0, 10),
      current_balance: opening,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logExpenseAudit(supabase, {
    bookOwnerId,
    organizationId: data.organization_id,
    actorId: profile.id,
    action: "added_account",
    entityType: "account",
    entityId: data.id,
    detail: `${bankName} — ${accountName}`,
  });

  return NextResponse.json({ ok: true, account: data }, { status: 201 });
}
