import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";
import type { CreateBilledInvoiceInput } from "@/lib/create-billed-invoice";

export async function GET() {
  const profile = await getCurrentProfile();
  const isCustomerOperator = profile?.account_type === "customer" && (await hasToolAccess(profile, "invoice_crm"));
  if (!profile || (!isStaffOrAdmin(profile) && !isCustomerOperator)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  // organizations(name) only actually matters for a platform_admin, who
  // sees every org's templates pooled together here — without it, there'd
  // be no way to tell which tenant a template belongs to.
  let query = supabase
    .from("recurring_invoice_templates")
    .select("*, profiles!recurring_invoice_templates_customer_id_fkey(full_name), organizations(name)")
    .order("next_run_date", { ascending: true });
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  // canSeeAllOrgs (is_platform_admin) must also skip the reporting-chain
  // narrowing below — independent axis from account_type. A
  // customer-operator has no reporting chain of their own either, so
  // they get the same unrestricted view admin gets.
  if (profile.account_type !== "admin" && !canSeeAllOrgs(profile) && !isCustomerOperator) {
    const chain = await getReportingChainIds(profile.id);
    query = query.in("created_by", [profile.id, ...chain]);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

// POST /api/recurring-invoices — saves a reusable invoice payload
// (everything a Billed Invoice needs except invoice number/date, which
// are always generated fresh) plus a frequency. Nothing is billed yet —
// generation happens via /api/recurring-invoices/run, either from the
// daily cron or a manual "Run Now".
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  const isCustomerOperator = profile?.account_type === "customer" && (await hasToolAccess(profile, "invoice_crm"));
  if (!profile || (!isStaffOrAdmin(profile) && !isCustomerOperator)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { customerId, invoiceType, frequency, startDate, payload } = (body ?? {}) as {
    customerId?: string; invoiceType?: string; frequency?: string; startDate?: string; payload?: CreateBilledInvoiceInput;
  };
  if (!customerId || !payload || !payload.items || payload.items.length === 0) {
    return NextResponse.json({ error: "customerId and at least one line item are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  // The template belongs to whichever org actually owns this customer,
  // not necessarily the caller's own — same reasoning as invoice creation
  // itself: a platform_admin setting this up for a tenant's customer
  // needs it (and every invoice /run later generates from it) attributed
  // to that tenant, not to the platform admin's own org.
  const { data: customer } = await supabase.from("profiles").select("organization_id").eq("id", customerId).single();
  if (!customer || (!canSeeAllOrgs(profile) && customer.organization_id !== profile.organization_id)) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("recurring_invoice_templates")
    .insert({
      organization_id: customer.organization_id,
      customer_id: customerId,
      invoice_type: invoiceType ?? "gst",
      payload: { ...payload, organizationId: customer.organization_id },
      frequency: frequency ?? "monthly",
      next_run_date: startDate || new Date().toISOString().slice(0, 10),
      // The day of the month this series bills on — every future advance
      // clamps to it rather than drifting off a month-end rollover.
      anchor_day: Number((startDate || new Date().toISOString().slice(0, 10)).slice(8, 10)),
      created_by: profile.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, template: data }, { status: 201 });
}
