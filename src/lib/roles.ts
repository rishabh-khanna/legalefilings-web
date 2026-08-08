// Shared role vocabulary — mirrors the Postgres enums in
// supabase/migrations/20260730194224_init_schema.sql. Kept as plain string
// unions (not imported from a generated types file) so both client and
// server code can use them without pulling in server-only modules.
export type AccountType = "customer" | "staff" | "admin";
export type CustomerTier = "free" | "paid";
export type StaffLevel = "rater" | "leader" | "group_leader";

// Configurable staff hierarchy (see supabase/migrations/
// 20260816000000_department_role_hierarchy.sql). Additive, not a
// replacement for staff_level — reports_to is still the one mechanism
// that decides who manages whom and who can approve what; a Department
// and DepartmentRole are just an org-configurable label + nav-gating
// flag layered on top for companies who don't want to be stuck with
// "rater / leader / group_leader."
export type Department = {
  id: string;
  organization_id: string;
  name: string;
};

export type DepartmentRole = {
  id: string;
  department_id: string;
  title: string;
  rank: number;
  is_manager_level: boolean;
};

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
  // Employee master fields (Module 2 of the HRMS spec) — nullable since
  // customers and most existing staff rows won't have these filled in.
  employee_id: string | null;
  aadhaar_number: string | null;
  pan_number: string | null;
  department: string | null;
  designation: string | null;
  date_of_joining: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  uan_number: string | null;
  esic_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  reports_to: string | null;
  is_active: boolean;
  // Multi-tenancy (Phase 0, supabase/migrations/20260807000000_...) —
  // every profile belongs to exactly one organization; is_platform_admin
  // is Legal-Efilings-operator-only and bypasses org scoping entirely
  // (see canSeeAllOrgs in src/lib/organization.ts — enforced across
  // every API route that touches org-scoped data).
  organization_id: string;
  is_platform_admin: boolean;
  department_id: string | null;
  department_role_id: string | null;
};

export const STAFF_LEVEL_LABELS: Record<StaffLevel, string> = {
  rater: "Rater",
  leader: "Leader",
  group_leader: "Group Leader",
};

export function isStaffOrAdmin(profile: Pick<Profile, "account_type"> | null): boolean {
  return profile?.account_type === "staff" || profile?.account_type === "admin";
}

// departmentRoleTitle, when given, wins over staff_level — a company
// that's set up its own department/role ladder sees its own titles
// ("Senior Manager") instead of the generic rater/leader/group_leader
// fallback everyone starts on.
export function roleLabel(
  profile: Pick<Profile, "account_type" | "staff_level" | "customer_tier" | "is_platform_admin"> | null,
  departmentRoleTitle?: string | null
): string {
  if (!profile) return "";
  if (profile.is_platform_admin) return "Platform Admin";
  if (profile.account_type === "admin") return "Admin";
  if (profile.account_type === "staff") {
    if (departmentRoleTitle) return departmentRoleTitle;
    return profile.staff_level ? STAFF_LEVEL_LABELS[profile.staff_level] : "Staff";
  }
  return profile.customer_tier === "paid" ? "Paid Customer" : "Customer";
}
