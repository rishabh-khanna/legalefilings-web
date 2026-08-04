import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";

// GET /api/company-settings — any staff/admin can read (needed to show
// company info on generated documents); only admin can write.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("company_settings").select("*").eq("id", 1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

// PATCH /api/company-settings — admin only. The row already exists
// (seeded by migration) — this always updates the single id=1 row.
export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { address, gstNumber, panNumber, pfNumber, esicNumber, financialYearStartMonth, logoUrl, signatureUrl } = body as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof address === "string") patch.address = address;
  if (typeof gstNumber === "string") patch.gst_number = gstNumber;
  if (typeof panNumber === "string") patch.pan_number = panNumber;
  if (typeof pfNumber === "string") patch.pf_number = pfNumber;
  if (typeof esicNumber === "string") patch.esic_number = esicNumber;
  if (typeof financialYearStartMonth === "number") patch.financial_year_start_month = financialYearStartMonth;
  if (typeof logoUrl === "string") patch.logo_url = logoUrl;
  if (typeof signatureUrl === "string") patch.signature_url = signatureUrl;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("company_settings").update(patch).eq("id", 1).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data });
}
