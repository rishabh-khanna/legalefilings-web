import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/config/site";
import { Logo } from "@/components/Logo";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata: Metadata = {
  title: `Reset your password — ${SITE_NAME}`,
  description: `Request a password reset link for your ${SITE_NAME} account.`,
  // Auth utility pages have nothing to rank for and shouldn't appear in
  // search results alongside the marketing site.
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16" style={{ backgroundColor: "var(--color-paper)" }}>
      <div
        className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm dark:bg-[var(--color-paper-raised)]"
        style={{ borderColor: "var(--color-line)" }}
      >
        <Link href="/" className="inline-block">
          <Logo />
        </Link>
        <h1 className="mt-6 text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
          Reset your password
        </h1>
        <p className="mt-1.5 mb-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>
          Enter the email you sign in with and we&apos;ll send you a link.
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
