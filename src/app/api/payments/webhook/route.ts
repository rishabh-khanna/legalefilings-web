import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyWebhookSignature } from "@/lib/razorpay";

// POST /api/payments/webhook — configured in the Razorpay dashboard
// (Settings → Webhooks) pointing at this URL, subscribed to
// "payment.captured". This is the durable path for marking an invoice
// paid — /api/payments/verify covers the common case (browser still open
// after payment), this covers the rest (tab closed, network drop, retry).
// Idempotent by design: re-marking an already-paid invoice is a no-op.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  if (event.event !== "payment.captured") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const payment = event.payload?.payment?.entity;
  const orderId = payment?.order_id;
  const paymentId = payment?.id;
  if (!orderId || !paymentId) {
    return NextResponse.json({ error: "Malformed webhook payload" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, order_id")
    .eq("razorpay_order_id", orderId)
    .maybeSingle();

  if (!invoice) return NextResponse.json({ ok: true, unmatched: true });

  if (invoice.status !== "paid") {
    await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString(), razorpay_payment_id: paymentId, payment_method: "razorpay" })
      .eq("id", invoice.id);
    await supabase.from("invoice_events").insert({
      invoice_id: invoice.id,
      event_type: "status_changed",
      detail: `Paid via Razorpay webhook (payment_id: ${paymentId})`,
    });
    if (invoice.order_id) {
      await supabase.from("orders").update({ status: "assigned" }).eq("id", invoice.order_id).eq("status", "new");
    }
  }

  return NextResponse.json({ ok: true });
}
