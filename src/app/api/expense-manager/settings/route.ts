import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";

// PATCH /api/expense-manager/settings — owner/admin only. Turns the
// approval workflow on/off, and sets the two alert thresholds (Module
// 11: low bank balance, large expense). Off/unset by default for every
// book — an owner opts in, existing books keep behaving exactly as
// before this phase.
export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { bookOwnerId: requestedBookOwnerId, approvalRequired, lowBalanceThreshold, largeExpenseThreshold } = body as Record<string, unknown>;
  const bookOwnerId = typeof requestedBookOwnerId === "string" && requestedBookOwnerId ? requestedBookOwnerId : profile.id;

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const patch: Record<string, unknown> = {};
  if (typeof approvalRequired === "boolean") patch.approval_required = approvalRequired;
  if (lowBalanceThreshold === null || typeof lowBalanceThreshold === "number") patch.low_balance_threshold = lowBalanceThreshold;
  if (largeExpenseThreshold === null || typeof largeExpenseThreshold === "number") patch.large_expense_threshold = largeExpenseThreshold;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  const { data, error } = await supabase.from("expense_business_profiles").update(patch).eq("customer_id", bookOwnerId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profile: data });
}
