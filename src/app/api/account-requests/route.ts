import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

// GET /api/account-requests
//   - ?email=... (public): status check for the person who submitted it —
//     no session required, mirrors a typical "check my application status" flow.
//   - no query (staff/admin only): the full queue, for the approval page.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const supabase = getSupabaseAdmin();

  if (email) {
    const { data, error } = await supabase
      .from("account_requests")
      .select("id, full_name, email, status, review_note, requested_account_type, requested_staff_level, created_at, updated_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ request: data });
  }

  const profile = await getCurrentProfile();
  if (!profile || !isStaffOrAdmin(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let query = supabase
    .from("account_requests")
    // Two FKs to profiles (requested_by, reviewed_by) — reviewer needs
    // the explicit profiles!account_requests_reviewed_by_fkey form.
    .select("*, profiles!account_requests_requested_by_fkey(full_name), reviewer:profiles!account_requests_reviewed_by_fkey(full_name)")
    .order("created_at", { ascending: false });
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data });
}

// POST /api/account-requests — public submission. If the same email
// already has a request, this is treated as a resubmission-after-
// correction: the existing row is updated and reset to 'pending' rather
// than creating a duplicate, UNLESS it's already approved (a live account
// already exists — nothing to resubmit).
export async function POST(request: Request) {
  // Public and unauthenticated — same reasoning as the lead form. This
  // one also upserts by email, so without a limit it doubles as a way to
  // repeatedly reset someone else's pending request back to 'pending'.
  if (isRateLimited(`account-request:${getClientIp(request)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many submissions. Please try again in a few minutes." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { fullName, email, phone, staffLevel, message } = body as Record<string, unknown>;
  if (!fullName || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("account_requests")
    .select("id, status")
    .eq("email", String(email))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.status === "approved") {
    return NextResponse.json({ error: "This email already has an approved account — try logging in." }, { status: 409 });
  }

  // Public, unauthenticated form — always Legal Efilings' own staff
  // signup queue (a tenant org's own staff-request flow is a separate,
  // later feature, not something this endpoint decides between).
  const { data: legalEfilingsOrg } = await supabase.from("organizations").select("id").eq("slug", "legal-efilings").single();

  const payload = {
    organization_id: legalEfilingsOrg?.id,
    full_name: String(fullName),
    email: String(email),
    phone: phone ? String(phone) : null,
    requested_account_type: "staff" as const,
    requested_staff_level: staffLevel ? String(staffLevel) : null,
    message: message ? String(message) : null,
    status: "pending" as const,
    reviewed_by: null,
    review_note: null,
  };

  const { data, error } = existing
    ? await supabase.from("account_requests").update(payload).eq("id", existing.id).select().single()
    : await supabase.from("account_requests").insert(payload).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, request: data }, { status: 201 });
}
