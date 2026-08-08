import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import type { CreateBilledInvoiceInput } from "@/lib/create-billed-invoice";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("recurring_invoice_templates")
    .select("*, profiles!recurring_invoice_templates_customer_id_fkey(full_name)")
    .order("next_run_date", { ascending: true });
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  // canSeeAllOrgs (is_platform_admin) must also skip the reporting-chain
  // narrowing below — independent axis from account_type.
  if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
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
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { customerId, invoiceType, frequency, startDate, payload } = (body ?? {}) as {
    customerId?: string; invoiceType?: string; frequency?: string; startDate?: string; payload?: CreateBilledInvoiceInput;
  };
  if (!customerId || !payload || !payload.items || payload.items.length === 0) {
    return NextResponse.json({ error: "customerId and at least one line item are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: customer } = await supabase.from("profiles").select("organization_id").eq("id", customerId).single();
  if (!customer || customer.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("recurring_invoice_templates")
    .insert({
      organization_id: profile.organization_id,
      customer_id: customerId,
      invoice_type: invoiceType ?? "gst",
      payload: { ...payload, organizationId: profile.organization_id },
      frequency: frequency ?? "monthly",
      next_run_date: startDate || new Date().toISOString().slice(0, 10),
      created_by: profile.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, template: data }, { status: 201 });
}
