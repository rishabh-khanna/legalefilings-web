import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";

// GET /api/customers — every customer account. Staff need this for
// pickers (invoice generation, buy-for-customer); an explicit column
// list keeps it to name/company/billing fields actually needed for
// invoicing, not the full profile row, so this goes through the
// service-role client rather than a direct browser-session query against
// `profiles` (which would otherwise require RLS to grant broad row
// access — the exact leak closed in an earlier migration).
export async function GET() {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("profiles")
    .select("id, full_name, company, phone, gstin, pan_number, state, state_code, billing_address, shipping_address")
    .eq("account_type", "customer");
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customers: data });
}
