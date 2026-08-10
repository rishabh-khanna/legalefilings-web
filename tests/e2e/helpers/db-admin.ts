import { getSupabaseAdmin } from "@/lib/supabase-admin";

// A handful of scenarios (org access expiry in particular) have no
// product-level way to set up the "before" state through the real app —
// there's no UI/API to backdate an organization's access_expires_at,
// only to set it (always in the future) at CRM-access-request approval
// time. For those, and only those, go straight to the DB with the
// service-role key rather than faking it through the app. Reuses the
// app's own getSupabaseAdmin() rather than constructing a second client,
// so this stays typed the same way the rest of the codebase's
// service-role queries are.
let client: ReturnType<typeof getSupabaseAdmin> | null = null;

export function getDbAdmin() {
  if (client) return client;
  // playwright.config.ts deliberately assumes `npm run dev` is already
  // running (which loads .env.local itself) and doesn't load env for the
  // test runner process — so pull it in here if it isn't already set.
  if (!process.env.SUPABASE_SECRET_KEY) {
    try {
      process.loadEnvFile(".env.local");
    } catch {
      // already loaded, or the file's missing — getSupabaseAdmin() below
      // will throw a clear error if the key truly isn't available
    }
  }
  client = getSupabaseAdmin();
  return client;
}
