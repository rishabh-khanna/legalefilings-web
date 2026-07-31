import { createClient } from "@supabase/supabase-js";

// Server-only client — uses the secret key, which bypasses Row Level
// Security entirely. Never import this from a "use client" component;
// API routes and server actions only.
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY env vars");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
