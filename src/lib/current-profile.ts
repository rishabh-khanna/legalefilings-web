import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/roles";

// Server Component / Route Handler helper — the one place that combines
// "who is logged in" (auth.users, via cookies) with "what can they do"
// (profiles.account_type / staff_level). Returns null when signed out.
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
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

  return { ...profile, email: user.email ?? "" } as Profile;
}
