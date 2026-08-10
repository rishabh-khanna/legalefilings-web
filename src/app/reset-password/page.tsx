import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/config/site";
import { Logo } from "@/components/Logo";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata: Metadata = {
  title: `Set a new password — ${SITE_NAME}`,
  description: `Choose a new password for your ${SITE_NAME} account.`,
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
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
          Set a new password
        </h1>
        <p className="mt-1.5 mb-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>
          Choose something you haven&apos;t used before.
        </p>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
