import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyPaymentSignature, getRazorpayPayment } from "@/lib/razorpay";
import { sendPaymentConfirmationEmail } from "@/lib/email";
import { logEmailFailure } from "@/lib/email-failures";

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
      "id, invoice_number, total, status, order_id, customer_id, organization_id, razorpay_order_id, orders(service, plan), profiles!invoices_customer_id_fkey(full_name)"
    )
    .eq("id", invoiceId)
    .single();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.razorpay_order_id !== orderId) {
    return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
  }

  // The webhook (durable backstop) can land before or after this call —
  // guard against both paths recording the same captured payment twice.
  const { data: alreadyRecorded } = await supabase
    .from("invoice_payments")
    .select("id")
    .eq("invoice_id", invoice.id)
    .eq("transaction_id", paymentId)
    .maybeSingle();

  if (invoice.status !== "paid" && !alreadyRecorded) {
    // Trust Razorpay's own record of what was captured, not the
    // invoice's full total — create-order now charges only the
    // remaining balance, so blindly writing invoice.total here would
    // silently overstate a partial payment as a full one.
    const payment = await getRazorpayPayment(paymentId);
    if (payment.order_id !== orderId) {
      return NextResponse.json({ error: "Payment/order mismatch" }, { status: 400 });
    }
    const amountPaid = payment.amount / 100;

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
    // 23505 = unique_violation on (invoice_id, transaction_id) — the
    // webhook won the race and already recorded this exact payment
    // between our own alreadyRecorded check and this insert. Not an
    // error: the invoice is correctly marked paid either way, and
    // re-sending the confirmation email below would be a real user-
    // facing duplicate, so stop here rather than continuing on to it.
    if (insertError) {
      if (insertError.code === "23505") return NextResponse.json({ ok: true });
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    await supabase.from("invoice_events").insert({
      invoice_id: invoice.id,
      event_type: "status_changed",
      detail: `${newStatus === "paid" ? "Paid" : "Partially paid"} via Razorpay — ₹${amountPaid.toLocaleString("en-IN")} (payment_id: ${paymentId})`,
    });
    if (invoice.order_id) {
      await supabase.from("orders").update({ status: "assigned" }).eq("id", invoice.order_id).eq("status", "new");
    }

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
      console.error("Failed to send payment confirmation email:", err);
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
