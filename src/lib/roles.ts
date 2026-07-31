// Shared role vocabulary — mirrors the Postgres enums in
// supabase/migrations/20260730194224_init_schema.sql. Kept as plain string
// unions (not imported from a generated types file) so both client and
// server code can use them without pulling in server-only modules.
export type AccountType = "customer" | "staff" | "admin";
export type CustomerTier = "free" | "paid";
export type StaffLevel = "rater" | "leader" | "group_leader";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string;
  account_type: AccountType;
  customer_tier: CustomerTier | null;
  staff_level: StaffLevel | null;
  company: string | null;
  city: string | null;
  state: string | null;
  date_of_birth: string | null;
  crm_status: "lead" | "active" | "past_client";
};

export const STAFF_LEVEL_LABELS: Record<StaffLevel, string> = {
  rater: "Rater",
  leader: "Leader",
  group_leader: "Group Leader",
};

export function isStaffOrAdmin(profile: Pick<Profile, "account_type"> | null): boolean {
  return profile?.account_type === "staff" || profile?.account_type === "admin";
}

export function roleLabel(profile: Pick<Profile, "account_type" | "staff_level" | "customer_tier"> | null): string {
  if (!profile) return "";
  if (profile.account_type === "admin") return "Admin";
  if (profile.account_type === "staff") return profile.staff_level ? STAFF_LEVEL_LABELS[profile.staff_level] : "Staff";
  return profile.customer_tier === "paid" ? "Paid Customer" : "Customer";
}
