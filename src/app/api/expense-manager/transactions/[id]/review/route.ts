import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { applyExpenseBalanceEffect, getBookAccess, hasPermission, logExpenseAudit } from "@/lib/expense-manager";
import { formatMoney } from "@/lib/currency";

// PATCH /api/expense-manager/transactions/[id]/review — approve or
// reject a pending entry (the approval workflow's other half — see
// transactions/route.ts POST for where 'pending' gets set). Gated the
// same as edit/delete (owner/admin) — approving is a form of rewriting
// what actually counts as real, so it gets the same trust bar. Only an
// approval ever touches the balance — a rejected entry never affected
// it in the first place (it was never 'approved'), so there's nothing
// to reverse.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("expense_transactions").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (existing.status !== "pending") return NextResponse.json({ error: "Only pending entries can be reviewed" }, { status: 409 });

  const access = await getBookAccess(supabase, profile.id, existing.customer_id);
  if (!access || !hasPermission(access, "delete_expense")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
  }
  const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote : null;

  const { data, error } = await supabase
    .from("expense_transactions")
    .update({ status: decision === "approve" ? "approved" : "rejected", reviewed_by: profile.id, review_note: reviewNote })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (decision === "approve") await applyExpenseBalanceEffect(supabase, data, 1);

  const { data: currencyProfile } = await supabase.from("expense_business_profiles").select("currency").eq("customer_id", existing.customer_id).single();
  await logExpenseAudit(supabase, {
    bookOwnerId: existing.customer_id,
    organizationId: existing.organization_id,
    actorId: profile.id,
    action: decision === "approve" ? "approved_transaction" : "rejected_transaction",
    entityType: "transaction",
    entityId: id,
    detail: `${existing.transaction_type === "expense" ? "Expense" : "Income"} — ${formatMoney(existing.amount, currencyProfile?.currency)}`,
  });

  return NextResponse.json({ ok: true, transaction: data });
}
