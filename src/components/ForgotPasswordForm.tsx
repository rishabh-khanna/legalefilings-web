"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Password reset request. Previously "Forgot your password?" pointed at
// the contact page, so every forgotten password became a support ticket
// plus a manual admin action — the single most common reason a user
// can't get into a B2B app.
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Where the emailed link lands. This exact URL has to be listed
      // under Authentication → URL Configuration → Redirect URLs in
      // Supabase, or the link silently bounces to the site root.
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);

    // Deliberately shows the same confirmation whether or not the address
    // has an account. Reporting "no account with that email" would turn
    // this form into a way to test which addresses are registered.
    // A genuine error (network, rate limit) is still surfaced — that's
    // about the request failing, not about who exists.
    if (error && !/user|not found|invalid/i.test(error.message)) {
      setErrorMessage(error.message);
      return;
    }
    setSent(true);
  }

  const inputClass =
    "w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--color-action)]";

  if (sent) {
    return (
      <div className="space-y-4">
        <div
          className="rounded-xl px-4 py-4 text-sm"
          style={{ backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" }}
        >
          <p className="font-semibold">Check your email</p>
          <p className="mt-1">
            If an account exists for <span className="font-medium">{email.trim()}</span>, we&apos;ve sent a link to reset
            your password. It expires in an hour.
          </p>
        </div>
        <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-semibold underline"
            style={{ color: "var(--color-action-dark)" }}
          >
            try a different address
          </button>
          .
        </p>
        <Link href="/login" className="block text-sm font-semibold" style={{ color: "var(--color-action-dark)" }}>
          ← Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--color-ink)" }}>
          Email address
        </label>
        <input
          id="reset-email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={inputClass}
          style={{ borderColor: "var(--color-line)" }}
        />
        <p className="mt-1.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>
          We&apos;ll send a link to set a new password.
        </p>
      </div>

      {errorMessage && (
        <p className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "var(--color-danger-tint)", color: "var(--color-danger)" }}>
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !email.trim()}
        className="w-full rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
        style={{ backgroundColor: "var(--color-action)" }}
      >
        {submitting ? "Sending…" : "Send reset link"}
      </button>

      <Link href="/login" className="block text-center text-sm font-semibold" style={{ color: "var(--color-action-dark)" }}>
        ← Back to login
      </Link>
    </form>
  );
}
