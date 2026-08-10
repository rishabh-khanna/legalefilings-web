import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { invoiceBalanceSign } from "@/lib/invoice-calc";

// GET /api/invoices/ledger?customerId=... — every invoice and every
// payment for one customer, in one chronological list with a running
// balance, rather than having to piece it together by scanning the full
// invoice list. A customer can pull their own; any staff/admin can pull
// any customer's — matches the existing invoice-list/customer-picker
// access, which already exposes every customer to every staff level
// (customers aren't part of the reporting-chain hierarchy that scopes
// staff-to-staff visibility elsewhere).
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId") ?? profile.id;
  if (customerId !== profile.id && !isStaffOrAdmin(profile)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: customer } = await supabase.from("profiles").select("full_name, company, organization_id").eq("id", customerId).single();
  if (customerId !== profile.id && customer && !canSeeAllOrgs(profile) && customer.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, invoice_type, total, status, created_at, invoice_payments(id, amount, payment_date, payment_mode, transaction_id)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });

  type Entry = { date: string; type: "invoice" | "payment"; label: string; debit: number; credit: number; invoiceId: string; invoiceNumber: string };
  const entries: Entry[] = [];
  for (const inv of invoices ?? []) {
    // invoice_type was selected here but never read, so every document
    // landed in the debit column — a credit note added to what the
    // customer owed instead of reducing it. Sign it properly, and skip
    // proforma entirely: a quotation isn't a receivable.
    const sign = invoiceBalanceSign(inv.invoice_type as string);
    if (sign === 0) continue;
    const amount = Number(inv.total);
    const isCredit = sign === -1;
    entries.push({
      date: inv.created_at,
      type: "invoice",
      label: `${isCredit ? "Credit Note" : "Invoice"} ${inv.invoice_number}`,
      debit: isCredit ? 0 : amount,
      credit: isCredit ? amount : 0,
      invoiceId: inv.id,
      invoiceNumber: inv.invoice_number,
    });
    for (const p of (inv.invoice_payments as { id: string; amount: number; payment_date: string; payment_mode: string; transaction_id: string | null }[]) ?? []) {
      entries.push({ date: p.payment_date, type: "payment", label: `Payment via ${p.payment_mode}${p.transaction_id ? ` (${p.transaction_id})` : ""}`, debit: 0, credit: Number(p.amount), invoiceId: inv.id, invoiceNumber: inv.invoice_number });
    }
  }
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = 0;
  const ledger = entries.map((e) => {
    running += e.debit - e.credit;
    return { ...e, balance: running };
  });

  return NextResponse.json({ customer, ledger, totalOutstanding: running });
}
