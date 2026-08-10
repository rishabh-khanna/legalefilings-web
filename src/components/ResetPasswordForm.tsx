"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Where the emailed reset link lands. Supabase puts a recovery token in
// the URL and the browser client exchanges it for a short-lived session
// automatically — so the only thing left to do here is set the new
// password. That session is recovery-scoped: it exists to allow this one
// change, which is why the form checks for it before rendering rather
// than letting someone open this page cold and see a password box that
// can't possibly work.
export function ResetPasswordForm() {
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // The token exchange happens asynchronously as the client parses the
    // URL, so a plain getSession() on mount can run before it lands.
    // onAuthStateChange fires PASSWORD_RECOVERY once it has, and the
    // getSession() below covers the case where it already completed.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady("ok");
    });

    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setReady((prev) => (prev === "ok" ? prev : data.session ? "ok" : "invalid"));
    }, 1200);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErrorMessage("Both passwords need to match.");
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }
    // Sign the recovery session out rather than dropping the user
    // straight into the dashboard on it — they should log in once with
    // the password they just set, which also confirms it actually works.
    await supabase.auth.signOut();
    setDone(true);
  }

  const inputClass =
    "w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-action)]";

  if (ready === "checking") {
    return <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Checking your reset link…</p>;
  }

  if (ready === "invalid") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl px-4 py-4 text-sm" style={{ backgroundColor: "#fde2e2", color: "#b42318" }}>
          <p className="font-semibold">This link isn&apos;t valid any more</p>
          <p className="mt-1">Reset links expire after an hour and can only be used once. Request a fresh one.</p>
        </div>
        <Link
          href="/forgot-password"
          className="inline-block rounded-full px-6 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl px-4 py-4 text-sm" style={{ backgroundColor: "#d0f4db", color: "#116a2c" }}>
          <p className="font-semibold">Password updated</p>
          <p className="mt-1">Sign in with your new password.</p>
        </div>
        <Link
          href="/login"
          className="inline-block rounded-full px-6 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--color-ink)" }}>
          New password
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={showPassword ? "text" : "password"}
            required
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            style={{ borderColor: "var(--color-line)" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
            style={{ color: "var(--color-action-dark)" }}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>At least 8 characters.</p>
      </div>

      <div>
        <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--color-ink)" }}>
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type={showPassword ? "text" : "password"}
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
          style={{ borderColor: "var(--color-line)" }}
        />
      </div>

      {errorMessage && (
        <p className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "#fde2e2", color: "#b42318" }}>
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
        style={{ backgroundColor: "var(--color-action)" }}
      >
        {submitting ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
