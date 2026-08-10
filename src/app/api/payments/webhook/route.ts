import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { sendPaymentConfirmationEmail } from "@/lib/email";
import { logEmailFailure } from "@/lib/email-failures";

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
    .select(
      "id, invoice_number, status, order_id, total, customer_id, organization_id, orders(service, plan), profiles!invoices_customer_id_fkey(full_name)"
    )
    .eq("razorpay_order_id", orderId)
    .maybeSingle();

  if (!invoice) return NextResponse.json({ ok: true, unmatched: true });

  // /api/payments/verify is the common path (browser still open) and
  // already records this same payment — if it beat the webhook here,
  // don't double-count it. Matching on transaction_id is exact and
  // avoids relying on timing between the two paths.
  const { data: alreadyRecorded } = await supabase
    .from("invoice_payments")
    .select("id")
    .eq("invoice_id", invoice.id)
    .eq("transaction_id", paymentId)
    .maybeSingle();

  if (invoice.status !== "paid" && !alreadyRecorded) {
    // payment.amount (paise) is part of the signed webhook payload —
    // authoritative for what was actually captured, same reasoning as
    // /api/payments/verify fetching it from Razorpay directly. Never
    // assume it equals the invoice's full total (create-order only ever
    // charges the remaining balance, not the original amount).
    const amountPaid = Number(payment.amount) / 100;

    const { data: existingPayments } = await supabase.from("invoice_payments").select("amount").eq("invoice_id", invoice.id);
    const totalPaid = (existingPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0) + amountPaid;
    const newStatus = totalPaid + 0.5 >= Number(invoice.total) ? "paid" : "partially_paid";

    await supabase
      .from("invoices")
      .update({
        status: newStatus,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
        razorpay_payment_id: paymentId,
        payment_method: "razorpay",
      })
      .eq("id", invoice.id);
    const { error: insertError } = await supabase.from("invoice_payments").insert({
      invoice_id: invoice.id,
      payment_mode: "Razorpay",
      transaction_id: paymentId,
      amount: amountPaid,
    });
    // 23505 = unique_violation on (invoice_id, transaction_id) — /verify
    // won the race and already recorded this exact payment between our
    // own alreadyRecorded check and this insert. The invoice is already
    // correctly marked paid; nothing further to do.
    if (insertError) {
      if (insertError.code === "23505") return NextResponse.json({ ok: true });
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    await supabase.from("invoice_events").insert({
      invoice_id: invoice.id,
      event_type: "status_changed",
      detail: `${newStatus === "paid" ? "Paid" : "Partially paid"} via Razorpay webhook — ₹${amountPaid.toLocaleString("en-IN")} (payment_id: ${paymentId})`,
    });
    if (invoice.order_id) {
      await supabase.from("orders").update({ status: "assigned" }).eq("id", invoice.order_id).eq("status", "new");
    }

    // The receipt. /api/payments/verify sends this on the common path
    // (browser still open); this route is the backstop for when it
    // isn't — which meant the one customer who lost their connection
    // mid-payment was charged and told nothing. The 23505 guard above
    // already returned early if /verify beat us here, so reaching this
    // point means we recorded the payment and we owe the email.
    const { data: authUser } = await supabase.auth.admin.getUserById(invoice.customer_id);
    const customerEmail = authUser?.user?.email;
    try {
      const orderInfo = invoice.orders as unknown as { service: string; plan: string } | null;
      if (customerEmail) {
        const { data: org } = await supabase.from("organizations").select("name").eq("id", invoice.organization_id).single();
        await sendPaymentConfirmationEmail({
          customerName: (invoice.profiles as unknown as { full_name: string } | null)?.full_name ?? "there",
          customerEmail,
          invoiceNumber: invoice.invoice_number,
          service: orderInfo?.service ?? "your order",
          plan: orderInfo?.plan ?? "",
          orgName: org?.name,
          amount: amountPaid,
          paymentId,
        });
      }
    } catch (err) {
      console.error("Failed to send payment confirmation email (webhook):", err);
      await logEmailFailure(supabase, {
        emailType: "payment_confirmation",
        recipientEmail: customerEmail ?? "unknown",
        relatedEntity: `invoice:${invoice.id}`,
        errorMessage: err instanceof Error ? err.message : String(err),
        organizationId: invoice.organization_id,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
