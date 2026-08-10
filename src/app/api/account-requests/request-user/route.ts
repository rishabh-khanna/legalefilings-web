import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";

// POST /api/account-requests/request-user — any staff level (not just
// admin) can ask for a new account (customer or staff) to be created;
// lands in the same approval queue as public self-signup requests, but
// tagged with requested_by so the admin knows who's asking. Admin still
// creates directly via /api/admin/create-user without this detour.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { fullName, email, phone, accountType, customerTier, staffLevel, company, city, state, message, department, designation } = body ?? {};
  if (!fullName || !email || !accountType) {
    return NextResponse.json({ error: "fullName, email, and accountType are required" }, { status: 400 });
  }
  // Requesting an admin account has to go through direct creation
  // (/api/admin/create-user, admin-only) — not this queue, even for an
  // admin submitter, so there's exactly one path to a new admin login.
  if (accountType !== "customer" && accountType !== "staff") {
    return NextResponse.json({ error: "accountType must be 'customer' or 'staff'" }, { status: 400 });
  }
  // Mirrors the client-side check in the "Request New User" form — the
  // form already blocks submission without these for a staff request, but
  // that's a UI convenience, not a guarantee; server-side is what actually
  // stops a bare API call from creating the same gap this route used to
  // have (see 20260910000000_account_request_department.sql).
  if (accountType === "staff" && (!department || !designation)) {
    return NextResponse.json({ error: "department and designation are required for a staff account" }, { status: 400 });
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
    return NextResponse.json({ error: "This email already has an approved account." }, { status: 409 });
  }

  const payload = {
    organization_id: profile.organization_id,
    full_name: String(fullName),
    email: String(email),
    phone: phone ? String(phone) : null,
    requested_account_type: accountType,
    requested_customer_tier: accountType === "customer" ? (customerTier ?? "free") : null,
    requested_staff_level: accountType === "staff" ? (staffLevel ?? null) : null,
    company: company ? String(company) : null,
    city: city ? String(city) : null,
    state: state ? String(state) : null,
    department: accountType === "staff" && department ? String(department) : null,
    designation: accountType === "staff" && designation ? String(designation) : null,
    message: message ? String(message) : null,
    requested_by: profile.id,
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
