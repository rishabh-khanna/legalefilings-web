import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { applyExpenseBalanceEffect, getBookAccess, hasPermission, logExpenseAudit } from "@/lib/expense-manager";
import { formatMoney } from "@/lib/currency";

// GET /api/expense-manager/transactions?bookOwnerId=... — defaults to
// the caller's own books; any role can view (view_reports is on every
// role in Module 12's matrix). ?type=expense|income, ?accountId=...,
// ?from=YYYY-MM-DD, ?to=YYYY-MM-DD narrow it down.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bookOwnerId = searchParams.get("bookOwnerId") || profile.id;
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const accountId = searchParams.get("accountId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  // A non-numeric ?limit= used to become NaN here, and Math.min(NaN,
  // 1000) is still NaN — silently handed to .limit() below rather than
  // rejected or falling back to the default.
  const requestedLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 200;

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let query = supabase
    .from("expense_transactions")
    .select("*, expense_categories(name)")
    .eq("customer_id", bookOwnerId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 1000));
  if (type === "expense" || type === "income") query = query.eq("transaction_type", type);
  if (status === "pending" || status === "approved" || status === "rejected") query = query.eq("status", status);
  if (accountId) query = query.eq("account_id", accountId);
  if (from) query = query.gte("transaction_date", from);
  if (to) query = query.lte("transaction_date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transactions: data });
}

// POST /api/expense-manager/transactions — Module 3 (expense) and
// Module 4 (income) share this one endpoint. Requires 'add_expense' —
// every role except viewer has it.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const {
    bookOwnerId: requestedBookOwnerId, transactionType, transactionDate, categoryId, description, amount, paymentMode, accountId,
    referenceNumber, partyName, gstin, documentNumber, gstApplicable, taxableValue, cgst, sgst, igst, notes,
    tdsApplicable, tdsSection, tdsRate, tdsAmount,
  } = body as Record<string, unknown>;
  const bookOwnerId = typeof requestedBookOwnerId === "string" && requestedBookOwnerId ? requestedBookOwnerId : profile.id;

  if (transactionType !== "expense" && transactionType !== "income") {
    return NextResponse.json({ error: "transactionType must be 'expense' or 'income'" }, { status: 400 });
  }
  if (!transactionDate || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "transactionDate and a positive amount are required" }, { status: 400 });
  }
  if (!categoryId) {
    return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
  }
  if (!["bank", "cash", "upi", "cheque", "card"].includes(String(paymentMode))) {
    return NextResponse.json({ error: "Invalid paymentMode" }, { status: 400 });
  }
  if (paymentMode !== "cash" && !accountId) {
    return NextResponse.json({ error: "accountId is required unless paymentMode is 'cash'" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "add_expense")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: bookProfile } = await supabase
    .from("expense_business_profiles")
    .select("organization_id, approval_required, large_expense_threshold, currency")
    .eq("customer_id", bookOwnerId)
    .single();
  if (!bookProfile) return NextResponse.json({ error: "Business profile not found" }, { status: 404 });

  if (accountId) {
    const { data: account } = await supabase.from("expense_accounts").select("id").eq("id", accountId).eq("customer_id", bookOwnerId).single();
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Approval workflow — "Employees submit expenses. Managers approve or
  // reject them. Only approved expenses affect reports." An employee's
  // entry only gets held for review when the book owner has actually
  // turned that on; everyone else's entries (owner/admin/accountant —
  // roles that already can't be overridden by someone junior) still post
  // straight through, same as before this phase existed.
  const needsApproval = bookProfile.approval_required && access.role === "employee";
  const status = needsApproval ? "pending" : "approved";

  const insertRow = {
    customer_id: bookOwnerId,
    organization_id: bookProfile.organization_id,
    transaction_type: transactionType,
    transaction_date: String(transactionDate),
    category_id: categoryId ? String(categoryId) : null,
    description: description ? String(description) : null,
    amount,
    payment_mode: paymentMode,
    account_id: paymentMode === "cash" ? null : String(accountId),
    reference_number: referenceNumber ? String(referenceNumber) : null,
    party_name: partyName ? String(partyName) : null,
    gstin: gstin ? String(gstin) : null,
    document_number: documentNumber ? String(documentNumber) : null,
    gst_applicable: Boolean(gstApplicable),
    taxable_value: typeof taxableValue === "number" ? taxableValue : null,
    cgst: typeof cgst === "number" ? cgst : null,
    sgst: typeof sgst === "number" ? sgst : null,
    igst: typeof igst === "number" ? igst : null,
    notes: notes ? String(notes) : null,
    tds_applicable: Boolean(tdsApplicable),
    tds_section: tdsSection ? String(tdsSection) : null,
    tds_rate: typeof tdsRate === "number" ? tdsRate : null,
    tds_amount: typeof tdsAmount === "number" ? tdsAmount : null,
    status,
    created_by: profile.id,
  };

  const { data, error } = await supabase.from("expense_transactions").insert(insertRow).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await applyExpenseBalanceEffect(supabase, data, 1);
  await logExpenseAudit(supabase, {
    bookOwnerId,
    organizationId: bookProfile.organization_id,
    actorId: profile.id,
    action: `added_${transactionType}`,
    entityType: "transaction",
    entityId: data.id,
    detail: `${data.transaction_type === "expense" ? "Expense" : "Income"} — ${formatMoney(amount, bookProfile.currency)}${partyName ? ` (${partyName})` : ""}${needsApproval ? " (awaiting approval)" : ""}`,
  });

  // "Large Expense Alert" (Module 11) — logged to the same audit trail
  // rather than a separate notifications table; it shows up in Activity
  // and in the dashboard's alert banner (see /summary) without needing
  // a whole read/unread notification system for one threshold check.
  if (transactionType === "expense" && bookProfile.large_expense_threshold && amount > Number(bookProfile.large_expense_threshold)) {
    await logExpenseAudit(supabase, {
      bookOwnerId,
      organizationId: bookProfile.organization_id,
      actorId: profile.id,
      action: "large_expense_alert",
      entityType: "transaction",
      entityId: data.id,
      detail: `${formatMoney(amount, bookProfile.currency)} exceeds the ${formatMoney(bookProfile.large_expense_threshold, bookProfile.currency)} alert threshold${partyName ? ` (${partyName})` : ""}`,
    });
  }

  return NextResponse.json({ ok: true, transaction: data }, { status: 201 });
}
