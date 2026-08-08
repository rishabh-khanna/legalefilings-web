import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { applyExpenseBalanceEffect, getBookAccess, hasPermission, logExpenseAudit } from "@/lib/expense-manager";

// POST /api/expense-manager/transactions/import-invoice — turns a paid
// Legal Efilings/tenant-org invoice into a real expense entry. The
// invoice supplies the amount/vendor/GST split; the caller still has to
// say which of *their own* bank accounts or cash it should be recorded
// against, since that's never been tracked anywhere (a customer's
// payment method for a Legal Efilings invoice — Razorpay, card, etc. —
// has no relationship to their own Business Finance bank accounts).
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { bookOwnerId: requestedBookOwnerId, invoiceId, categoryId, paymentMode, accountId } = body ?? {};
  const bookOwnerId = requestedBookOwnerId || profile.id;

  if (!invoiceId) return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  if (!["bank", "cash", "upi", "cheque", "card"].includes(String(paymentMode))) {
    return NextResponse.json({ error: "Invalid paymentMode" }, { status: 400 });
  }
  if (paymentMode !== "cash" && !accountId) {
    return NextResponse.json({ error: "accountId is required unless paymentMode is 'cash'" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "add_expense")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, subtotal, tax_amount, cgst_total, sgst_total, igst_total, paid_at, customer_id, status, organizations(name)")
    .eq("id", invoiceId)
    .single();
  if (!invoice || invoice.customer_id !== bookOwnerId || invoice.status !== "paid") {
    return NextResponse.json({ error: "Invoice not found or not payable to this book" }, { status: 404 });
  }

  const { data: bookProfile } = await supabase.from("expense_business_profiles").select("organization_id, approval_required").eq("customer_id", bookOwnerId).single();
  if (!bookProfile) return NextResponse.json({ error: "Business profile not found" }, { status: 404 });

  // Same approval rule as the normal add-expense path (transactions/
  // route.ts) — an employee's entry gets held for review when the book
  // owner requires it. Importing a paid invoice used to always post
  // straight through regardless of this setting, letting an employee
  // route around approval entirely by using this path instead of
  // entering the expense by hand.
  const needsApproval = bookProfile.approval_required && access.role === "employee";

  if (accountId) {
    const { data: account } = await supabase.from("expense_accounts").select("id").eq("id", accountId).eq("customer_id", bookOwnerId).single();
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const issuerName = (invoice.organizations as unknown as { name: string } | null)?.name ?? "Legal Efilings";

  const { data, error } = await supabase
    .from("expense_transactions")
    .insert({
      customer_id: bookOwnerId,
      organization_id: bookProfile.organization_id,
      transaction_type: "expense",
      transaction_date: (invoice.paid_at ?? new Date().toISOString()).slice(0, 10),
      category_id: categoryId || null,
      description: `Invoice ${invoice.invoice_number}`,
      amount: Number(invoice.total),
      payment_mode: paymentMode,
      account_id: paymentMode === "cash" ? null : accountId,
      party_name: issuerName,
      document_number: invoice.invoice_number,
      gst_applicable: Number(invoice.tax_amount) > 0,
      taxable_value: Number(invoice.subtotal),
      cgst: Number(invoice.cgst_total) || null,
      sgst: Number(invoice.sgst_total) || null,
      igst: Number(invoice.igst_total) || null,
      status: needsApproval ? "pending" : "approved",
      created_by: profile.id,
      linked_invoice_id: invoice.id,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "This invoice has already been imported." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // No-ops for a pending entry (applyExpenseBalanceEffect only acts on
  // 'approved' rows) — same as the normal add-expense path.
  await applyExpenseBalanceEffect(supabase, data, 1);
  await logExpenseAudit(supabase, {
    bookOwnerId,
    organizationId: bookProfile.organization_id,
    actorId: profile.id,
    action: "imported_invoice",
    entityType: "transaction",
    entityId: data.id,
    detail: `Invoice ${invoice.invoice_number} — ₹${Number(invoice.total).toLocaleString("en-IN")} (${issuerName})${needsApproval ? " (awaiting approval)" : ""}`,
  });

  return NextResponse.json({ ok: true, transaction: data }, { status: 201 });
}
