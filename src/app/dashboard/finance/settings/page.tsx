"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { BookSwitcher } from "@/components/finance/BookSwitcher";

// Approval workflow toggle + the two Module 11 alert thresholds. Owner/
// admin only (the API enforces manage_users) — reachable via the
// "Settings" link on the finance page, which only shows for that role.
export default function FinanceSettingsPage() {
  const [bookOwnerId, setBookOwnerId] = useState<string | null>(null);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState("");
  const [largeExpenseThreshold, setLargeExpenseThreshold] = useState("");
  const [saved, setSaved] = useState(false);

  async function loadSettings(ownerId: string) {
    const res = await fetch(`/api/expense-manager/summary?bookOwnerId=${ownerId}`);
    const data = await res.json();
    if (res.ok) {
      setApprovalRequired(Boolean(data.approvalRequired));
      setLowBalanceThreshold(data.lowBalanceThreshold != null ? String(data.lowBalanceThreshold) : "");
      setLargeExpenseThreshold(data.largeExpenseThreshold != null ? String(data.largeExpenseThreshold) : "");
    }
  }

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/expense-manager/my-books");
      const data = await res.json();
      if (res.ok) {
        const books = data.books ?? [];
        const own = books.find((b: { isOwn: boolean }) => b.isOwn) ?? books[0];
        if (own) {
          setBookOwnerId(own.bookOwnerId);
          loadSettings(own.bookOwnerId);
        }
      }
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!bookOwnerId) return;
    setSaved(false);
    const res = await fetch("/api/expense-manager/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookOwnerId,
        approvalRequired,
        lowBalanceThreshold: lowBalanceThreshold ? Number(lowBalanceThreshold) : null,
        largeExpenseThreshold: largeExpenseThreshold ? Number(largeExpenseThreshold) : null,
      }),
    });
    if (res.ok) setSaved(true);
  }

  const inputClass = "w-full max-w-xs rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  return (
    <div>
      <DashboardPageHero title="Finance Settings" subtitle="Approval rules and alert thresholds for these books.">
        <Link href="/dashboard/finance" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Business Finance
        </Link>
      </DashboardPageHero>

      {bookOwnerId && (
        <BookSwitcher
          bookOwnerId={bookOwnerId}
          onChange={(id) => {
            setBookOwnerId(id);
            loadSettings(id);
          }}
        />
      )}

      <form onSubmit={handleSave} className="max-w-lg space-y-6 rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={approvalRequired} onChange={(e) => setApprovalRequired(e.target.checked)} className="h-4 w-4" />
            <span className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>Require approval for entries added by Employees</span>
          </label>
          <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>
            When on, an Employee&apos;s entry sits as &quot;Pending&quot; until an Owner/Admin approves it — only approved entries affect balances and reports. Accountants and Admins are never held for approval.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-ink)" }}>Low Balance Alert Threshold</label>
          <input type="number" min={0} step="0.01" placeholder="e.g. 10000" value={lowBalanceThreshold} onChange={(e) => setLowBalanceThreshold(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>You&apos;ll see a dashboard alert whenever cash or any bank account drops below this. Leave blank to turn off.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-ink)" }}>Large Expense Alert Threshold</label>
          <input type="number" min={0} step="0.01" placeholder="e.g. 50000" value={largeExpenseThreshold} onChange={(e) => setLargeExpenseThreshold(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>Any expense above this amount gets flagged in the Activity log. Leave blank to turn off.</p>
        </div>

        {saved && <p className="text-sm" style={{ color: "var(--color-success)" }}>Settings saved.</p>}

        <button type="submit" className="rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>
          Save Settings
        </button>
      </form>
    </div>
  );
}
