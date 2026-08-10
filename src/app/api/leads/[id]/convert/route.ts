import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { canSeeAllOrgs } from "@/lib/organization";
import { createOrderInvoice } from "@/lib/order-invoice";
import { generateTempPassword } from "@/lib/admin-actions";
import { sendAccountCreatedEmail, sendPaymentRequestEmail } from "@/lib/email";
import { logEmailFailure } from "@/lib/email-failures";
import { getMissingBusinessSettingsFields } from "@/lib/business-settings-completeness";
import { SITE_URL } from "@/config/site";

// ₹1,999 → 1999 — same parser used everywhere else a displayed price
// string needs to become a real number (PaymentModal.tsx, trusted-pricing.ts).
function parsePrice(price: string): number {
  const digits = price.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

// POST /api/leads/[id]/convert — staff/admin only. The missing other
// half of "mark a lead Won": leads.converted_to_profile_id has existed
// since the original schema but nothing ever wrote to it — marking a
// lead Won only ever changed its own status, with no actual customer
// account or order ever created from it. This is that action: get-or-
// create the customer account (by the lead's own email, reusing an
// existing one if they've bought before), create a real order + invoice
// against it (defaulting to the lead's own captured service/plan/price,
// overridable in the request body), email them a payment link, and mark
// the lead converted with a real link to both the account and the order.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!canSeeAllOrgs(profile) && lead.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
    const chain = await getReportingChainIds(profile.id);
    // assigned_to is a profiles FK now (20260829000000). NULL means the
    // lead is still in the shared unclaimed pool, which anyone who can
    // see it may convert — same rule the list and claim paths use.
    const visibleIds = [profile.id, ...chain];
    if (lead.assigned_to && !visibleIds.includes(lead.assigned_to)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (lead.converted_to_profile_id) {
    return NextResponse.json({ error: "This lead has already been converted." }, { status: 409 });
  }

  // Same Business Settings gate as buy-for-customer — converting a lead
  // always creates a real order + invoice, so it needs the same
  // completeness check. Checked before any account/order is created, so
  // a blocked conversion has zero side effects to clean up.
  const { data: businessSettings } = await supabase
    .from("company_settings")
    .select("address, gst_number, pan_number, state, bank_name, bank_account_number, bank_ifsc, upi_id")
    .eq("organization_id", lead.organization_id)
    .maybeSingle();
  const missingSettings = getMissingBusinessSettingsFields(businessSettings);
  if (missingSettings.length > 0) {
    return NextResponse.json(
      { error: `Business Settings is incomplete — missing ${missingSettings.join(", ")}. Complete it before converting leads to orders.` },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const service = typeof body?.service === "string" && body.service ? body.service : lead.service;
  const plan = typeof body?.plan === "string" && body.plan ? body.plan : lead.plan;
  const price = typeof body?.price === "number" && body.price > 0 ? body.price : parsePrice(lead.plan_price ?? "");
  if (!service || !plan || !price) {
    return NextResponse.json({ error: "This lead is missing service/plan/price — provide them to convert." }, { status: 400 });
  }

  // Get-or-create the customer account by email — same magiclink trick
  // /api/payments/checkout uses (there's no admin.getUserByEmail in the
  // JS client; generateLink resolves to the existing user if one exists,
  // or creates one, in a single call).
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: lead.email });
  if (linkError || !linkData.user) {
    return NextResponse.json({ error: linkError?.message ?? "Failed to resolve customer account" }, { status: 500 });
  }
  const customerId = linkData.user.id;
  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", customerId).maybeSingle();

  let newAccountPassword: string | null = null;
  if (!existingProfile) {
    newAccountPassword = generateTempPassword();
    const { error: pwError } = await supabase.auth.admin.updateUserById(customerId, { password: newAccountPassword, email_confirm: true });
    if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 });
    const { error: profileError } = await supabase.from("profiles").insert({
      id: customerId,
      organization_id: lead.organization_id,
      full_name: lead.name,
      phone: lead.phone,
      city: lead.city,
      state: lead.state,
      account_type: "customer",
      customer_tier: "free",
      crm_status: "active",
    });
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      organization_id: lead.organization_id,
      customer_id: customerId,
      lead_id: lead.id,
      service,
      plan,
      plan_price: price,
      status: "new",
      assigned_to: profile.id,
    })
    .select()
    .single();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  const invoice = await createOrderInvoice({
    organizationId: lead.organization_id,
    orderId: order.id,
    customerId,
    service,
    plan,
    price,
    createdBy: profile.id,
  });
  await supabase.from("invoice_events").insert({ invoice_id: invoice.id, event_type: "created", actor_id: profile.id, detail: "Converted from lead" });

  await supabase.from("leads").update({ converted_to_profile_id: customerId, status: "won" }).eq("id", id);
  await supabase.from("lead_status_history").insert({ lead_id: id, old_status: lead.status, new_status: "won", changed_by: profile.id });

  const paymentUrl = `${SITE_URL}/pay/${invoice.id}`;
  let emailSent = true;
  try {
    const { data: org } = await supabase.from("organizations").select("name").eq("id", lead.organization_id).single();
    if (newAccountPassword) {
      await sendAccountCreatedEmail({ customerName: lead.name, customerEmail: lead.email, tempPassword: newAccountPassword });
    }
    await sendPaymentRequestEmail({
      customerName: lead.name,
      customerEmail: lead.email,
      service,
      plan,
      amount: Number(invoice.total),
      paymentUrl,
      orgName: org?.name,
    });
  } catch (err) {
    console.error("Failed to send lead-conversion email:", err);
    emailSent = false;
    await logEmailFailure(supabase, {
      emailType: "payment_request",
      recipientEmail: lead.email,
      relatedEntity: `invoice:${invoice.id}`,
      errorMessage: err instanceof Error ? err.message : String(err),
      organizationId: lead.organization_id,
    });
  }

  return NextResponse.json({ ok: true, order, invoice, customerId, paymentUrl, emailSent }, { status: 201 });
}
