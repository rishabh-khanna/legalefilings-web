"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { getMissingProfileFields } from "@/lib/profile-completeness";
import type { Profile } from "@/lib/roles";

const DISMISS_KEY = "profile-completion-banner-dismissed";

// A soft nudge, not a hard block: shows on every dashboard page (except
// the profile page itself, where it'd be redundant) until the required
// fields are filled, but never traps anyone mid-task. Dismissing hides it
// for the rest of this browser session (sessionStorage, not localStorage)
// — it comes back next time they sign in, rather than being gone for good
// after one click.
export function ProfileCompletionBanner({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const kickoff = setTimeout(() => {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const missing = getMissingProfileFields(profile);
  if (missing.length === 0 || dismissed || pathname === "/dashboard/profile") return null;

  return (
    <div
      className="mx-auto mb-6 flex max-w-[1800px] flex-wrap items-center gap-3 rounded-xl border px-4 py-3 sm:px-6 lg:px-10"
      style={{ backgroundColor: "#fde2e2", borderColor: "#f3a9a9" }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#b42318" }} />
      <p className="min-w-0 flex-1 text-sm" style={{ color: "#8a1a13" }}>
        <span className="font-semibold">Your profile is missing required details</span> — {missing.join(", ")}.
      </p>
      <Link
        href="/dashboard/profile"
        className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-[1.02]"
        style={{ backgroundColor: "#b42318" }}
      >
        Complete Now
      </Link>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        aria-label="Dismiss for this session"
        className="shrink-0 rounded-full p-1 transition-colors hover:bg-black/5"
        style={{ color: "#8a1a13" }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
