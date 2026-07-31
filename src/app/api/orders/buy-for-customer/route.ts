import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { sendPaymentRequestEmail } from "@/lib/email";
import { isStaffOrAdmin } from "@/lib/roles";

// POST /api/orders/buy-for-customer — a staff member starts an order on
// behalf of a customer (phone call, walk-in, etc.), which generates a
// draft order + a "sent" invoice, and emails the customer a link to
// review and pay. Any staff level can do this, not just admin — it's a
// day-to-day sales action, not a sensitive org-management one.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { customerId, service, plan, price, taxRate } = body ?? {};
  if (!customerId || !service || !plan || typeof price !== "number") {
    return NextResponse.json({ error: "customerId, service, plan, and price are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: customer } = await supabase.from("profiles").select("full_name").eq("id", customerId).eq("account_type", "customer").single();
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const { data: authUser } = await supabase.auth.admin.getUserById(customerId);
  const customerEmail = authUser?.user?.email;
  if (!customerEmail) return NextResponse.json({ error: "Customer has no email on file" }, { status: 400 });

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      service,
      plan,
      plan_price: price,
      status: "new",
      assigned_to: profile.id,
    })
    .select()
    .single();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  const subtotal = price;
  const taxAmount = Math.round(subtotal * ((taxRate ?? 18) / 100));
  const total = subtotal + taxAmount;
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      order_id: order.id,
      customer_id: customerId,
      created_by: profile.id,
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
  await supabase.from("invoice_events").insert({ invoice_id: invoice.id, event_type: "created", actor_id: profile.id });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://legalefilings-web.vercel.app";
  const paymentUrl = `${siteUrl}/pay/${invoice.id}`;

  let emailSent = true;
  try {
    await sendPaymentRequestEmail({
      customerName: customer.full_name ?? "there",
      customerEmail,
      service,
      plan,
      amount: total,
      paymentUrl,
    });
  } catch (err) {
    console.error("Failed to send payment request email:", err);
    emailSent = false;
  }

  return NextResponse.json({ ok: true, order, invoice, paymentUrl, emailSent }, { status: 201 });
}
