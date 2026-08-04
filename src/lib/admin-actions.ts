import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { AccountType, CustomerTier, StaffLevel } from "@/lib/roles";

export function generateTempPassword() {
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
  department?: string;
  designation?: string;
};

// EMP-YYYYMM-XXXX — human-readable and roughly chronological, not a
// strict sequence (no counter table to keep consistent under
// concurrent signups); good enough for an ID that mainly needs to be
// unique and recognizable on a payslip or letter, not audited as a
// gapless sequence.
function generateEmployeeId() {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `EMP-${yyyymm}-${suffix}`;
}

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
    employee_id: input.accountType !== "customer" ? generateEmployeeId() : null,
    department: input.accountType !== "customer" ? (input.department ?? null) : null,
    designation: input.accountType !== "customer" ? (input.designation ?? null) : null,
  });

  if (profileError) {
    // Roll back the orphaned auth user rather than leaving a login with no profile.
    await supabase.auth.admin.deleteUser(authUser.user.id);
    throw new Error(profileError.message);
  }

  return { userId: authUser.user.id, tempPassword };
}
