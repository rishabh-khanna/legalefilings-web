"use client";

import { createBrowserClient } from "@supabase/ssr";

// Client-component Supabase client — uses the publishable key, safe to
// expose. Session lives in cookies (shared with the server client), not
// localStorage, so proxy.ts and server components see the same session.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
