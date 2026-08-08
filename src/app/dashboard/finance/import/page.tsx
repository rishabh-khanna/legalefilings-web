"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { BookSwitcher } from "@/components/finance/BookSwitcher";
import { LoadingBlock } from "@/components/Spinner";

type Account = { id: string; bank_name: string; account_name: string; is_active: boolean };
type Category = { id: string; name: string };
type ImportableInvoice = { id: string; invoiceNumber: string; total: number; paidAt: string; issuerName: string };

function money(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

// Phase 5 — a Legal Efilings/tenant-org invoice this customer already
// paid is a real business expense of theirs; this turns one into an
// actual Business Finance expense entry instead of making them retype
// it from a PDF. See /api/expense-manager/transactions/import-invoice.
export default function FinanceImportPage() {
  const [bookOwnerId, setBookOwnerId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<ImportableInvoice[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rowState, setRowState] = useState<Record<string, { categoryId: string; paymentMode: string; accountId: string }>>({});
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async (ownerId: string) => {
    const res = await fetch(`/api/expense-manager/importable-invoices?bookOwnerId=${ownerId}`);
    const data = await res.json();
    if (res.ok) setInvoices(data.invoices ?? []);
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
      loadInvoices(bookOwnerId);
      const [accountsRes, categoriesRes] = await Promise.all([
        fetch(`/api/expense-manager/accounts?bookOwnerId=${bookOwnerId}`),
        fetch(`/api/expense-manager/categories?bookOwnerId=${bookOwnerId}&type=expense`),
      ]);
      const accountsData = await accountsRes.json();
      if (accountsRes.ok) setAccounts(accountsData.accounts ?? []);
      const categoriesData = await categoriesRes.json();
      if (categoriesRes.ok) setCategories(categoriesData.categories ?? []);
    }, 0);
    return () => clearTimeout(kickoff);
  }, [bookOwnerId, loadInvoices]);

  function updateRow(id: string, patch: Partial<{ categoryId: string; paymentMode: string; accountId: string }>) {
    setRowState((prev) => {
      const current = prev[id] ?? { categoryId: "", paymentMode: "bank", accountId: "" };
      return { ...prev, [id]: { ...current, ...patch } };
    });
  }

  async function handleImport(invoiceId: string) {
    if (!bookOwnerId) return;
    const state = rowState[invoiceId] ?? { categoryId: "", paymentMode: "bank", accountId: "" };
    if (state.paymentMode !== "cash" && !state.accountId) {
      setError("Choose which account this was paid from, or switch to Cash.");
      return;
    }
    setError(null);
    setImportingId(invoiceId);
    const res = await fetch("/api/expense-manager/transactions/import-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookOwnerId,
        invoiceId,
        categoryId: state.categoryId || undefined,
        paymentMode: state.paymentMode,
        accountId: state.paymentMode === "cash" ? undefined : state.accountId,
      }),
    });
    const data = await res.json();
    setImportingId(null);
    if (res.ok) {
      loadInvoices(bookOwnerId);
    } else {
      setError(data.error ?? "Failed to import.");
    }
  }

  const inputClass = "rounded-lg border px-2 py-1.5 text-xs outline-none focus:border-[var(--color-action)]";

  return (
    <div>
      <DashboardPageHero title="Import from Invoices" subtitle="Your paid Legal Efilings / service invoices — bring them into your Business Finance books as expenses instead of retyping them.">
        <Link href="/dashboard/finance" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Business Finance
        </Link>
      </DashboardPageHero>

      {bookOwnerId && <BookSwitcher bookOwnerId={bookOwnerId} onChange={setBookOwnerId} />}

      {error && <p className="mb-4 text-sm" style={{ color: "#b42318" }}>{error}</p>}

      <div className="space-y-3">
        {invoices === null ? (
          <LoadingBlock />
        ) : invoices.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Nothing to import — every paid invoice is already in your books, or you have none yet.</p>
        ) : (
          invoices.map((inv) => {
            const state = rowState[inv.id] ?? { categoryId: "", paymentMode: "bank", accountId: "" };
            return (
              <div key={inv.id} className="rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium" style={{ color: "var(--color-ink)" }}>{inv.invoiceNumber} — {inv.issuerName}</p>
                    <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Paid {new Date(inv.paidAt).toLocaleDateString("en-IN")}</p>
                  </div>
                  <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{money(inv.total)}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select value={state.categoryId} onChange={(e) => updateRow(inv.id, { categoryId: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                    <option value="">Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <select value={state.paymentMode} onChange={(e) => updateRow(inv.id, { paymentMode: e.target.value, accountId: "" })} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                    <option value="bank">Bank</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Card</option>
                  </select>
                  {state.paymentMode !== "cash" && (
                    <select value={state.accountId} onChange={(e) => updateRow(inv.id, { accountId: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                      <option value="">Paid from…</option>
                      {accounts.filter((a) => a.is_active).map((a) => (
                        <option key={a.id} value={a.id}>{a.bank_name} — {a.account_name}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => handleImport(inv.id)}
                    disabled={importingId === inv.id}
                    className="rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: "var(--color-action)" }}
                  >
                    {importingId === inv.id ? "Importing…" : "Import as Expense"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
