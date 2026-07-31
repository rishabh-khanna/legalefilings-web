"use client";

import { useState } from "react";

// Demo-only — for reviewing this build before real customer/staff accounts
// exist. Gated by NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS so going to real
// production is a one-line env change, not a code deletion; unset (or set
// to "false") that var to hide this entirely once real accounts replace
// the seeded demo ones from scripts/seed-database.mjs.
const DEMO_PASSWORD = "Demo@12345";
const ACCOUNTS = [
  { email: "admin@legalefilings.com", role: "Admin" },
  { email: "groupleader@legalefilings.com", role: "Staff — Group Leader" },
  { email: "leader@legalefilings.com", role: "Staff — Leader" },
  { email: "rater@legalefilings.com", role: "Staff — Rater" },
  { email: "customer.free@legalefilings.com", role: "Customer — Free" },
  { email: "customer.paid@legalefilings.com", role: "Customer — Paid" },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors"
      style={{ borderColor: "var(--color-line)", color: copied ? "#116a2c" : "var(--color-ink-soft)" }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function DemoLoginCredentials() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === "false") return null;

  const account = ACCOUNTS[index];

  return (
    <div className="mt-4 rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
        style={{ color: "var(--color-ink)" }}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true">🔑</span> Check Demo Login Details
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="border-t px-4 py-4" style={{ borderColor: "var(--color-line)" }}>
          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
            Demo accounts for this build — swap the role, sign in, explore. Removed before real launch.
          </p>

          <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: "var(--color-paper)" }}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
                  {account.role}
                </p>
                <p className="font-mono text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  {account.email}
                </p>
              </div>
              <CopyButton value={account.email} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="font-mono text-sm" style={{ color: "var(--color-ink-soft)" }}>{DEMO_PASSWORD}</p>
              <CopyButton value={DEMO_PASSWORD} />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + ACCOUNTS.length) % ACCOUNTS.length)}
              aria-label="Previous account"
              className="flex h-7 w-7 items-center justify-center rounded-full border"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
            >
              ‹
            </button>
            <div className="flex gap-1.5">
              {ACCOUNTS.map((a, i) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${a.role} credentials`}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === index ? "1rem" : "0.375rem",
                    backgroundColor: i === index ? "var(--color-action)" : "var(--color-line)",
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % ACCOUNTS.length)}
              aria-label="Next account"
              className="flex h-7 w-7 items-center justify-center rounded-full border"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
