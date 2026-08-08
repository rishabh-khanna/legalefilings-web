"use client";

import { useState } from "react";
import { CURRENCIES } from "@/lib/currency";

const BUSINESS_TYPES: { value: string; label: string }[] = [
  { value: "proprietorship", label: "Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "llp", label: "LLP" },
  { value: "private_limited", label: "Private Limited" },
  { value: "ngo", label: "NGO" },
  { value: "trust", label: "Trust" },
  { value: "individual", label: "Individual" },
];

type BankRow = { bankName: string; accountName: string; openingBalance: string; openingDate: string };

const emptyBank = (): BankRow => ({ bankName: "", accountName: "", openingBalance: "", openingDate: new Date().toISOString().slice(0, 10) });

function financialYearOptions(): string[] {
  const now = new Date();
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  // A couple of years back (for catching up on unrecorded history) through
  // one year ahead (for setting up early) — a free-text field let people
  // type anything, including years that don't make sense here.
  const years: string[] = [];
  for (let y = currentFyStart - 2; y <= currentFyStart + 1; y++) {
    years.push(`${y}-${String((y + 1) % 100).padStart(2, "0")}`);
  }
  return years;
}

function defaultFinancialYear() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

// Module 2 — first-time setup. Kept as one scrollable form with clear
// sections rather than a multi-step wizard with forward/back — every
// field here is quick to fill and nothing depends on a prior step's
// answer, so paging would just add clicks without adding clarity.
export function FinanceSetupWizard({ onComplete }: { onComplete: () => void }) {
  const [businessType, setBusinessType] = useState("proprietorship");
  const [financialYear, setFinancialYear] = useState(defaultFinancialYear());
  const [currency, setCurrency] = useState("INR");
  const [cashOpeningBalance, setCashOpeningBalance] = useState("");
  const [banks, setBanks] = useState<BankRow[]>([emptyBank()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateBank(index: number, patch: Partial<BankRow>) {
    setBanks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // A row with only one of bank name / account name filled in used to
    // just get silently dropped on submit — someone who typed a bank
    // name, got distracted, and hit "Complete Setup" would have no idea
    // that bank never actually got saved. Block instead of silently
    // discarding, since this only fires when there's genuinely
    // incomplete input to point at.
    const incompleteIndex = banks.findIndex((b) => Boolean(b.bankName) !== Boolean(b.accountName));
    if (incompleteIndex !== -1) {
      setError(`Bank #${incompleteIndex + 1} needs both a bank name and an account name — or clear both to skip it.`);
      return;
    }

    setSubmitting(true);

    const res = await fetch("/api/expense-manager/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessType,
        financialYear,
        currency,
        cashOpeningBalance: cashOpeningBalance ? Number(cashOpeningBalance) : 0,
        accounts: banks
          .filter((b) => b.bankName && b.accountName)
          .map((b) => ({ bankName: b.bankName, accountName: b.accountName, openingBalance: b.openingBalance ? Number(b.openingBalance) : 0, openingDate: b.openingDate })),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      onComplete();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save setup.");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-sm font-medium mb-1";

  return (
    // Capped width rather than stretching to fill the dashboard's wide
    // content column — a handful of short fields spanning the full
    // available width just reads as an oddly sparse, unbalanced form.
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
      <div>
        <h2 className="text-lg font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
          Set up your Business Finance workspace
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
          A few quick details, then you&apos;re ready to start recording expenses and income.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass} style={{ color: "var(--color-ink)" }}>Business Type</label>
          <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} style={{ color: "var(--color-ink)" }}>Financial Year</label>
          <select value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            {financialYearOptions().map((fy) => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} style={{ color: "var(--color-ink)" }}>Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.symbol.trim()} {c.code} — {c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} style={{ color: "var(--color-ink)" }}>Opening Cash Balance</label>
        <input type="number" min={0} step="0.01" value={cashOpeningBalance} onChange={(e) => setCashOpeningBalance(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)", maxWidth: 240 }} placeholder="0" />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Bank Accounts (optional)</p>
        </div>
        <div className="mt-3 space-y-3">
          {banks.map((bank, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-2 rounded-xl border p-3" style={{ borderColor: "var(--color-line)" }}>
              <input placeholder="Bank Name (e.g. HDFC)" value={bank.bankName} onChange={(e) => updateBank(i, { bankName: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              <input placeholder="Account Name" value={bank.accountName} onChange={(e) => updateBank(i, { accountName: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              <input type="number" min={0} step="0.01" placeholder="Opening Balance" value={bank.openingBalance} onChange={(e) => updateBank(i, { openingBalance: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              <input type="date" value={bank.openingDate} onChange={(e) => updateBank(i, { openingDate: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setBanks((prev) => [...prev, emptyBank()])}
          className="mt-3 text-sm font-medium"
          style={{ color: "var(--color-action-dark)" }}
        >
          + Add Another Bank
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: "#b42318" }}>{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "var(--color-action)" }}
      >
        {submitting ? "Setting up…" : "Finish Setup"}
      </button>
    </form>
  );
}
