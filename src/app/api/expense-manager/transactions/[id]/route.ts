import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { applyExpenseBalanceEffect, getBookAccess, hasPermission, logExpenseAudit } from "@/lib/expense-manager";
import { formatMoney } from "@/lib/currency";

// PATCH /api/expense-manager/transactions/[id] — editing rewrites
// already-recorded history, so it's gated the same as delete
// (owner/admin only) — an accountant/employee can add new entries but
// not silently alter a past one; if they made a mistake, the owner/
// admin corrects or deletes it. Reverses the old balance effect, then
// applies the new one, so an amount or payment-mode/account change
// never leaves a stale delta sitting in a bank balance or cash book.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("expense_transactions").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const access = await getBookAccess(supabase, profile.id, existing.customer_id);
  if (!access || !hasPermission(access, "delete_expense")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const {
    transactionDate, categoryId, description, amount, paymentMode, accountId,
    referenceNumber, partyName, gstin, documentNumber, gstApplicable, taxableValue, cgst, sgst, igst, notes,
    tdsApplicable, tdsSection, tdsRate, tdsAmount,
  } = body as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if (typeof transactionDate === "string" && transactionDate) patch.transaction_date = transactionDate;
  // Category is required master data (see POST) — an edit is allowed to
  // leave it untouched (key simply absent from the body), but if the
  // edit form did submit categoryId, it can't be blanked out.
  if (typeof categoryId === "string") {
    if (!categoryId) return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
    patch.category_id = categoryId;
  }
  if (typeof description === "string") patch.description = description || null;
  if (typeof amount === "number" && amount > 0) patch.amount = amount;
  if (typeof paymentMode === "string" && ["bank", "cash", "upi", "cheque", "card"].includes(paymentMode)) patch.payment_mode = paymentMode;
  if (typeof accountId === "string") patch.account_id = accountId || null;
  if (typeof referenceNumber === "string") patch.reference_number = referenceNumber || null;
  if (typeof partyName === "string") patch.party_name = partyName || null;
  if (typeof gstin === "string") patch.gstin = gstin || null;
  if (typeof documentNumber === "string") patch.document_number = documentNumber || null;
  if (typeof gstApplicable === "boolean") patch.gst_applicable = gstApplicable;
  if (typeof taxableValue === "number") patch.taxable_value = taxableValue;
  if (typeof cgst === "number") patch.cgst = cgst;
  if (typeof sgst === "number") patch.sgst = sgst;
  if (typeof igst === "number") patch.igst = igst;
  if (typeof notes === "string") patch.notes = notes || null;
  if (typeof tdsApplicable === "boolean") patch.tds_applicable = tdsApplicable;
  if (typeof tdsSection === "string") patch.tds_section = tdsSection || null;
  if (typeof tdsRate === "number") patch.tds_rate = tdsRate;
  if (typeof tdsAmount === "number") patch.tds_amount = tdsAmount;

  const nextPaymentMode = (patch.payment_mode as string | undefined) ?? existing.payment_mode;
  const nextAccountId = nextPaymentMode === "cash" ? null : ((patch.account_id as string | undefined) ?? existing.account_id);
  patch.account_id = nextAccountId;
  if (nextPaymentMode !== "cash" && !nextAccountId) {
    return NextResponse.json({ error: "accountId is required unless paymentMode is 'cash'" }, { status: 400 });
  }
  // POST already checks a supplied accountId belongs to this book — PATCH
  // didn't, so an edit could silently point the balance effect at a
  // completely different customer's account. Only worth checking when the
  // account is actually changing (skip re-validating the existing,
  // already-legitimate account_id on every unrelated edit).
  if (nextAccountId && nextAccountId !== existing.account_id) {
    const { data: account } = await supabase.from("expense_accounts").select("id").eq("id", nextAccountId).eq("customer_id", existing.customer_id).single();
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await applyExpenseBalanceEffect(supabase, existing, -1);

  const { data, error } = await supabase.from("expense_transactions").update(patch).eq("id", id).select().single();
  if (error) {
    // Best-effort: put the original balance effect back since the edit
    // itself didn't go through.
    await applyExpenseBalanceEffect(supabase, existing, 1);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await applyExpenseBalanceEffect(supabase, data, 1);
  const { data: currencyProfile } = await supabase.from("expense_business_profiles").select("currency").eq("customer_id", existing.customer_id).single();
  await logExpenseAudit(supabase, {
    bookOwnerId: existing.customer_id,
    organizationId: existing.organization_id,
    actorId: profile.id,
    action: "updated_transaction",
    entityType: "transaction",
    entityId: id,
    detail: `${data.transaction_type === "expense" ? "Expense" : "Income"} — ${formatMoney(data.amount, currencyProfile?.currency)}`,
  });

  return NextResponse.json({ ok: true, transaction: data });
}

// DELETE /api/expense-manager/transactions/[id] — reverses its balance
// effect before removing it, same reasoning as PATCH.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("expense_transactions").select("*").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const access = await getBookAccess(supabase, profile.id, existing.customer_id);
  if (!access || !hasPermission(access, "delete_expense")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await applyExpenseBalanceEffect(supabase, existing, -1);

  const { error } = await supabase.from("expense_transactions").delete().eq("id", id);
  if (error) {
    await applyExpenseBalanceEffect(supabase, existing, 1);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: currencyProfile } = await supabase.from("expense_business_profiles").select("currency").eq("customer_id", existing.customer_id).single();
  await logExpenseAudit(supabase, {
    bookOwnerId: existing.customer_id,
    organizationId: existing.organization_id,
    actorId: profile.id,
    action: "deleted_transaction",
    entityType: "transaction",
    entityId: id,
    detail: `${existing.transaction_type === "expense" ? "Expense" : "Income"} — ${formatMoney(existing.amount, currencyProfile?.currency)}`,
  });

  return NextResponse.json({ ok: true });
}
