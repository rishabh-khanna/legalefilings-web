"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { BookSwitcher } from "@/components/finance/BookSwitcher";
import { formatMoney } from "@/lib/currency";
import { LoadingBlock } from "@/components/Spinner";

type Category = { id: string; name: string; transaction_type: "expense" | "income" };
type BudgetRow = { id: string; categoryId: string; categoryName: string; monthlyAmount: number; actual: number; remaining: number; percentUsed: number };

function barColor(percentUsed: number) {
  if (percentUsed >= 100) return "#b42318";
  if (percentUsed >= 80) return "#8a6700";
  return "#116a2c";
}

// Smart Automation #8 — "set monthly budgets by category and compare
// actual spending against them." One flat cap per category (see the
// migration's own note on why it's not a per-month row), checked
// against whichever month is selected.
export default function FinanceBudgetsPage() {
  const [bookOwnerId, setBookOwnerId] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [budgets, setBudgets] = useState<BudgetRow[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | undefined>(undefined);
  const [permissions, setPermissions] = useState<string[]>([]);
  const canManage = permissions.includes("manage_accounts");
  const money = (n: number) => formatMoney(n, currency);

  const loadBudgets = useCallback(async (ownerId: string, m: string) => {
    const res = await fetch(`/api/expense-manager/budgets?bookOwnerId=${ownerId}&month=${m}`);
    const data = await res.json();
    if (res.ok) setBudgets(data.budgets ?? []);
  }, []);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/expense-manager/my-books");
      const data = await res.json();
      if (res.ok) {
        const books = data.books ?? [];
        const own = books.find((b: { isOwn: boolean }) => b.isOwn) ?? books[0];
        if (own) setBookOwnerId(own.bookOwnerId);
      }
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  useEffect(() => {
    if (!bookOwnerId) return;
    const kickoff = setTimeout(async () => {
      loadBudgets(bookOwnerId, month);
      const [categoriesRes, summaryRes] = await Promise.all([
        fetch(`/api/expense-manager/categories?bookOwnerId=${bookOwnerId}&type=expense`),
        fetch(`/api/expense-manager/summary?bookOwnerId=${bookOwnerId}`),
      ]);
      const data = await categoriesRes.json();
      if (categoriesRes.ok) setCategories(data.categories ?? []);
      const summaryData = await summaryRes.json();
      if (summaryRes.ok) {
        setCurrency(summaryData.currency);
        setPermissions(summaryData.permissions ?? []);
      }
    }, 0);
    return () => clearTimeout(kickoff);
  }, [bookOwnerId, month, loadBudgets]);

  async function handleSetBudget(e: React.FormEvent) {
    e.preventDefault();
    if (!bookOwnerId) return;
    setError(null);
    const res = await fetch("/api/expense-manager/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookOwnerId, categoryId, monthlyAmount: Number(amount) }),
    });
    const data = await res.json();
    if (res.ok) {
      setCategoryId("");
      setAmount("");
      loadBudgets(bookOwnerId, month);
    } else {
      setError(data.error ?? "Failed to save.");
    }
  }

  async function handleDelete(id: string, categoryName: string) {
    if (!bookOwnerId) return;
    if (!window.confirm(`Remove the budget for "${categoryName}"? This can't be undone.`)) return;
    await fetch(`/api/expense-manager/budgets/${id}`, { method: "DELETE" });
    loadBudgets(bookOwnerId, month);
  }

  const inputClass = "rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const budgetedCategoryIds = new Set((budgets ?? []).map((b) => b.categoryId));

  return (
    <div>
      <DashboardPageHero title="Budgets" subtitle="Set a monthly cap per category and see how you're tracking against it.">
        <Link href="/dashboard/finance" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Business Finance
        </Link>
      </DashboardPageHero>

      {bookOwnerId && <BookSwitcher bookOwnerId={bookOwnerId} onChange={setBookOwnerId} />}

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>Month</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
      </div>

      {canManage ? (
        <form onSubmit={handleSetBudget} className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Category</label>
            <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{budgetedCategoryIds.has(c.id) ? " (already budgeted)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Monthly Cap</label>
            <input required type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <button type="submit" className="rounded-full px-5 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>Set Budget</button>
          {error && <p className="text-sm" style={{ color: "#b42318" }}>{error}</p>}
        </form>
      ) : (
        <p className="mb-6 rounded-2xl border bg-white p-4 text-sm dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}>
          Only the book&apos;s owner or admin can set budgets — you can view how spending tracks against them below.
        </p>
      )}

      <div className="space-y-3">
        {budgets === null ? (
          <LoadingBlock />
        ) : budgets.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No budgets set for this month.</p>
        ) : (
          budgets.map((b) => (
            <div key={b.id} className="rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
              <div className="flex items-center justify-between">
                <p className="font-medium" style={{ color: "var(--color-ink)" }}>{b.categoryName}</p>
                <div className="flex items-center gap-3">
                  <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>{money(b.actual)} of {money(b.monthlyAmount)}</p>
                  {canManage && (
                    <button type="button" onClick={() => handleDelete(b.id, b.categoryName)} className="text-xs font-medium" style={{ color: "#b42318" }}>Remove</button>
                  )}
                </div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-muted-tint)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(b.percentUsed, 100)}%`, backgroundColor: barColor(b.percentUsed) }} />
              </div>
              <p className="mt-1 text-xs" style={{ color: b.remaining < 0 ? "#b42318" : "var(--color-ink-soft)" }}>
                {b.remaining < 0 ? `₹${Math.abs(b.remaining).toLocaleString("en-IN")} over budget` : `₹${b.remaining.toLocaleString("en-IN")} remaining`}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
