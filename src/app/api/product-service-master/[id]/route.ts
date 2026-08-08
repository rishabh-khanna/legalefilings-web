import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "product_catalog"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { type, name, hsnSacCode, gstRate, unit, defaultRate, description, active } = body;

  const patch: Record<string, unknown> = {};
  if (type !== undefined) patch.type = type;
  if (name !== undefined) patch.name = name;
  if (hsnSacCode !== undefined) patch.hsn_sac_code = hsnSacCode || null;
  if (gstRate !== undefined) patch.gst_rate = gstRate;
  if (unit !== undefined) patch.unit = unit;
  if (defaultRate !== undefined) patch.default_rate = defaultRate || null;
  if (description !== undefined) patch.description = description || null;
  if (active !== undefined) patch.active = active;

  const supabase = getSupabaseAdmin();
  let query = supabase.from("product_service_master").update(patch).eq("id", id);
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  const { data, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

// Soft-delete only — a catalog item that's already referenced on an
// issued invoice (invoice_line_items.catalog_item_id) needs to keep
// existing, so past invoices still resolve it; "deleting" it just hides
// it from future invoice pickers.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "product_catalog"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  let query = supabase.from("product_service_master").update({ active: false }).eq("id", id);
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
