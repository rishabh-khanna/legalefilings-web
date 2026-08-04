import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createRazorpayOrder } from "@/lib/razorpay";
import { generateTempPassword } from "@/lib/admin-actions";
import { sendAccountCreatedEmail } from "@/lib/email";

// POST /api/payments/checkout — a customer buying a service directly from
// a pricing card (no admin/staff involved). Gets-or-creates the customer's
// account by email (magiclink generation both creates the auth user if
// they're new and resolves to the existing one if they're not — there's
// no admin.getUserByEmail in the JS client), then creates the usual
// order + invoice + line item, and starts a Razorpay order for it.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { fullName, email, phone, service, plan, price, taxRate } = body ?? {};
  if (!fullName || !email || !phone || !service || !plan || typeof price !== "number" || price <= 0) {
    return NextResponse.json({ error: "fullName, email, phone, service, plan, and a positive price are required" }, { status: 400 });
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

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", customerId).maybeSingle();

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
      full_name: String(fullName),
      phone: String(phone),
      account_type: "customer",
      customer_tier: "free",
      crm_status: "active",
    });
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ customer_id: customerId, service: String(service), plan: String(plan), plan_price: price, status: "new" })
    .select()
    .single();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  const subtotal = price;
  const taxAmount = Math.round(subtotal * ((typeof taxRate === "number" ? taxRate : 18) / 100));
  const total = subtotal + taxAmount;
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      order_id: order.id,
      customer_id: customerId,
      subtotal,
      tax_amount: taxAmount,
      total,
      status: "sent",
      issued_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 500 });

  await supabase.from("invoice_line_items").insert({
    invoice_id: invoice.id,
    description: `${service} — ${plan}`,
    quantity: 1,
    unit_price: price,
    amount: price,
  });
  await supabase.from("invoice_events").insert({ invoice_id: invoice.id, event_type: "created", detail: "Direct checkout" });

  try {
    const rzpOrder = await createRazorpayOrder({
      amountInRupees: total,
      receipt: invoiceNumber,
      notes: { invoiceId: invoice.id },
    });
    await supabase.from("invoices").update({ razorpay_order_id: rzpOrder.id }).eq("id", invoice.id);

    if (newAccountPassword) {
      try {
        await sendAccountCreatedEmail({ customerName: String(fullName), customerEmail: String(email), tempPassword: newAccountPassword });
      } catch (err) {
        console.error("Failed to send account-created email:", err);
      }
    }

    return NextResponse.json({
      invoiceId: invoice.id,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      invoiceNumber,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start payment" }, { status: 500 });
  }
}
