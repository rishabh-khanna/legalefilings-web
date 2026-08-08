import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createRazorpayOrder, listCapturedPaymentsForOrder } from "@/lib/razorpay";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

// POST /api/payments/create-order — starts a Razorpay order for an
// existing invoice. Public by design: the invoice's own UUID is the
// access token, same trust model as /pay/[id] itself (unguessable link,
// no login required so a customer can pay straight from an email).
export async function POST(request: Request) {
  if (isRateLimited(`create-order:${getClientIp(request)}`, 15, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts — please wait a few minutes and try again." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const invoiceId = body?.invoiceId;
  if (!invoiceId || typeof invoiceId !== "string") {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, status, customer_id, order_id, razorpay_order_id, profiles!invoices_customer_id_fkey(full_name)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  // shouldReload tells the client this isn't a normal "something went
  // wrong, let the customer retry" error — the invoice's real status
  // just changed underneath a stale page. Without it, PayNowButton only
  // shows this as inline error text while the page above still displays
  // the old "Awaiting Payment" screen with a live Pay Now button, which
  // reads as contradictory/confusing rather than telling the customer
  // what actually happened.
  if (invoice.status === "paid") return NextResponse.json({ error: "Invoice is already paid", shouldReload: true }, { status: 400 });
  if (invoice.status === "cancelled") return NextResponse.json({ error: "Invoice is cancelled", shouldReload: true }, { status: 400 });

  // Close the double-charge window: a customer who paid, then closed the
  // tab before /api/payments/verify's fetch landed (and before the
  // webhook caught up), would otherwise see "Awaiting Payment" again on
  // /pay/[id] and start a genuine second charge by clicking Pay Now.
  // Ask Razorpay itself — not our own not-yet-updated invoice_payments
  // rows — whether the PREVIOUS order on this invoice was actually paid,
  // and catch this one up before ever starting a new one.
  if (invoice.razorpay_order_id) {
    const captured = await listCapturedPaymentsForOrder(invoice.razorpay_order_id).catch(() => []);
    for (const payment of captured) {
      const { data: already } = await supabase.from("invoice_payments").select("id").eq("invoice_id", invoice.id).eq("transaction_id", payment.id).maybeSingle();
      if (already) continue;
      const amountPaid = payment.amount / 100;
      const { data: existingPayments } = await supabase.from("invoice_payments").select("amount").eq("invoice_id", invoice.id);
      const totalPaidSoFar = (existingPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0) + amountPaid;
      const newStatus = totalPaidSoFar + 0.5 >= Number(invoice.total) ? "paid" : "partially_paid";
      await supabase
        .from("invoices")
        .update({ status: newStatus, paid_at: newStatus === "paid" ? new Date().toISOString() : null, razorpay_payment_id: payment.id, payment_method: "razorpay" })
        .eq("id", invoice.id);
      const { error: insertError } = await supabase.from("invoice_payments").insert({ invoice_id: invoice.id, payment_mode: "Razorpay", transaction_id: payment.id, amount: amountPaid });
      // 23505 = unique_violation on (invoice_id, transaction_id) — /verify
      // or the webhook won the race for this exact payment between our
      // own `already` check and this insert. The invoice is already
      // correctly marked paid; move on to the next captured payment (if
      // any) rather than double-recording this one.
      if (insertError) {
        if (insertError.code === "23505") continue;
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      await supabase.from("invoice_events").insert({
        invoice_id: invoice.id,
        event_type: "status_changed",
        detail: `${newStatus === "paid" ? "Paid" : "Partially paid"} via Razorpay — ₹${amountPaid.toLocaleString("en-IN")} (payment_id: ${payment.id}, caught up by create-order)`,
      });
      if (invoice.order_id) {
        await supabase.from("orders").update({ status: "assigned" }).eq("id", invoice.order_id).eq("status", "new");
      }
    }
    // Re-read — the loop above may have just marked this invoice paid.
    const { data: refreshed } = await supabase.from("invoices").select("status").eq("id", invoice.id).single();
    if (refreshed?.status === "paid") return NextResponse.json({ error: "Invoice is already paid", shouldReload: true }, { status: 400 });
  }

  // Charge what's actually still owed, not the invoice's full original
  // total — a customer who already made a partial payment (recorded by
  // staff, e.g. cash) would otherwise pay the entire amount again here.
  const { data: payments } = await supabase.from("invoice_payments").select("amount").eq("invoice_id", invoice.id);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const balanceDue = Number(invoice.total) - totalPaid;
  if (balanceDue <= 0.5) return NextResponse.json({ error: "Invoice is already paid", shouldReload: true }, { status: 400 });

  try {
    const order = await createRazorpayOrder({
      amountInRupees: balanceDue,
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
