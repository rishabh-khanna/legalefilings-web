import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createRazorpayOrder } from "@/lib/razorpay";

// POST /api/payments/create-order — starts a Razorpay order for an
// existing invoice. Public by design: the invoice's own UUID is the
// access token, same trust model as /pay/[id] itself (unguessable link,
// no login required so a customer can pay straight from an email).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const invoiceId = body?.invoiceId;
  if (!invoiceId || typeof invoiceId !== "string") {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, status, customer_id, profiles!invoices_customer_id_fkey(full_name)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "paid") return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
  if (invoice.status === "cancelled") return NextResponse.json({ error: "Invoice is cancelled" }, { status: 400 });

  try {
    const order = await createRazorpayOrder({
      amountInRupees: Number(invoice.total),
      receipt: invoice.invoice_number,
      notes: { invoiceId: invoice.id },
    });

    await supabase.from("invoices").update({ razorpay_order_id: order.id }).eq("id", invoice.id);

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      invoiceNumber: invoice.invoice_number,
      customerName: (invoice.profiles as unknown as { full_name: string } | null)?.full_name ?? "",
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start payment" }, { status: 500 });
  }
}
