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

  return { ...profile, email: user.email ?? "" } as Profile;
}
