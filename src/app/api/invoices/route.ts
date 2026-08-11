import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { createBilledInvoice, type CreateBilledInvoiceInput } from "@/lib/create-billed-invoice";
import { getMissingBusinessSettingsFields } from "@/lib/business-settings-completeness";

// GET /api/invoices — a customer sees their own; a rater sees only
// invoices they created; a leader/group_leader sees their own plus their
// reporting chain's; admin sees everything. Each invoice comes back with
// its payment history so the list can show balance outstanding/ageing
// without a second round trip per row.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  // organizations(name) only actually matters for a platform_admin, who
  // sees every org's invoices pooled together here — without it, there'd
  // be no way to tell which tenant issued a given row.
  let query = supabase
    .from("invoices")
    .select("*, profiles!invoices_customer_id_fkey(full_name, company), invoice_payments(*), organizations(name)")
    .order("created_at", { ascending: false });

  if (profile.account_type === "customer") {
    query = query.eq("customer_id", profile.id);
  } else {
    if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
    // canSeeAllOrgs (is_platform_admin) must also skip the reporting-chain
    // narrowing below — it's an independent axis from account_type, so a
    // platform_admin whose account_type isn't literally "admin" would
    // otherwise pass the org filter above (across every org) only to get
    // wrongly narrowed straight back down to their own chain here.
    if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
      // created_by is null for anything created via the public
      // checkout flow (no staff involved) — Postgres `IN` never matches
      // NULL, so without the explicit is-null branch every self-checkout
      // invoice was invisible to every rater/leader/group_leader, same
      // bug as the orders list this mirrors.
      const chain = await getReportingChainIds(profile.id);
      query = query.or(`created_by.is.null,created_by.in.(${[profile.id, ...chain].join(",")})`);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data });
}

// POST /api/invoices — full GST-aware invoice creation. Staff/admin
// only — invoice generation is an Invoice CRM capability, not something
// a plain customer does for themselves from their own invoice list. A
// customer who wants their own invoicing gets it by requesting their own
// CRM workspace (see /dashboard/crm-access), at which point they're an
// admin using this exact same route like any other org. Credit/debit
// notes go through this same endpoint with invoiceType set and
// relatedInvoiceId pointing at the original.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaffOrAdmin(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const b = body as Record<string, unknown> & Partial<CreateBilledInvoiceInput>;
  if (!b.customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  // The invoice belongs to whichever org actually owns this customer, not
  // necessarily the caller's own — same reasoning as buy-for-customer:
  // a platform_admin invoicing a tenant's customer needs the invoice (and
  // the Business Settings check below) attributed to that tenant, not to
  // the platform admin's own org, or the invoice/prefix/GST registration
  // would come out branded wrong and the completeness check would be
  // validating the wrong org's settings entirely.
  const { data: customer } = await supabase.from("profiles").select("organization_id").eq("id", b.customerId).eq("account_type", "customer").single();
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (!canSeeAllOrgs(profile) && customer.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

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

  try {
    const invoice = await createBilledInvoice({
      ...b,
      organizationId: customer.organization_id,
      customerId: b.customerId,
      items: b.items ?? [],
      createdBy: profile.id,
    });
    return NextResponse.json({ ok: true, invoice }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create invoice" }, { status: 500 });
  }
}
