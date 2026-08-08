import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { seedDefaultLeaveTypes } from "@/lib/leave-balance";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Access is bundled free with a plan purchase, not permanent — a year
// from approval, matching how this is meant to work (buy a plan, get a
// year of CRM thrown in; pay again later to keep it going once it lapses).
const ACCESS_DURATION_DAYS = 365;

// PATCH /api/platform/crm-access-requests/[id] — platform_admin only.
// Approving promotes the requesting customer's own existing login to
// admin of a brand-new org (same email/password, no separate credentials
// to hand out) rather than creating a second account — the org, its
// default company_settings row, and the profile update all have to
// succeed together or not at all, so a half-created org never sits
// around with no working admin.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_platform_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: reqRow, error: fetchError } = await supabase.from("org_access_requests").select("*").eq("id", id).single();
  if (fetchError || !reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (reqRow.status !== "pending") return NextResponse.json({ error: "Only pending requests can be reviewed" }, { status: 409 });

  if (decision === "reject") {
    const reason = String(body?.reason ?? "").trim();
    if (!reason) return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
    const { data, error } = await supabase
      .from("org_access_requests")
      .update({ status: "rejected", reviewed_by: profile.id, review_note: reason })
      .eq("id", id)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Request already reviewed" }, { status: 409 });
    return NextResponse.json({ ok: true, request: data });
  }

  // Claim the request FIRST, re-checking status = pending right here (not
  // just in the read above) — two near-simultaneous approve calls
  // (double-click, two admin tabs) can both pass that read, but only one
  // of these UPDATEs can match a still-pending row. The loser gets zero
  // rows back and stops here, instead of both racing ahead into creating
  // a full duplicate organization below. organization_id gets filled in
  // once the org actually exists, a few steps down.
  const { data: claimed, error: claimError } = await supabase
    .from("org_access_requests")
    .update({ status: "approved", reviewed_by: profile.id, review_note: null })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  if (!claimed) return NextResponse.json({ error: "Request already reviewed" }, { status: 409 });

  const { data: customer } = await supabase.from("profiles").select("id, full_name, account_type").eq("id", reqRow.requested_by).single();
  if (!customer || customer.account_type !== "customer") {
    await supabase.from("org_access_requests").update({ status: "pending", reviewed_by: null }).eq("id", id);
    return NextResponse.json({ error: "The requesting account is no longer a customer — can't approve." }, { status: 409 });
  }

  const baseSlug = slugify(reqRow.organization_name) || "org";
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: clash } = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const accessExpiresAt = new Date(Date.now() + ACCESS_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: reqRow.organization_name, slug, plan_tier: "starter", created_by: profile.id, access_expires_at: accessExpiresAt })
    .select()
    .single();
  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 });

  const { error: settingsError } = await supabase.from("company_settings").insert({ organization_id: org.id, financial_year_start_month: 4 });
  if (settingsError) {
    await supabase.from("organizations").delete().eq("id", org.id);
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }
  await seedDefaultLeaveTypes(supabase, org.id);

  const { error: promoteError } = await supabase
    .from("profiles")
    .update({ account_type: "admin", organization_id: org.id, customer_tier: null })
    .eq("id", customer.id);
  if (promoteError) {
    await supabase.from("company_settings").delete().eq("organization_id", org.id);
    await supabase.from("organizations").delete().eq("id", org.id);
    return NextResponse.json({ error: promoteError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("org_access_requests")
    .update({ status: "approved", reviewed_by: profile.id, review_note: null, organization_id: org.id })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, request: data, organization: org });
}
