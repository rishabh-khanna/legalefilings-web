import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createRazorpayOrder, listCapturedPaymentsForOrder } from "@/lib/razorpay";
import { generateTempPassword } from "@/lib/admin-actions";
import { sendAccountCreatedEmail } from "@/lib/email";
import { createOrderInvoice } from "@/lib/order-invoice";
import { resolveTrustedPrice } from "@/lib/trusted-pricing";
import { logEmailFailure } from "@/lib/email-failures";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

// POST /api/payments/checkout — a customer buying a service directly from
// a pricing card (no admin/staff involved). Gets-or-creates the customer's
// account by email (magiclink generation both creates the auth user if
// they're new and resolves to the existing one if they're not — there's
// no admin.getUserByEmail in the JS client), then creates the usual
// order + invoice + line item, and starts a Razorpay order for it.
export async function POST(request: Request) {
  if (isRateLimited(`checkout:${getClientIp(request)}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts — please wait a few minutes and try again." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const { fullName, email, phone, service, plan } = body ?? {};
  if (!fullName || !email || !phone || !service || !plan) {
    return NextResponse.json({ error: "fullName, email, phone, service, and plan are required" }, { status: 400 });
  }

  // The client's own price is never trusted here — it's a display
  // artifact parsed from the pricing card, and a POST can claim any
  // number it likes. Re-derive the real price server-side from the
  // exact same pricing-card content the customer actually saw.
  const price = resolveTrustedPrice(String(service), String(plan));
  if (price === null || price <= 0) {
    return NextResponse.json({ error: "Could not find pricing for that service/plan" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: String(email),
  });
  if (linkError || !linkData.user) {
    return NextResponse.json({ error: linkError?.message ?? "Failed to resolve account" }, { status: 500 });
  }
  const customerId = linkData.user.id;

  const { data: existingProfile } = await supabase.from("profiles").select("id, organization_id").eq("id", customerId).maybeSingle();

  // Public, unauthenticated checkout — always Legal Efilings' own
  // storefront (this is legalefilings.com's own pricing-card checkout;
  // a tenant org getting its own public checkout is a separate, later
  // feature). A returning customer keeps whatever org they already
  // belong to rather than being reassigned.
  const { data: legalEfilingsOrg } = await supabase.from("organizations").select("id").eq("slug", "legal-efilings").single();
  const organizationId = existingProfile?.organization_id ?? legalEfilingsOrg?.id;
  if (!organizationId) return NextResponse.json({ error: "Could not resolve organization" }, { status: 500 });

  let newAccountPassword: string | null = null;
  if (!existingProfile) {
    newAccountPassword = generateTempPassword();
    const { error: pwError } = await supabase.auth.admin.updateUserById(customerId, {
      password: newAccountPassword,
      email_confirm: true,
    });
    if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 });

    const { error: profileError } = await supabase.from("profiles").insert({
      id: customerId,
      organization_id: organizationId,
      full_name: String(fullName),
      phone: String(phone),
      account_type: "customer",
      customer_tier: "free",
      crm_status: "active",
    });
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Idempotency: a customer who dismisses the Razorpay popup (closed it,
  // changed their mind about the browser tab, flaky network) and then
  // clicks "Continue to Payment" again used to get a brand-new order +
  // invoice every single time — nothing here ever reused the one
  // already sitting unpaid from the previous attempt. Reuse that
  // existing order+invoice instead of creating another one, so retrying
  // checkout never produces duplicate "ghost" orders in Order History.
  let orderId: string;
  let invoice: Awaited<ReturnType<typeof createOrderInvoice>>;
  const { data: reusableOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("customer_id", customerId)
    .eq("service", String(service))
    .eq("plan", String(plan))
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: reusableInvoice } = reusableOrder
    ? await supabase.from("invoices").select("*").eq("order_id", reusableOrder.id).in("status", ["draft", "sent"]).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  if (reusableOrder && reusableInvoice) {
    orderId = reusableOrder.id;
    invoice = reusableInvoice;

    // Same double-charge guard /api/payments/create-order already has,
    // and checkout was missing entirely.
    //
    // Reusing an unpaid order is what stops duplicate "ghost" orders,
    // but there is a window where the customer HAS paid and we don't
    // know yet: Razorpay captured it, the browser closed before /verify
    // ran, and the webhook hasn't landed. The invoice is still 'sent',
    // so the reuse above matches it, and we would open a second
    // Razorpay order for money already taken. Ask Razorpay directly
    // rather than trusting our own not-yet-updated rows.
    if (reusableInvoice.razorpay_order_id) {
      const captured = await listCapturedPaymentsForOrder(reusableInvoice.razorpay_order_id as string).catch(() => []);
      for (const payment of captured) {
        const { data: already } = await supabase
          .from("invoice_payments")
          .select("id")
          .eq("invoice_id", reusableInvoice.id)
          .eq("transaction_id", payment.id)
          .maybeSingle();
        if (already) continue;
        const amountPaid = payment.amount / 100;
        const { data: existingPayments } = await supabase.from("invoice_payments").select("amount").eq("invoice_id", reusableInvoice.id);
        const totalPaidSoFar = (existingPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0) + amountPaid;
        const newStatus = totalPaidSoFar + 0.5 >= Number(reusableInvoice.total) ? "paid" : "partially_paid";
        await supabase
          .from("invoices")
          .update({ status: newStatus, paid_at: newStatus === "paid" ? new Date().toISOString() : null, razorpay_payment_id: payment.id, payment_method: "razorpay" })
          .eq("id", reusableInvoice.id);
        const { error: insertError } = await supabase
          .from("invoice_payments")
          .insert({ invoice_id: reusableInvoice.id, payment_mode: "Razorpay", transaction_id: payment.id, amount: amountPaid });
        // 23505 = /verify or the webhook recorded this same payment
        // between our check and this insert — already handled, not an error.
        if (insertError && insertError.code !== "23505") {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
        await supabase.from("invoice_events").insert({
          invoice_id: reusableInvoice.id,
          event_type: "status_changed",
          detail: `Payment reconciled at checkout — ₹${amountPaid.toLocaleString("en-IN")} (payment_id: ${payment.id})`,
        });
      }

      // Re-read: if catching up settled it, this invoice must not be
      // presented for payment again.
      const { data: refreshed } = await supabase.from("invoices").select("status").eq("id", reusableInvoice.id).single();
      if (refreshed?.status === "paid") {
        return NextResponse.json(
          { error: "This order has already been paid — check your email for the confirmation.", alreadyPaid: true },
          { status: 409 }
        );
      }
    }
  } else {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({ organization_id: organizationId, customer_id: customerId, service: String(service), plan: String(plan), plan_price: price, status: "new" })
      .select()
      .single();
    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
    orderId = order.id;

    // taxRatePercent is deliberately never taken from the client here —
    // same reasoning as the price fix above: a public POST could claim
    // any rate (including 0) to shrink the GST portion of the total.
    // The one legitimate caller (PaymentModal.tsx) never sends a custom
    // rate anyway, so this always defaults to createOrderInvoice's
    // standard 18%.
    invoice = await createOrderInvoice({
      organizationId,
      orderId,
      customerId,
      service: String(service),
      plan: String(plan),
      price,
    });
    await supabase.from("invoice_events").insert({ invoice_id: invoice.id, event_type: "created", detail: "Direct checkout" });
  }

  try {
    const rzpOrder = await createRazorpayOrder({
      amountInRupees: Number(invoice.total),
      receipt: invoice.invoice_number,
      notes: { invoiceId: invoice.id },
    });
    await supabase.from("invoices").update({ razorpay_order_id: rzpOrder.id }).eq("id", invoice.id);

    if (newAccountPassword) {
      try {
        await sendAccountCreatedEmail({ customerName: String(fullName), customerEmail: String(email), tempPassword: newAccountPassword });
      } catch (err) {
        console.error("Failed to send account-created email:", err);
        // Deliberately not logging the temp password itself — storing a
        // plaintext credential in a log table just to make a resend
        // possible would be a worse security tradeoff than the customer
        // needing a "forgot password" reset instead.
        await logEmailFailure(supabase, {
          emailType: "account_created",
          recipientEmail: String(email),
          relatedEntity: `profile:${customerId}`,
          errorMessage: err instanceof Error ? err.message : String(err),
          organizationId,
        });
      }
    }

    return NextResponse.json({
      invoiceId: invoice.id,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      invoiceNumber: invoice.invoice_number,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start payment" }, { status: 500 });
  }
}
