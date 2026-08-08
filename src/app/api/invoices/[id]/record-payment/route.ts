import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { loadInvoiceForStaffAccess } from "@/lib/organization";

// POST /api/invoices/[id]/record-payment — logs one payment (full or
// partial) against an invoice and recomputes status from the running
// total, rather than a single "mark paid" flag. Multiple partial
// payments accumulate; status becomes "paid" only once the sum reaches
// the invoice total (a few paise of rounding slack either way).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { amount, paymentMode, transactionId, paymentDate } = body ?? {};
  if (!amount || Number(amount) <= 0 || !paymentMode) {
    return NextResponse.json({ error: "amount and paymentMode are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const invoice = await loadInvoiceForStaffAccess(supabase, profile, id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const { error: paymentError } = await supabase.from("invoice_payments").insert({
    invoice_id: id,
    payment_date: paymentDate || new Date().toISOString().slice(0, 10),
    payment_mode: paymentMode,
    transaction_id: transactionId || null,
    amount: Number(amount),
    recorded_by: profile.id,
  });
  if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });

  const { data: payments } = await supabase.from("invoice_payments").select("amount").eq("invoice_id", id);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const status = totalPaid + 0.5 >= Number(invoice.total) ? "paid" : totalPaid > 0 ? "partially_paid" : "sent";

  const { data: updated, error } = await supabase
    .from("invoices")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("invoice_events").insert({
    invoice_id: id,
    event_type: "status_changed",
    actor_id: profile.id,
    detail: `Payment recorded: ₹${Number(amount).toLocaleString("en-IN")} via ${paymentMode}${transactionId ? ` (ref: ${transactionId})` : ""}`,
  });

  return NextResponse.json({ ok: true, invoice: updated, totalPaid });
}
