import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { sendPaymentRequestEmail } from "@/lib/email";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { createOrderInvoice } from "@/lib/order-invoice";
import { logEmailFailure } from "@/lib/email-failures";
import { getMissingBusinessSettingsFields } from "@/lib/business-settings-completeness";
import { SITE_URL } from "@/config/site";

// POST /api/orders/buy-for-customer — a staff member starts an order on
// behalf of a customer (phone call, walk-in, etc.), which generates a
// draft order + a "sent" invoice (an Order Invoice — always order-linked,
// distinct from the ad-hoc CRM invoice wizard), and emails the customer a
// link to review and pay. Any staff level can do this, not just admin —
// it's a day-to-day sales action, not a sensitive org-management one.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { customerId, service, plan, price, taxRate } = body ?? {};
  if (!customerId || !service || !plan || typeof price !== "number") {
    return NextResponse.json({ error: "customerId, service, plan, and price are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: customer } = await supabase.from("profiles").select("full_name, organization_id").eq("id", customerId).eq("account_type", "customer").single();
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (!canSeeAllOrgs(profile) && customer.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Staff-initiated invoicing is blocked until the org's Business Settings
  // is complete — an invoice with no address/GSTIN/PAN/state/payment
  // method on it isn't something the business can actually send. Public
  // self-checkout (/api/payments/checkout) deliberately does NOT have
  // this gate — blocking a customer's own purchase because the org
  // admin hasn't finished a settings page yet would be a confusing,
  // wrong-actor failure for them to hit.
  const { data: businessSettings } = await supabase
    .from("company_settings")
    .select("address, gst_number, pan_number, state, bank_name, bank_account_number, bank_ifsc, upi_id")
    .eq("organization_id", customer.organization_id)
    .maybeSingle();
  const missingSettings = getMissingBusinessSettingsFields(businessSettings);
  if (missingSettings.length > 0) {
    return NextResponse.json(
      { error: `Business Settings is incomplete — missing ${missingSettings.join(", ")}. Complete it before generating invoices.` },
      { status: 400 }
    );
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(customerId);
  const customerEmail = authUser?.user?.email;
  if (!customerEmail) return NextResponse.json({ error: "Customer has no email on file" }, { status: 400 });

  // Double-submit guard (double-click, retry after a slow response) — not
  // a blanket "reuse any unpaid order for this service/plan" the way
  // public checkout does, since staff genuinely might sell the same
  // customer the same plan twice in one day (e.g. two separate GST
  // registrations). Narrowly targets only an exact duplicate — same
  // customer/service/plan/price/staff member — created in the last
  // minute, which a real second sale would essentially never match.
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { data: recentDuplicate } = await supabase
    .from("orders")
    .select("id")
    .eq("customer_id", customerId)
    .eq("service", service)
    .eq("plan", plan)
    .eq("plan_price", price)
    .eq("assigned_to", profile.id)
    .eq("status", "new")
    .gte("created_at", oneMinuteAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let orderId: string;
  let invoice: Awaited<ReturnType<typeof createOrderInvoice>>;
  let reused = false;
  const reusedInvoice = recentDuplicate
    ? (await supabase.from("invoices").select("*").eq("order_id", recentDuplicate.id).in("status", ["draft", "sent"]).order("created_at", { ascending: false }).limit(1).maybeSingle()).data
    : null;

  if (recentDuplicate && reusedInvoice) {
    orderId = recentDuplicate.id;
    invoice = reusedInvoice;
    reused = true;
  } else {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        organization_id: customer.organization_id,
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
    orderId = order.id;

    invoice = await createOrderInvoice({
      organizationId: customer.organization_id,
      orderId,
      customerId,
      service,
      plan,
      price,
      taxRatePercent: typeof taxRate === "number" ? taxRate : undefined,
      createdBy: profile.id,
    });
    await supabase.from("invoice_events").insert({ invoice_id: invoice.id, event_type: "created", actor_id: profile.id });
  }

  const paymentUrl = `${SITE_URL}/pay/${invoice.id}`;

  // A duplicate submission reusing the same order shouldn't re-send the
  // payment-request email a second time within the same minute.
  let emailSent = true;
  if (!reused) {
    try {
      const { data: org } = await supabase.from("organizations").select("name").eq("id", customer.organization_id).single();
      await sendPaymentRequestEmail({
        customerName: customer.full_name ?? "there",
        customerEmail,
        service,
        plan,
        amount: Number(invoice.total),
        paymentUrl,
        orgName: org?.name,
      });
    } catch (err) {
      console.error("Failed to send payment request email:", err);
      emailSent = false;
      await logEmailFailure(supabase, {
        emailType: "payment_request",
        recipientEmail: customerEmail,
        relatedEntity: `invoice:${invoice.id}`,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const { data: orderRow } = await supabase.from("orders").select("*").eq("id", orderId).single();
  return NextResponse.json({ ok: true, order: orderRow, invoice, paymentUrl, emailSent }, { status: 201 });
}
