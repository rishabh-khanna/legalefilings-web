import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { hasToolAccess } from "@/lib/tool-grants";

// GET /api/business-settings — any staff/admin can read their own org's
// (needed to show company info on generated documents); only that org's
// admin can write. Was a hard singleton (id always 1) before
// multi-tenancy — now one row per organization_id. Reads/writes the
// `company_settings` table — the DB table name was kept as-is on the
// "Company Settings" -> "Business Settings" rename (only the user-facing
// label/route changed) since renaming the table would mean touching
// every invoice/PDF code path that queries it for no user-visible gain.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("company_settings").select("*").eq("organization_id", profile.organization_id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

// PATCH /api/business-settings — admin only, always updates their own
// org's row. (A brand-new org provisioned after this migration needs
// its own company_settings row inserted at creation time — Phase 2's
// job, not this route's; this route only ever updates an existing row.)
export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "company_settings"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const {
    address, gstNumber, panNumber, pfNumber, esicNumber, financialYearStartMonth, logoUrl, signatureUrl,
    state, stateCode, bankName, bankAccountNumber, bankIfsc, bankBranch, upiId, defaultInvoiceNotes, invoiceNumberPrefix,
  } = body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof address === "string") patch.address = address;
  if (typeof gstNumber === "string") patch.gst_number = gstNumber;
  if (typeof panNumber === "string") patch.pan_number = panNumber;
  if (typeof pfNumber === "string") patch.pf_number = pfNumber;
  if (typeof esicNumber === "string") patch.esic_number = esicNumber;
  if (typeof financialYearStartMonth === "number") patch.financial_year_start_month = financialYearStartMonth;
  if (typeof logoUrl === "string") patch.logo_url = logoUrl;
  if (typeof signatureUrl === "string") patch.signature_url = signatureUrl;
  if (typeof state === "string") patch.state = state;
  if (typeof stateCode === "string") patch.state_code = stateCode;
  if (typeof bankName === "string") patch.bank_name = bankName;
  if (typeof bankAccountNumber === "string") patch.bank_account_number = bankAccountNumber;
  if (typeof bankIfsc === "string") patch.bank_ifsc = bankIfsc;
  if (typeof bankBranch === "string") patch.bank_branch = bankBranch;
  if (typeof upiId === "string") patch.upi_id = upiId;
  if (typeof defaultInvoiceNotes === "string") patch.default_invoice_notes = defaultInvoiceNotes;
  if (typeof invoiceNumberPrefix === "string" && invoiceNumberPrefix.trim()) patch.invoice_number_prefix = invoiceNumberPrefix.trim();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("company_settings").update(patch).eq("organization_id", profile.organization_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data });
}
