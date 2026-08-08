import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { createUserWithProfile } from "@/lib/admin-actions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// POST /api/admin/create-user — direct account creation from the admin CRM
// (a customer who called in rather than signing up online, or a staff
// account the admin wants to skip the request/approval flow for). Only
// admins can pick account_type freely; the request/approval route is the
// only way for anyone else to end up with a staff account.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { fullName, email, phone, accountType, customerTier, staffLevel, reportsTo, company, city, state, dateOfBirth, department, designation, gstin, panNumber, stateCode, billingAddress, shippingAddress, assignLeadId } = body as Record<string, unknown>;
  if (!fullName || !email || !accountType) {
    return NextResponse.json({ error: "fullName, email, and accountType are required" }, { status: 400 });
  }
  // Department/designation are org-assigned master data for staff and
  // admin accounts (mirrors the requirement on the Employees page) — a
  // customer account has neither, so the check only applies otherwise.
  if (accountType !== "customer" && (!department || !designation)) {
    return NextResponse.json({ error: "department and designation are required for staff and admin accounts" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // reportsTo has to be someone in the same org — otherwise an admin
  // could wire a new hire's reporting chain into another tenant's staff,
  // which would leak that other org's approval/visibility chain into
  // this one (canManageStaff/canApproveFor trust reports_to blindly).
  let verifiedReportsTo: string | undefined;
  if (typeof reportsTo === "string" && reportsTo) {
    const { data: manager } = await supabase.from("profiles").select("organization_id").eq("id", reportsTo).single();
    if (!manager || manager.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: "reportsTo must be a staff member in your own organization" }, { status: 400 });
    }
    verifiedReportsTo = reportsTo;
  }

  try {
    const { userId, tempPassword } = await createUserWithProfile({
      organizationId: profile.organization_id,
      email: String(email),
      fullName: String(fullName),
      phone: phone ? String(phone) : undefined,
      accountType: accountType as "customer" | "staff" | "admin",
      customerTier: customerTier as "free" | "paid" | undefined,
      staffLevel: staffLevel as "rater" | "leader" | "group_leader" | undefined,
      reportsTo: verifiedReportsTo,
      company: company ? String(company) : undefined,
      city: city ? String(city) : undefined,
      state: state ? String(state) : undefined,
      dateOfBirth: dateOfBirth ? String(dateOfBirth) : undefined,
      department: department ? String(department) : undefined,
      designation: designation ? String(designation) : undefined,
      gstin: gstin ? String(gstin) : undefined,
      panNumber: panNumber ? String(panNumber) : undefined,
      stateCode: stateCode ? String(stateCode) : undefined,
      billingAddress: billingAddress ? String(billingAddress) : undefined,
      shippingAddress: shippingAddress ? String(shippingAddress) : undefined,
    });

    // Optional: hand the new staff member a lead right at creation time
    // instead of leaving it in the shared unassigned pool. Best-effort —
    // if someone else claimed it in the moment between the admin picking
    // it and the account finishing setup, the account creation itself
    // still succeeded, so we don't fail the request over it; the lead
    // just stays unassigned for any admin to hand out later.
    let leadAssigned = false;
    if (accountType === "staff" && typeof assignLeadId === "string" && assignLeadId) {
      const { data: leadRow } = await supabase
        .from("leads")
        .select("organization_id")
        .eq("id", assignLeadId)
        .eq("organization_id", profile.organization_id)
        .single();
      if (leadRow) {
        const { data: claimed } = await supabase
          .from("leads")
          .update({ assigned_to: String(fullName) })
          .eq("id", assignLeadId)
          .eq("assigned_to", "Unassigned")
          .select()
          .single();
        leadAssigned = Boolean(claimed);
      }
    }

    return NextResponse.json({ ok: true, userId, tempPassword, leadAssigned }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create user" }, { status: 500 });
  }
}
