"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CONTACT_LINKS } from "@/config/site";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LoginMethod = "email" | "phone";

export function LoginForm() {
  const router = useRouter();
  const [method, setMethod] = useState<LoginMethod>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState(false);
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

    router.push("/dashboard");
    router.refresh();
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${active ? "text-white shadow-sm" : "hover:text-[var(--color-ink)]"}`;

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
      <div className="flex items-center gap-2 rounded-lg p-1.5" style={{ backgroundColor: "var(--color-paper)" }}>
        <button
          type="button"
          onClick={() => setMethod("email")}
          className={tabClass(method === "email")}
          style={method === "email" ? { backgroundColor: "var(--color-action)" } : { color: "var(--color-ink-soft)" }}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setMethod("phone")}
          className={tabClass(method === "phone")}
          style={method === "phone" ? { backgroundColor: "var(--color-action)" } : { color: "var(--color-ink-soft)" }}
        >
          Phone
        </button>
      </div>
      <p className="text-center text-xs" style={{ color: "var(--color-ink-soft)" }}>
        💡 You can log in with either your email or phone number once you have an account.
      </p>
      {method === "email" ? (
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
      ) : (
        <div>
          <label htmlFor="login-phone" className="block text-sm font-medium mb-1" style={{ color: "var(--color-ink)" }}>
            Contact Number
          </label>
          <div className="flex">
            <span
              className="flex items-center rounded-l-lg border border-r-0 px-3 text-sm"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)", backgroundColor: "var(--color-paper)" }}
            >
              +91
            </span>
            <input
              id="login-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              className="w-full rounded-r-lg border px-4 py-2 text-sm outline-none focus:border-[var(--color-action)]"
              style={{ borderColor: "var(--color-line)" }}
            />
          </div>
        </div>
      )}

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

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-ink)" }}>
          <input type="checkbox" className="h-4 w-4 rounded" style={{ accentColor: "var(--color-action)" }} />
          Remember me
        </label>
        <Link href="/contact" className="text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
          Forgot your password?
        </Link>
      </div>

      {errorMessage && (
        <p className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
          {errorMessage}
        </p>
      )}
      {notice && (
        <p className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
          Google sign-in isn&apos;t set up yet.{" "}
          <Link href="/contact" className="font-medium underline">
            Contact us
          </Link>{" "}
          in the meantime and our team will help directly.
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

      <div className="relative py-2 text-center text-xs" style={{ color: "var(--color-ink-soft)" }}>
        <span className="relative px-2" style={{ backgroundColor: "var(--color-paper-raised)" }}>
          Or continue with
        </span>
        <div className="absolute inset-x-0 top-1/2 -z-10 border-t" style={{ borderColor: "var(--color-line)" }} />
      </div>

      <button
        type="button"
        onClick={() => setNotice(true)}
        className="flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-paper)]"
        style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.6 5.6 0 0 1-2.4 3.66v3h3.87c2.27-2.09 3.56-5.17 3.56-8.9Z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.27a12 12 0 0 0 0 10.76l4-3.09Z" />
          <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.6 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
        </svg>
        Google
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
