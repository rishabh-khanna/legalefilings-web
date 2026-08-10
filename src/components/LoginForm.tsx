"use client";

import { useState } from "react";
import Link from "next/link";
import { CONTACT_LINKS } from "@/config/site";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailValue.trim(),
      password: passwordValue,
    });

    if (error || !data.user) {
      setSubmitting(false);
      setErrorMessage("Incorrect email or password.");
      return;
    }

    // A client-side router.push() here used to race proxy.ts's middleware:
    // it fires an RSC navigation fetch to /dashboard immediately, and that
    // fetch occasionally beat the just-written session cookie becoming
    // visible to the request pipeline, so the middleware saw no session
    // yet and bounced straight back to /login with no error shown (the
    // sign-in itself had already succeeded). A hard navigation sidesteps
    // this entirely — it's a fresh top-level request, guaranteed to carry
    // whatever cookies are on the document at this point, not a soft
    // client-side transition that can race the auth client's cookie write.
    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium mb-1" style={{ color: "var(--color-ink)" }}>
          Email
        </label>
        <input
          id="login-email"
          type="text"
          autoComplete="username"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          placeholder="Enter your email"
          className="w-full rounded-lg border px-4 py-2 text-sm outline-none focus:border-[var(--color-action)]"
          style={{ borderColor: "var(--color-line)" }}
        />
      </div>

      <div>
        <label htmlFor="login-password" className="block text-sm font-medium mb-1" style={{ color: "var(--color-ink)" }}>
          Password
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
            placeholder="Enter your password"
            className="w-full rounded-lg border px-4 py-2 pr-10 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center pr-3"
            style={{ color: "var(--color-ink-soft)" }}
          >
            {showPassword ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" strokeLinecap="round" strokeLinejoin="round" />
                <path
                  d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* The "Remember me" checkbox that used to sit here was wired to
          nothing — no state, no handler, no effect on session lifetime.
          Supabase already persists the session across restarts, so the
          box was promising something that was both unimplemented and
          already true by default. Removed rather than faked. */}
      <div className="flex items-center justify-end">
        <Link href="/forgot-password" className="text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
          Forgot your password?
        </Link>
      </div>

      {errorMessage && (
        <p className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
          {errorMessage}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        style={{ backgroundColor: "var(--color-action)" }}
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/contact" className="font-medium" style={{ color: "var(--color-action-dark)" }}>
          Get in touch
        </Link>
      </p>

      <p className="text-center text-xs" style={{ color: "var(--color-ink-soft)" }}>
        Having trouble logging in?{" "}
        <a href={CONTACT_LINKS.tel} className="underline underline-offset-2">
          Call us
        </a>
      </p>
    </form>
  );
}
