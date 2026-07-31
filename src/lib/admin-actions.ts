import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { AccountType, CustomerTier, StaffLevel } from "@/lib/roles";

function generateTempPassword() {
  // Not shown to the end user directly (admin relays it, or it goes out
  // by email once that's wired up) — random enough for a one-time
  // credential the user is expected to change on first real login.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export type CreateUserInput = {
  email: string;
  fullName: string;
  phone?: string;
  accountType: AccountType;
  customerTier?: CustomerTier;
  staffLevel?: StaffLevel;
  reportsTo?: string;
  company?: string;
  city?: string;
  state?: string;
  dateOfBirth?: string;
};

// Shared by both the admin "quick add user" form and the account-request
// approval flow — one place that creates the auth user + profile row
// together, since a profile without a matching auth user (or vice versa)
// is a broken account either way.
export async function createUserWithProfile(input: CreateUserInput) {
  const supabase = getSupabaseAdmin();
  const tempPassword = generateTempPassword();

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: tempPassword,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    throw new Error(authError?.message ?? "Failed to create auth user");
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: authUser.user.id,
    full_name: input.fullName,
    phone: input.phone ?? null,
    account_type: input.accountType,
    customer_tier: input.accountType === "customer" ? (input.customerTier ?? "free") : null,
    staff_level: input.accountType === "staff" ? (input.staffLevel ?? null) : null,
    reports_to: input.reportsTo ?? null,
    company: input.company ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    date_of_birth: input.dateOfBirth ?? null,
    crm_status: input.accountType === "customer" ? "active" : "lead",
  });

  if (profileError) {
    // Roll back the orphaned auth user rather than leaving a login with no profile.
    await supabase.auth.admin.deleteUser(authUser.user.id);
    throw new Error(profileError.message);
  }

  return { userId: authUser.user.id, tempPassword };
}
