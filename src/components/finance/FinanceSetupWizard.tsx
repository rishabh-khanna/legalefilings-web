"use client";

import { useState } from "react";
import { CURRENCIES } from "@/lib/currency";
import { RequiredMark } from "@/components/RequiredMark";
import { financialYearOptions, defaultFinancialYear } from "@/lib/financial-year";

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

function FieldGroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-action-dark)" }}>
      {children}
    </p>
  );
}

// Module 2 — first-time setup. One scrollable form with clear sections
// rather than a multi-step wizard with forward/back — every field here
// is quick to fill and nothing depends on a prior step's answer, so
// paging would just add clicks without adding clarity. Full-width
// sectioned cards (not a single narrow floating card) since this is
// the entire page's content until setup is done, not a modal — it
// should read as a complete page, not a small dialog stranded in a lot
// of empty space.
export function FinanceSetupWizard({ onComplete }: { onComplete: () => void }) {
  const [businessType, setBusinessType] = useState("proprietorship");
  const [financialYear, setFinancialYear] = useState(defaultFinancialYear());
  const [currency, setCurrency] = useState("INR");
  const [cashOpeningBalance, setCashOpeningBalance] = useState("");
  const [banks, setBanks] = useState<BankRow[]>([emptyBank()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  function updateBank(index: number, patch: Partial<BankRow>) {
    setBanks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function removeBank(index: number) {
    setBanks((prev) => (prev.length === 1 ? [emptyBank()] : prev.filter((_, i) => i !== index)));
  }

  const cashBalanceInvalid = cashOpeningBalance.trim() !== "" && (Number.isNaN(Number(cashOpeningBalance)) || Number(cashOpeningBalance) < 0);

  // A bank row counts as "in use" once either name field has real
  // (non-whitespace) content — that's when its other fields become
  // required too, rather than a blank template row blocking submission.
  function bankRowIssues(b: BankRow): string[] {
    const nameFilled = b.bankName.trim().length > 0;
    const accountFilled = b.accountName.trim().length > 0;
    if (!nameFilled && !accountFilled) return [];
    const issues: string[] = [];
    if (!nameFilled) issues.push("bank name");
    if (!accountFilled) issues.push("account name");
    if (b.openingBalance.trim() !== "" && (Number.isNaN(Number(b.openingBalance)) || Number(b.openingBalance) < 0)) issues.push("a valid opening balance");
    if (!b.openingDate) issues.push("an opening date");
    return issues;
  }

  const bankErrors = banks.map((b, i) => ({ index: i, issues: bankRowIssues(b) })).filter((r) => r.issues.length > 0);

  const formValid = !cashBalanceInvalid && bankErrors.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);

    if (cashBalanceInvalid) {
      setError("Opening Cash Balance can't be negative.");
      return;
    }
    if (bankErrors.length > 0) {
      const first = bankErrors[0];
      setError(`Bank #${first.index + 1} is missing ${first.issues.join(", ")} — fill it in or clear the row entirely to skip it.`);
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
          .filter((b) => b.bankName.trim() && b.accountName.trim())
          .map((b) => ({ bankName: b.bankName.trim(), accountName: b.accountName.trim(), openingBalance: b.openingBalance ? Number(b.openingBalance) : 0, openingDate: b.openingDate })),
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
  const invalidBorder = { borderColor: "#f0b4ab" };
  const validBorder = { borderColor: "var(--color-line)" };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
            Set up your Business Finance workspace
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            A few quick details, then you&apos;re ready to start recording expenses and income.
          </p>
        </div>
        <p className="shrink-0 text-xs" style={{ color: "var(--color-ink-soft)" }}>
          <span style={{ color: "#b42318" }}>*</span> Required
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <FieldGroupTitle>Business Details</FieldGroupTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Business Type<RequiredMark /></label>
            <select required value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputClass} style={validBorder}>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Financial Year<RequiredMark /></label>
            <select required value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} className={inputClass} style={validBorder}>
              {financialYearOptions().map((fy) => (
                <option key={fy.label} value={fy.label}>{fy.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Currency<RequiredMark /></label>
            <select required value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass} style={validBorder}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.symbol.trim()} {c.code} — {c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <FieldGroupTitle>Opening Balances</FieldGroupTitle>
        <div className="max-w-xs">
          <label className={labelClass} style={{ color: "var(--color-ink)" }}>Opening Cash Balance</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={cashOpeningBalance}
            onChange={(e) => setCashOpeningBalance(e.target.value)}
            className={inputClass}
            style={touched && cashBalanceInvalid ? invalidBorder : validBorder}
            placeholder="0"
          />
          {touched && cashBalanceInvalid && <p className="mt-1 text-xs" style={{ color: "#b42318" }}>Can&apos;t be negative.</p>}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <FieldGroupTitle>Bank Accounts (optional)</FieldGroupTitle>
        <div className="space-y-3">
          {banks.map((bank, i) => {
            const issues = touched ? bankRowIssues(bank) : [];
            return (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: "var(--color-line)" }}>
                <div className="grid gap-3 sm:grid-cols-4">
                  <input
                    placeholder="Bank Name (e.g. HDFC)"
                    value={bank.bankName}
                    onChange={(e) => updateBank(i, { bankName: e.target.value })}
                    className={inputClass}
                    style={issues.includes("bank name") ? invalidBorder : validBorder}
                  />
                  <input
                    placeholder="Account Name"
                    value={bank.accountName}
                    onChange={(e) => updateBank(i, { accountName: e.target.value })}
                    className={inputClass}
                    style={issues.includes("account name") ? invalidBorder : validBorder}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Opening Balance"
                    value={bank.openingBalance}
                    onChange={(e) => updateBank(i, { openingBalance: e.target.value })}
                    className={inputClass}
                    style={issues.includes("a valid opening balance") ? invalidBorder : validBorder}
                  />
                  <input
                    type="date"
                    value={bank.openingDate}
                    onChange={(e) => updateBank(i, { openingDate: e.target.value })}
                    className={inputClass}
                    style={issues.includes("an opening date") ? invalidBorder : validBorder}
                  />
                </div>
                {(bank.bankName.trim() || bank.accountName.trim() || banks.length > 1) && (
                  <button type="button" onClick={() => removeBank(i)} className="mt-2 text-xs font-medium" style={{ color: "#b42318" }}>
                    Remove this bank
                  </button>
                )}
              </div>
            );
          })}
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
        disabled={submitting || (touched && !formValid)}
        className="rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "var(--color-action)" }}
      >
        {submitting ? "Setting up…" : "Finish Setup"}
      </button>
    </form>
  );
}
