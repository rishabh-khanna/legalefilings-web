import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { sendPaymentConfirmationEmail } from "@/lib/email";

// POST /api/payments/verify — called from the browser right after
// Razorpay Checkout's success handler fires. Confirms the payment via
// HMAC signature (so a client can't just POST a fake "it worked") and
// marks the invoice paid. The webhook route is the durable backstop for
// this same effect in case the browser closes before this call lands.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { invoiceId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body ?? {};
  if (!invoiceId || !orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "Missing payment verification fields" }, { status: 400 });
  }

  if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, total, status, order_id, customer_id, razorpay_order_id, orders(service, plan), profiles!invoices_customer_id_fkey(full_name)"
    )
    .eq("id", invoiceId)
    .single();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.razorpay_order_id !== orderId) {
    return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
  }

  if (invoice.status !== "paid") {
    await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString(), razorpay_payment_id: paymentId, payment_method: "razorpay" })
      .eq("id", invoice.id);
    await supabase.from("invoice_events").insert({
      invoice_id: invoice.id,
      event_type: "status_changed",
      detail: `Paid via Razorpay (payment_id: ${paymentId})`,
    });
    if (invoice.order_id) {
      await supabase.from("orders").update({ status: "assigned" }).eq("id", invoice.order_id).eq("status", "new");
    }

    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(invoice.customer_id);
      const customerEmail = authUser?.user?.email;
      const orderInfo = invoice.orders as unknown as { service: string; plan: string } | null;
      if (customerEmail) {
        await sendPaymentConfirmationEmail({
          customerName: (invoice.profiles as unknown as { full_name: string } | null)?.full_name ?? "there",
          customerEmail,
          invoiceNumber: invoice.invoice_number,
          service: orderInfo?.service ?? "your order",
          plan: orderInfo?.plan ?? "",
          amount: Number(invoice.total),
          paymentId,
        });
      }
    } catch (err) {
      console.error("Failed to send payment confirmation email:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
