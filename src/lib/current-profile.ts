import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/roles";
import { isOrgAccessActive } from "@/lib/organization";

// Server Component / Route Handler helper — the one place that combines
// "who is logged in" (auth.users, via cookies) with "what can they do"
// (profiles.account_type / staff_level). Returns null when signed out.
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // organizations embedded rather than fetched separately — this
  // function runs on essentially every request, so the org access check
  // below must not cost an extra round trip.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations!organization_id(access_expires_at, status)")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  // A deactivated employee also gets their Supabase Auth account banned,
  // but a ban only blocks their *next token refresh* — an access token
  // issued before the ban stays technically valid for up to its own
  // lifetime, during which every API route and server component calling
  // this function would otherwise keep granting full access. This is the
  // one shared place both layers go through, so checking is_active here
  // closes that window immediately at the app layer instead of waiting
  // on token expiry — proxy.ts does the same check for page navigation,
  // but its middleware matcher only covers /dashboard/*, not /api/*.
  if (profile.is_active === false) return null;

  // Same reasoning one level up: an organization whose CRM access has
  // lapsed (or that a platform admin has suspended) is cut off in
  // proxy.ts, but that middleware matcher only covers /dashboard/*.
  // Without this check the expired org's still-valid session could keep
  // calling /api/* directly — reading leads, creating invoices, running
  // payroll — long after the UI told them they were locked out.
  //
  // Doesn't apply to a customer (no CRM access to lose) or a
  // platform_admin (not bound to a single org).
  const org = profile.organizations as unknown as { access_expires_at: string | null; status: string | null } | null;
  if (profile.account_type !== "customer" && !profile.is_platform_admin && org && !isOrgAccessActive(org)) {
    return null;
  }

  return { ...profile, email: user.email ?? "" } as Profile;
}
