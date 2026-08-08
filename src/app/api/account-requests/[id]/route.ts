import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { createUserWithProfile } from "@/lib/admin-actions";
import { canSeeAllOrgs } from "@/lib/organization";

// PATCH /api/account-requests/[id] — approve or reject. Admin-only (staff
// can request accounts but not approve each other). Approving creates the
// real auth user + profile via the same helper the admin "quick add user"
// form uses, so an approved request always results in an account that
// actually works.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: reqRow, error: fetchError } = await supabase.from("account_requests").select("*").eq("id", id).single();
  if (fetchError || !reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (!canSeeAllOrgs(profile) && reqRow.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (reqRow.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be reviewed" }, { status: 409 });
  }

  if (decision === "reject") {
    const reason = String(body?.reason ?? "").trim();
    if (!reason) return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
    const { data, error } = await supabase
      .from("account_requests")
      .update({ status: "rejected", reviewed_by: profile.id, review_note: reason })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, request: data });
  }

  // Approve: create the account, then mark the request approved.
  // requested_account_type defaults to "staff" for older rows from before
  // staff-initiated requests existed (public self-signup was staff-only).
  let tempPassword: string;
  try {
    const accountType = reqRow.requested_account_type ?? "staff";
    const result = await createUserWithProfile({
      organizationId: reqRow.organization_id,
      email: reqRow.email,
      fullName: reqRow.full_name,
      phone: reqRow.phone ?? undefined,
      accountType,
      customerTier: accountType === "customer" ? (reqRow.requested_customer_tier ?? "free") : undefined,
      staffLevel: accountType === "staff" ? (reqRow.requested_staff_level ?? "rater") : undefined,
      company: reqRow.company ?? undefined,
      city: reqRow.city ?? undefined,
      state: reqRow.state ?? undefined,
    });
    tempPassword = result.tempPassword;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create account" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("account_requests")
    .update({ status: "approved", reviewed_by: profile.id, review_note: null })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, request: data, tempPassword });
}
