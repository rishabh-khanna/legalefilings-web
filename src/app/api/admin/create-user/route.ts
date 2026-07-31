import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { createUserWithProfile } from "@/lib/admin-actions";

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

  const { fullName, email, phone, accountType, customerTier, staffLevel, company, city, state, dateOfBirth } = body as Record<string, unknown>;
  if (!fullName || !email || !accountType) {
    return NextResponse.json({ error: "fullName, email, and accountType are required" }, { status: 400 });
  }

  try {
    const { userId, tempPassword } = await createUserWithProfile({
      email: String(email),
      fullName: String(fullName),
      phone: phone ? String(phone) : undefined,
      accountType: accountType as "customer" | "staff" | "admin",
      customerTier: customerTier as "free" | "paid" | undefined,
      staffLevel: staffLevel as "rater" | "leader" | "group_leader" | undefined,
      company: company ? String(company) : undefined,
      city: city ? String(city) : undefined,
      state: state ? String(state) : undefined,
      dateOfBirth: dateOfBirth ? String(dateOfBirth) : undefined,
    });
    return NextResponse.json({ ok: true, userId, tempPassword }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create user" }, { status: 500 });
  }
}
