import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";

type LineItemInput = { description: string; quantity: number; unitPrice: number };

// GET /api/invoices — a customer sees their own; a rater sees only
// invoices they created; a leader/group_leader sees their own plus their
// reporting chain's; admin sees everything.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("invoices")
    .select("*, profiles!invoices_customer_id_fkey(full_name)")
    .order("created_at", { ascending: false });

  if (profile.account_type === "customer") {
    query = query.eq("customer_id", profile.id);
  } else if (profile.account_type !== "admin") {
    const chain = await getReportingChainIds(profile.id);
    query = query.in("created_by", [profile.id, ...chain]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data });
}

// POST /api/invoices — quick invoice generator. Staff/admin can invoice
// any customer; a paid customer can generate one for themselves (free
// tier can't — this is a perk of upgrading, not a general self-serve
// billing tool). Accepts a handful of ad hoc line items — no existing
// order required, so this covers something that didn't originate as a
// tracked order. order_id is optional for exactly this reason (see
// migration 20260731000000). Logs a 'created' event for the audit trail.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isSelfServePaidCustomer = profile.account_type === "customer" && profile.customer_tier === "paid";
  if (!isStaffOrAdmin(profile) && !isSelfServePaidCustomer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // A customer can only ever invoice themselves — the customerId they
  // send (if any) is ignored, not just validated, so there's no path
  // where a paid customer can end up generating an invoice for someone
  // else's account.
  const customerId = isSelfServePaidCustomer ? profile.id : (body as { customerId?: string }).customerId;
  const { orderId, items, taxRate } = body as { orderId?: string; items?: LineItemInput[]; taxRate?: number };
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
      created_by: profile.id,
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
