"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { RequiredMark } from "@/components/RequiredMark";
import { BookSwitcher } from "@/components/finance/BookSwitcher";
import { formatMoney } from "@/lib/currency";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useDateRangeFilter } from "@/lib/use-date-range-filter";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExportButton } from "@/components/ExportButton";

type Account = { id: string; bank_name: string; account_name: string; is_active: boolean };
type Category = { id: string; name: string; transaction_type: "expense" | "income" };
type Template = {
  id: string;
  transaction_type: "expense" | "income";
  description: string | null;
  amount: number;
  payment_mode: string;
  party_name: string | null;
  day_of_month: number;
  next_run_date: string;
  is_active: boolean;
  expense_categories: { name: string } | null;
};

// Smart Automation #4 — "automatically create monthly entries for rent,
// salaries, internet, software subscriptions, insurance..." The cron
// job that actually generates the transactions lives at
// /api/cron/expense-recurring; this page just manages the templates.
export default function FinanceRecurringPage() {
  const [bookOwnerId, setBookOwnerId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    transactionType: "expense" as "expense" | "income",
    categoryId: "",
    description: "",
    amount: "",
    paymentMode: "bank" as "bank" | "cash" | "upi" | "cheque" | "card",
    accountId: "",
    partyName: "",
    dayOfMonth: "1",
  });
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | undefined>(undefined);
  const [permissions, setPermissions] = useState<string[]>([]);
  const canManage = permissions.includes("manage_accounts");
  const money = (n: number) => formatMoney(n, currency);

  const loadTemplates = useCallback(async (ownerId: string) => {
    const res = await fetch(`/api/expense-manager/recurring?bookOwnerId=${ownerId}`);
    const data = await res.json();
    if (res.ok) setTemplates(data.templates ?? []);
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
      loadTemplates(bookOwnerId);
      const [accountsRes, categoriesRes, summaryRes] = await Promise.all([
        fetch(`/api/expense-manager/accounts?bookOwnerId=${bookOwnerId}`),
        fetch(`/api/expense-manager/categories?bookOwnerId=${bookOwnerId}`),
        fetch(`/api/expense-manager/summary?bookOwnerId=${bookOwnerId}`),
      ]);
      const accountsData = await accountsRes.json();
      if (accountsRes.ok) setAccounts(accountsData.accounts ?? []);
      const categoriesData = await categoriesRes.json();
      if (categoriesRes.ok) setCategories(categoriesData.categories ?? []);
      const summaryData = await summaryRes.json();
      if (summaryRes.ok) {
        setCurrency(summaryData.currency);
        setPermissions(summaryData.permissions ?? []);
      }
    }, 0);
    return () => clearTimeout(kickoff);
  }, [bookOwnerId, loadTemplates]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!bookOwnerId) return;
    if (!form.categoryId) {
      setError("Choose a category.");
      return;
    }
    setError(null);
    const res = await fetch("/api/expense-manager/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookOwnerId,
        transactionType: form.transactionType,
        categoryId: form.categoryId || undefined,
        description: form.description || undefined,
        amount: Number(form.amount),
        paymentMode: form.paymentMode,
        accountId: form.paymentMode === "cash" ? undefined : form.accountId,
        partyName: form.partyName || undefined,
        dayOfMonth: Number(form.dayOfMonth),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setShowForm(false);
      setForm({ transactionType: "expense", categoryId: "", description: "", amount: "", paymentMode: "bank", accountId: "", partyName: "", dayOfMonth: "1" });
      loadTemplates(bookOwnerId);
    } else {
      setError(data.error ?? "Failed to save.");
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    if (!bookOwnerId) return;
    await fetch(`/api/expense-manager/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    loadTemplates(bookOwnerId);
  }

  async function handleDelete(id: string, label: string) {
    if (!bookOwnerId) return;
    if (!window.confirm(`Delete the recurring template "${label}"? It won't post any further automatic entries. This can't be undone.`)) return;
    await fetch(`/api/expense-manager/recurring/${id}`, { method: "DELETE" });
    loadTemplates(bookOwnerId);
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const dateFilter = useDateRangeFilter(templates ?? [], (t) => t.next_run_date);
  const { page, setPage, pageSize, setPageSize, pageItems: pagedTemplates, totalPages, total, start, end } = usePagination(dateFilter.filtered);

  return (
    <div>
      <DashboardPageHero title="Recurring Expenses" subtitle="Rent, salaries, subscriptions — set them up once and they'll post automatically every month.">
        <Link href="/dashboard/finance" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Business Finance
        </Link>
      </DashboardPageHero>

      {bookOwnerId && <BookSwitcher bookOwnerId={bookOwnerId} onChange={setBookOwnerId} />}

      {canManage ? (
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="mb-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          {showForm ? "Cancel" : "+ New Recurring Entry"}
        </button>
      ) : (
        <p className="mb-4 rounded-2xl border bg-white p-4 text-sm dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}>
          Only the book&apos;s owner or admin can manage recurring entries — you can view the schedule below.
        </p>
      )}

      {canManage && showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-3 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <select value={form.transactionType} onChange={(e) => setForm((p) => ({ ...p, transactionType: e.target.value as "expense" | "income" }))} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Category<RequiredMark /></label>
            <select required value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
              <option value="">Select a category</option>
              {categories.filter((c) => c.transaction_type === form.transactionType).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <input required placeholder="Description (e.g. Office Rent)" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <input required type="number" min={0.01} step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <select value={form.paymentMode} onChange={(e) => setForm((p) => ({ ...p, paymentMode: e.target.value as typeof form.paymentMode }))} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="card">Card</option>
          </select>
          {form.paymentMode !== "cash" && (
            <select required value={form.accountId} onChange={(e) => setForm((p) => ({ ...p, accountId: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
              <option value="">Select account</option>
              {accounts.filter((a) => a.is_active).map((a) => (
                <option key={a.id} value={a.id}>{a.bank_name} — {a.account_name}</option>
              ))}
            </select>
          )}
          <input placeholder="Vendor / Party" value={form.partyName} onChange={(e) => setForm((p) => ({ ...p, partyName: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Day of month (1–28)</label>
            <input required type="number" min={1} max={28} value={form.dayOfMonth} onChange={(e) => setForm((p) => ({ ...p, dayOfMonth: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          {error && <p className="sm:col-span-3 text-sm" style={{ color: "#b42318" }}>{error}</p>}
          <button type="submit" className="sm:col-span-3 rounded-full py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>Save Recurring Entry</button>
        </form>
      )}

      <DateRangeFilter
        from={dateFilter.from}
        to={dateFilter.to}
        onFromChange={dateFilter.setFrom}
        onToChange={dateFilter.setTo}
        onClear={dateFilter.clear}
        active={dateFilter.active}
      />

      <div className="mt-3 flex justify-end">
        <ExportButton
          filename="recurring-expenses"
          headers={["Description", "Amount", "Next Run", "Status"]}
          rows={dateFilter.filtered.map((t) => [
            t.description ?? t.expense_categories?.name ?? "Recurring entry",
            money(t.amount),
            new Date(t.next_run_date).toLocaleDateString("en-IN"),
            t.is_active ? "Active" : "Paused",
          ])}
        />
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        start={start}
        end={end}
        total={total}
        itemLabel="recurring entries"
      />

      <div className="mt-3 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <table className="dt-table w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Description</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Amount</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Next Run</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Status</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {pagedTemplates.map((t, i) => (
              <tr key={t.id}>
                <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                <td className="px-4 py-3">
                  <p className="font-medium" style={{ color: "var(--color-ink)" }}>{t.description ?? t.expense_categories?.name ?? "Recurring entry"}</p>
                  <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>{t.party_name}</p>
                </td>
                <td className="px-4 py-3 font-semibold" style={{ color: t.transaction_type === "income" ? "#116a2c" : "#b42318" }}>{money(t.amount)}</td>
                <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{new Date(t.next_run_date).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => handleToggle(t.id, !t.is_active)}
                      className="rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={t.is_active ? { backgroundColor: "#d0f4db", color: "#116a2c" } : { backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}
                    >
                      {t.is_active ? "Active" : "Paused"}
                    </button>
                  ) : (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={t.is_active ? { backgroundColor: "#d0f4db", color: "#116a2c" } : { backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}
                    >
                      {t.is_active ? "Active" : "Paused"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <button type="button" onClick={() => handleDelete(t.id, t.description ?? t.expense_categories?.name ?? "this recurring entry")} className="text-xs font-medium" style={{ color: "#b42318" }}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {templates !== null && templates.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--color-ink-soft)" }}>No recurring entries yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
