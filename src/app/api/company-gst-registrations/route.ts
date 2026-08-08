import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  let query = supabase.from("company_gst_registrations").select("*").eq("active", true).order("label");
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ registrations: data });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { label, gstNumber, panNumber, address, state, stateCode, isDefault } = body ?? {};
  if (!label || !gstNumber) return NextResponse.json({ error: "label and gstNumber are required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (isDefault) {
    await supabase
      .from("company_gst_registrations")
      .update({ is_default: false })
      .eq("is_default", true)
      .eq("organization_id", profile.organization_id);
  }

  const { data, error } = await supabase
    .from("company_gst_registrations")
    .insert({
      organization_id: profile.organization_id,
      label,
      gst_number: gstNumber,
      pan_number: panNumber || null,
      address: address || null,
      state: state || null,
      state_code: stateCode || null,
      is_default: !!isDefault,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, registration: data }, { status: 201 });
}
