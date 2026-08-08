import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Profile } from "@/lib/roles";

// The fixed set of normally-admin-only (or group_leader-only) sections an
// org admin can delegate to a specific staff member individually, instead
// of promoting them to a whole new role tier. `path` is the section's
// route prefix — used by proxy.ts (page gate) and matches the nav item's
// href in DashboardShell. Kept in sync by hand with
// supabase/migrations/20260824000000_staff_tool_grants.sql (tool_key is
// a plain text column there, not an enum).
export const DELEGABLE_TOOLS = [
  { key: "employees", label: "Employees", path: "/dashboard/admin/employees" },
  { key: "departments", label: "Departments", path: "/dashboard/admin/departments" },
  { key: "payroll", label: "Payroll", path: "/dashboard/admin/payroll" },
  { key: "payslips", label: "Payslips", path: "/dashboard/admin/payslips" },
  { key: "hr_letters", label: "HR Letters", path: "/dashboard/admin/hr-letters" },
  { key: "product_catalog", label: "Invoice Item Catalog", path: "/dashboard/admin/product-catalog" },
  { key: "reports", label: "Reports", path: "/dashboard/admin/reports" },
  { key: "company_settings", label: "Business Settings", path: "/dashboard/admin/business-settings" },
  { key: "email_failures", label: "Email Failures", path: "/dashboard/admin/email-failures" },
  { key: "analytics", label: "Analytics", path: "/dashboard/admin/analytics" },
  { key: "leave_types", label: "Leave Types", path: "/dashboard/admin/leave-types" },
] as const;

export type ToolKey = (typeof DELEGABLE_TOOLS)[number]["key"];

export type StaffToolGrant = {
  id: string;
  organization_id: string;
  staff_id: string;
  tool_key: ToolKey;
  granted_by: string | null;
  expires_at: string | null;
  created_at: string;
};

export function isGrantActive(grant: Pick<StaffToolGrant, "expires_at">): boolean {
  return !grant.expires_at || new Date(grant.expires_at) > new Date();
}

// Route-handler / server-component check: does this profile have API-level
// access to a delegable tool? Admin always does; anyone else needs a
// live (non-expired) grant row. Use this instead of a bare
// `profile.account_type !== "admin"` check on any route that backs one
// of the DELEGABLE_TOOLS pages.
export async function hasToolAccess(profile: Pick<Profile, "id" | "account_type"> | null, toolKey: ToolKey): Promise<boolean> {
  if (!profile) return false;
  if (profile.account_type === "admin") return true;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("staff_tool_grants")
    .select("expires_at")
    .eq("staff_id", profile.id)
    .eq("tool_key", toolKey)
    .maybeSingle();
  if (!data) return false;
  return isGrantActive(data);
}
