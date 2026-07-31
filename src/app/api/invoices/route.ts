import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";

type LineItemInput = { description: string; quantity: number; unitPrice: number };

// POST /api/invoices — quick invoice generator (staff/admin). Accepts a
// customer + a handful of ad hoc line items — no existing order required,
// so staff can invoice for something that didn't originate as a tracked
// order. order_id is optional for exactly this reason (see migration
// 20260731000000). Logs a 'created' event for the audit trail.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { customerId, orderId, items, taxRate } = body as { customerId?: string; orderId?: string; items?: LineItemInput[]; taxRate?: number };
  if (!customerId || !items || items.length === 0) {
    return NextResponse.json({ error: "customerId and at least one line item are required" }, { status: 400 });
  }

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxAmount = Math.round(subtotal * ((taxRate ?? 18) / 100));
  const total = subtotal + taxAmount;
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;

  const supabase = getSupabaseAdmin();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      order_id: orderId ?? null,
      customer_id: customerId,
      subtotal,
      tax_amount: taxAmount,
      total,
      status: "draft",
      issued_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("invoice_line_items").insert(
    items.map((i) => ({
      invoice_id: invoice.id,
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      amount: i.quantity * i.unitPrice,
    }))
  );

  await supabase.from("invoice_events").insert({ invoice_id: invoice.id, event_type: "created", actor_id: profile.id });

  return NextResponse.json({ ok: true, invoice }, { status: 201 });
}
