"use client";

import { useState } from "react";

// Demo-only — for reviewing this build before real customer accounts
// exist. Opt-IN via NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS="true" — fails
// closed by default (unset, misconfigured, or any other value all hide
// it) rather than failing open, since this panel hands out a real
// account's password to anyone who opens /login. Never set this var to
// "true" in production — better yet, delete this component and its
// usage entirely before go-live. The account below comes from
// scripts/seed-crm-customer-demo.mjs.
const DEMO_PASSWORD = "Demo@12345";
const ACCOUNTS = [
  {
    email: "crm.customer@legalefilings.com",
    role: "Paid Customer — full CRM access (Leads, Invoice CRM, Team Attendance, Team Leave, Employees, Payroll) delegated without ever being promoted to admin",
    group: "CRM Demo Workspace",
  },
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

  if (process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== "true") return null;

  const groups: { name: string; accounts: typeof ACCOUNTS }[] = [];
  for (const account of ACCOUNTS) {
    const existing = groups.find((g) => g.name === account.group);
    if (existing) existing.accounts.push(account);
    else groups.push({ name: account.group, accounts: [account] });
  }

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
        <div className="max-h-[70vh] overflow-y-auto border-t px-4 py-4" style={{ borderColor: "var(--color-line)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
              Every demo account for this build — sign in, explore. Removed before real launch.
            </p>
            <CopyButton value={DEMO_PASSWORD} />
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>
            Password for all of them: <span className="font-mono font-semibold" style={{ color: "var(--color-ink)" }}>{DEMO_PASSWORD}</span>
          </p>

          <div className="mt-3 space-y-4">
            {groups.map((group) => (
              <div key={group.name}>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-action-dark)" }}>
                  {group.name}
                </p>
                <div className="mt-1.5 space-y-1.5">
                  {group.accounts.map((account) => (
                    <div key={account.email} className="rounded-xl p-3" style={{ backgroundColor: "var(--color-paper)" }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
                            {account.role}
                          </p>
                          <p className="truncate font-mono text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                            {account.email}
                          </p>
                        </div>
                        <CopyButton value={account.email} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
