import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

// GET /api/crm-access-requests — a customer sees their own request
// history; a platform_admin sees every org's requests (that's who
// reviews them — an org's own admin never sees this, since approving
// one creates a whole new org, not something scoped to their own).
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  if (profile.is_platform_admin) {
    const { data, error } = await supabase
      .from("org_access_requests")
      .select("*, profiles!org_access_requests_requested_by_fkey(full_name), orders(service, plan)")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ requests: data });
  }

  if (profile.account_type !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("org_access_requests")
    .select("*")
    .eq("requested_by", profile.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data });
}

// POST /api/crm-access-requests — a customer with at least one paid
// purchase can ask for their own CRM workspace. Bundled free with a plan
// purchase (not a separately-priced product) — eligibility is just "have
// they ever actually paid for something," not a specific SKU, per how
// this is meant to work: buy any plan, get a year of CRM access thrown
// in, request it again after another purchase once that lapses.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const organizationName = typeof body?.organizationName === "string" ? body.organizationName.trim() : "";
  if (!organizationName) {
    return NextResponse.json({ error: "organizationName is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existingPending } = await supabase
    .from("org_access_requests")
    .select("id")
    .eq("requested_by", profile.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existingPending) {
    return NextResponse.json({ error: "You already have a request under review." }, { status: 409 });
  }

  const { data: paidInvoice } = await supabase
    .from("invoices")
    .select("order_id")
    .eq("customer_id", profile.id)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!paidInvoice) {
    return NextResponse.json({ error: "You need at least one completed purchase to request a CRM workspace." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("org_access_requests")
    .insert({ requested_by: profile.id, organization_name: organizationName, qualifying_order_id: paidInvoice.order_id })
    .select()
    .single();
  if (error) {
    // 23505 here means a concurrent submit won the race and already
    // inserted a pending row (org_access_requests_one_pending_per_user) —
    // same outcome as the pre-insert pending check above, just caught late.
    if (error.code === "23505") {
      return NextResponse.json({ error: "You already have a request under review." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, request: data }, { status: 201 });
}
