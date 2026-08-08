import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { loadInvoiceForStaffAccess } from "@/lib/organization";

// POST /api/invoices/[id]/mark-paid — one-click shortcut for "the full
// remaining balance just came in, I don't need to specify mode/reference".
// Records it as a real payment (mode "Other") so it still shows up in
// payment history and ageing, same as a detailed record-payment call —
// just with less typing for the common case. Same org + reporting-chain
// scoping as the invoices list.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const invoice = await loadInvoiceForStaffAccess(supabase, profile, id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const { data: payments } = await supabase.from("invoice_payments").select("amount").eq("invoice_id", id);
  const alreadyPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, Number(invoice.total) - alreadyPaid);
  if (remaining <= 0) return NextResponse.json({ error: "Invoice is already fully paid" }, { status: 400 });

  await supabase.from("invoice_payments").insert({
    invoice_id: id,
    payment_mode: "Other",
    amount: remaining,
    recorded_by: profile.id,
  });

  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("invoice_events").insert({ invoice_id: id, event_type: "status_changed", actor_id: profile.id, detail: "marked paid (full balance)" });

  return NextResponse.json({ ok: true, invoice: data });
}
