import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

// GET /api/product-service-master — the catalog every invoice line item
// picker draws from. Any staff/admin can read their own org's (needed
// to create an invoice); only admin can write to it (see POST/PATCH/
// DELETE below) — a shared catalog that any rater could silently edit
// would corrupt GST rates on every future invoice, not just their own.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  // organizations(name) only actually matters for a platform_admin, who
  // sees every org's catalog pooled together here — without it, two
  // orgs' identically-named items (e.g. "Consulting", "Filing Fee")
  // render as indistinguishable duplicates.
  let query = supabase
    .from("product_service_master")
    .select("*, organizations(name)")
    .eq("active", true)
    .order("name", { ascending: true });
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "product_catalog"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { type, name, hsnSacCode, gstRate, unit, defaultRate, description } = body ?? {};
  if (!type || !name) return NextResponse.json({ error: "type and name are required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("product_service_master")
    .insert({
      organization_id: profile.organization_id,
      type,
      name,
      hsn_sac_code: hsnSacCode || null,
      gst_rate: gstRate ?? 18,
      unit: unit || "Nos",
      default_rate: defaultRate || null,
      description: description || null,
      created_by: profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}
