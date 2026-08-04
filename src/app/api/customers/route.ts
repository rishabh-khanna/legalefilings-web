import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";

// GET /api/customers — id + full_name for every customer account. Staff
// need this for pickers (invoice generation, buy-for-customer) but have
// no legitimate reason to see anything else on a customer's profile row,
// so this goes through the service-role client with an explicit column
// list rather than a direct browser-session query against `profiles`
// (which would otherwise require RLS to grant broad row access).
export async function GET() {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("profiles").select("id, full_name").eq("account_type", "customer");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customers: data });
}
