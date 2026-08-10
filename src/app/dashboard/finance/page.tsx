"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Landmark, TrendingDown, TrendingUp, IndianRupee, FileText, Plus, Users, History, Repeat, Target, Settings, AlertTriangle, Check, X } from "lucide-react";
import { DashboardPageHero, HeroAction, HeroKpi } from "@/components/crm/DashboardPageHero";
import { RequiredMark } from "@/components/RequiredMark";
import { FinanceSetupWizard } from "@/components/finance/FinanceSetupWizard";
import { AddTransactionModal, type EditableTransaction } from "@/components/finance/AddTransactionModal";
import { TransactionDocumentsDrawer } from "@/components/finance/TransactionDocumentsDrawer";
import { BookSwitcher } from "@/components/finance/BookSwitcher";
import { FinanceCharts } from "@/components/finance/FinanceCharts";
import { formatMoney } from "@/lib/currency";
import { LoadingBlock } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

type Account = { id: string; bank_name: string; account_name: string; current_balance: number; opening_balance: number; is_active: boolean };
type Transaction = EditableTransaction & {
  transaction_type: "expense" | "income";
  status: "pending" | "approved" | "rejected";
  expense_categories: { name: string } | null;
};

type ChartData = {
  monthlyExpenses: { month: string; expense: number }[];
  incomeVsExpense: { month: string; income: number; expense: number }[];
  cashFlow: { month: string; net: number }[];
  bankBalanceTrend: { month: string; balance: number }[];
  categoryBreakdown: { category: string; amount: number }[];
  topCategories: { category: string; amount: number }[];
};

type Summary = {
  ownerId?: string;
  currency?: string;
  setupCompleted: boolean;
  role?: string;
  permissions?: string[];
  alerts?: string[];
  pendingApprovalCount?: number;
  bankBalance: number;
  cashBalance: number;
  monthExpenses: number;
  monthIncome: number;
  netThisMonth: number;
  accounts: Account[];
  recentTransactions: Transaction[];
};

export default function FinancePage() {
  const router = useRouter();
  const [bookOwnerId, setBookOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("all");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [addModal, setAddModal] = useState<"expense" | "income" | null>(null);
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBank, setNewBank] = useState({ bankName: "", accountName: "", openingBalance: "", openingDate: new Date().toISOString().slice(0, 10) });
  const [activeDocTransaction, setActiveDocTransaction] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountEditName, setAccountEditName] = useState({ bankName: "", accountName: "" });

  const loadSummary = useCallback(async (ownerId: string) => {
    const res = await fetch(`/api/expense-manager/summary?bookOwnerId=${ownerId}`);
    const data = await res.json();
    if (res.ok) setSummary(data);
    setLoading(false);
  }, []);

  const loadTransactions = useCallback(async (ownerId: string, type: "all" | "expense" | "income", pending: boolean) => {
    const qs = new URLSearchParams({ bookOwnerId: ownerId });
    if (type !== "all") qs.set("type", type);
    if (pending) qs.set("status", "pending");
    const res = await fetch(`/api/expense-manager/transactions?${qs.toString()}`);
    const data = await res.json();
    if (res.ok) setTransactions(data.transactions ?? []);
  }, []);

  // Checks /my-books first rather than assuming "own id" — a Legal
  // Efilings/tenant staff member invited onto a customer's books as an
  // accountant has none of their own, and landing them on their own
  // (nonexistent) setup wizard instead of the client's books they were
  // actually invited to see would defeat the point of Module 12's
  // accountant-access feature. Only falls through to "my own id" (and
  // the setup wizard, for a first-time customer) when there's truly
  // nothing else to show.
  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const booksRes = await fetch("/api/expense-manager/my-books");
      const booksData = await booksRes.json();
      const books = booksRes.ok ? (booksData.books ?? []) : [];
      const preferred = books.find((b: { isOwn: boolean }) => b.isOwn) ?? books[0];
      const ownerId = preferred?.bookOwnerId ?? null;

      const res = await fetch(ownerId ? `/api/expense-manager/summary?bookOwnerId=${ownerId}` : "/api/expense-manager/summary");
      const data = await res.json();
      if (res.ok) {
        setSummary(data);
        setBookOwnerId(data.ownerId ?? null);
      }
      setLoading(false);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  useEffect(() => {
    if (!bookOwnerId || !summary?.setupCompleted) return;
    const kickoff = setTimeout(() => loadTransactions(bookOwnerId, typeFilter, pendingOnly), 0);
    return () => clearTimeout(kickoff);
  }, [bookOwnerId, summary?.setupCompleted, typeFilter, pendingOnly, loadTransactions]);

  useEffect(() => {
    if (!bookOwnerId || !summary?.setupCompleted) return;
    const kickoff = setTimeout(async () => {
      const res = await fetch(`/api/expense-manager/charts?bookOwnerId=${bookOwnerId}`);
      const data = await res.json();
      if (res.ok) setChartData(data);
    }, 0);
    return () => clearTimeout(kickoff);
  }, [bookOwnerId, summary?.setupCompleted]);

  function handleSwitchBook(id: string) {
    setBookOwnerId(id);
    setLoading(true);
    loadSummary(id);
  }

  async function handleAddBank(e: React.FormEvent) {
    e.preventDefault();
    if (!bookOwnerId) return;
    const res = await fetch("/api/expense-manager/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookOwnerId,
        bankName: newBank.bankName,
        accountName: newBank.accountName,
        openingBalance: newBank.openingBalance ? Number(newBank.openingBalance) : 0,
        openingDate: newBank.openingDate,
      }),
    });
    if (res.ok) {
      setShowAddBank(false);
      setNewBank({ bankName: "", accountName: "", openingBalance: "", openingDate: new Date().toISOString().slice(0, 10) });
      loadSummary(bookOwnerId);
    }
  }

  function handleTransactionSaved() {
    if (!bookOwnerId) return;
    loadSummary(bookOwnerId);
    loadTransactions(bookOwnerId, typeFilter, pendingOnly);
  }

  async function handleReview(id: string, decision: "approve" | "reject") {
    if (!bookOwnerId) return;
    await fetch(`/api/expense-manager/transactions/${id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    loadSummary(bookOwnerId);
    loadTransactions(bookOwnerId, typeFilter, pendingOnly);
  }

  async function handleDeleteTransaction(id: string) {
    if (!bookOwnerId) return;
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    await fetch(`/api/expense-manager/transactions/${id}`, { method: "DELETE" });
    loadSummary(bookOwnerId);
    loadTransactions(bookOwnerId, typeFilter, pendingOnly);
  }

  async function handleToggleAccountActive(account: Account) {
    if (!bookOwnerId) return;
    if (account.is_active && !window.confirm(`Close ${account.bank_name} — ${account.account_name}? Its balance stays visible, but it can't be selected for new entries until reopened.`)) return;
    await fetch(`/api/expense-manager/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !account.is_active }),
    });
    loadSummary(bookOwnerId);
  }

  async function handleSaveAccountEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookOwnerId || !editingAccount) return;
    await fetch(`/api/expense-manager/accounts/${editingAccount.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankName: accountEditName.bankName, accountName: accountEditName.accountName }),
    });
    setEditingAccount(null);
    loadSummary(bookOwnerId);
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-sm font-medium mb-1";
  const can = (p: string) => summary?.permissions?.includes(p) ?? false;
  const money = (n: number) => formatMoney(n, summary?.currency);

  // Module 9 — "search anything" over the currently loaded list
  // (vendor, amount, date, category, payment mode, reference/document
  // number). The full Reports page does the same search server-side
  // over a much larger export window; this is the quick day-to-day
  // filter on the dashboard's own recent-transactions view.
  function transactionSearchText(t: Transaction) {
    return [
      t.party_name, t.description, t.reference_number, t.document_number,
      t.expense_categories?.name, t.payment_mode, t.transaction_date, String(t.amount),
    ].filter(Boolean).join(" ");
  }

  const transactionColumns: DataTableColumn<Transaction>[] = [
    { key: "date", header: "Date", className: "w-[10%] whitespace-nowrap", render: (t) => new Date(t.transaction_date).toLocaleDateString("en-IN"), exportValue: (t) => new Date(t.transaction_date).toLocaleDateString("en-IN"), sortValue: (t) => t.transaction_date },
    { key: "category", header: "Category", render: (t) => <span style={{ color: "var(--color-ink)" }}>{t.expense_categories?.name ?? "—"}</span>, exportValue: (t) => t.expense_categories?.name ?? "", sortValue: (t) => t.expense_categories?.name },
    { key: "party", header: "Party", render: (t) => t.party_name ?? "—", exportValue: (t) => t.party_name ?? "", sortValue: (t) => t.party_name },
    { key: "mode", header: "Mode", className: "w-[10%] whitespace-nowrap", render: (t) => <span className="capitalize">{t.payment_mode}</span>, exportValue: (t) => t.payment_mode, sortValue: (t) => t.payment_mode },
    {
      key: "amount",
      header: "Amount",
      className: "w-[12%] whitespace-nowrap",
      render: (t) => (
        <span className="font-semibold" style={{ color: t.transaction_type === "income" ? "#116a2c" : "#b42318" }}>
          {t.transaction_type === "income" ? "+" : "-"}{money(t.amount)}
        </span>
      ),
      exportValue: (t) => `${t.transaction_type === "income" ? "+" : "-"}${money(t.amount)}`,
      sortValue: (t) => Number(t.amount),
    },
    {
      key: "status",
      header: "Status",
      className: "w-[10%] whitespace-nowrap",
      render: (t) =>
        t.status === "pending" ? (
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "#fff6d9", color: "#8a6700" }}>Pending</span>
        ) : t.status === "rejected" ? (
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "#fde2e2", color: "#b42318" }}>Rejected</span>
        ) : (
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: "#d0f4db", color: "#116a2c" }}>Approved</span>
        ),
      exportValue: (t) => t.status,
      sortValue: (t) => t.status,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (t) => (
        <div className="flex items-center justify-end gap-2">
          {t.status === "pending" && can("delete_expense") && (
            <>
              <button type="button" onClick={() => handleReview(t.id, "approve")} aria-label="Approve" className="rounded-full p-1 transition-colors hover:bg-[var(--color-accent-tint)]">
                <Check className="h-3.5 w-3.5" style={{ color: "#116a2c" }} />
              </button>
              <button type="button" onClick={() => handleReview(t.id, "reject")} aria-label="Reject" className="rounded-full p-1 transition-colors hover:bg-[var(--color-accent-tint)]">
                <X className="h-3.5 w-3.5" style={{ color: "#b42318" }} />
              </button>
            </>
          )}
          {can("delete_expense") && (
            <>
              <button type="button" onClick={() => setEditingTransaction(t)} className="text-xs font-medium" style={{ color: "var(--color-action-dark)" }}>
                Edit
              </button>
              <button type="button" onClick={() => handleDeleteTransaction(t.id)} className="text-xs font-medium" style={{ color: "#b42318" }}>
                Delete
              </button>
            </>
          )}
          <button type="button" onClick={() => setActiveDocTransaction(t)} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--color-action-dark)" }}>
            <FileText className="h-3.5 w-3.5" /> Docs
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <LoadingBlock />;
  }

  if (!summary?.setupCompleted) {
    return (
      <div>
        <DashboardPageHero title="Business Finance" subtitle="Track every expense and rupee of income, your bank balances, and your cash book — all in one place." />
        <FinanceSetupWizard onComplete={() => bookOwnerId && loadSummary(bookOwnerId)} />
      </div>
    );
  }

  return (
    <div>
      <DashboardPageHero
        title="Business Finance"
        subtitle="Your expenses, income, bank balances, and cash book."
        action={
          can("add_expense") || can("manage_accounts") || can("manage_users") ? (
            // flex-wrap: up to 8 buttons can be visible at once now that
            // they're no longer collapsed behind "More" — wraps onto a
            // second row on narrower viewports instead of overflowing.
            <div className="flex flex-wrap gap-2">
              {can("add_expense") && (
                <>
                  <button
                    type="button"
                    onClick={() => setAddModal("expense")}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: "var(--color-action)" }}
                  >
                    <Plus className="h-4 w-4" /> Add Expense
                  </button>
                  <HeroAction icon={Plus} onClick={() => setAddModal("income")}>
                    Add Income
                  </HeroAction>
                </>
              )}
              {/* Reports moved into the sidebar nav (view_reports is the
                  one permission every book role has, so it's always
                  reachable there). Everything else here needs a
                  permission at least one role lacks — every item its own
                  button, each still gated on `can(...)` so a Viewer simply
                  doesn't see options they can't use, rather than
                  collapsed behind a "More" menu that hid what was
                  actually available. */}
              {can("add_expense") && (
                <HeroAction icon={FileText} onClick={() => router.push("/dashboard/finance/import")}>
                  Import from Invoices
                </HeroAction>
              )}
              {can("manage_accounts") && (
                <>
                  <HeroAction icon={Repeat} onClick={() => router.push("/dashboard/finance/recurring")}>
                    Recurring
                  </HeroAction>
                  <HeroAction icon={Target} onClick={() => router.push("/dashboard/finance/budgets")}>
                    Budgets
                  </HeroAction>
                </>
              )}
              {can("manage_users") && (
                <>
                  <HeroAction icon={Users} onClick={() => router.push("/dashboard/finance/team")}>
                    Team
                  </HeroAction>
                  <HeroAction icon={History} onClick={() => router.push("/dashboard/finance/activity")}>
                    Activity
                  </HeroAction>
                  <HeroAction icon={Settings} onClick={() => router.push("/dashboard/finance/settings")}>
                    Settings
                  </HeroAction>
                </>
              )}
            </div>
          ) : undefined
        }
      >
        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <HeroKpi icon={Landmark} label="Bank Balance" value={money(summary.bankBalance)} />
          <HeroKpi icon={Wallet} label="Cash Balance" value={money(summary.cashBalance)} />
          <HeroKpi icon={TrendingDown} label="Expenses This Month" value={money(summary.monthExpenses)} />
          <HeroKpi icon={TrendingUp} label="Income This Month" value={money(summary.monthIncome)} />
          <HeroKpi icon={IndianRupee} label="Net This Month" value={money(summary.netThisMonth)} />
        </div>
      </DashboardPageHero>

      {bookOwnerId && <BookSwitcher bookOwnerId={bookOwnerId} onChange={handleSwitchBook} />}

      {summary.alerts && summary.alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {summary.alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "#fde2e2", color: "#b42318" }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Bank Accounts</h2>
            {can("manage_accounts") && (
              <button type="button" onClick={() => setShowAddBank((s) => !s)} className="text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
                {showAddBank ? "Cancel" : "+ Add Bank"}
              </button>
            )}
          </div>

          {showAddBank && (
            <form onSubmit={handleAddBank} className="mt-3 grid gap-2 rounded-xl border p-3 sm:grid-cols-2" style={{ borderColor: "var(--color-line)" }}>
              <input required placeholder="Bank Name" value={newBank.bankName} onChange={(e) => setNewBank((p) => ({ ...p, bankName: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              <input required placeholder="Account Name" value={newBank.accountName} onChange={(e) => setNewBank((p) => ({ ...p, accountName: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              <input type="number" min={0} step="0.01" placeholder="Opening Balance" value={newBank.openingBalance} onChange={(e) => setNewBank((p) => ({ ...p, openingBalance: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              <input type="date" value={newBank.openingDate} onChange={(e) => setNewBank((p) => ({ ...p, openingDate: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className="rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>Save Bank</button>
                <button
                  type="button"
                  onClick={() => setShowAddBank(false)}
                  className="rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
                  style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <ul className="mt-3 space-y-3">
            {summary.accounts.length === 0 && <li className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No bank accounts yet.</li>}
            {summary.accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--color-line)", opacity: a.is_active ? 1 : 0.6 }}>
                <div>
                  <p className="font-medium" style={{ color: "var(--color-ink)" }}>{a.bank_name}{!a.is_active && " (Closed)"}</p>
                  <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>{a.account_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{money(a.current_balance)}</p>
                  {can("manage_accounts") && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAccount(a);
                          setAccountEditName({ bankName: a.bank_name, accountName: a.account_name });
                        }}
                        className="text-xs font-medium"
                        style={{ color: "var(--color-action-dark)" }}
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => handleToggleAccountActive(a)} className="text-xs font-medium" style={{ color: a.is_active ? "#b42318" : "#116a2c" }}>
                        {a.is_active ? "Close" : "Reopen"}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {editingAccount && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.45)" }} onClick={() => setEditingAccount(null)}>
            <form
              onSubmit={handleSaveAccountEdit}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-[var(--color-paper-raised)]"
              style={{ border: "1px solid var(--color-line)" }}
            >
              <h3 className="text-lg font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>Edit Bank Account</h3>
              <div className="mt-4 space-y-3">
                <div>
                  <label className={labelClass} style={{ color: "var(--color-ink)" }}>Bank Name<RequiredMark /></label>
                  <input required autoFocus value={accountEditName.bankName} onChange={(e) => setAccountEditName((p) => ({ ...p, bankName: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: "var(--color-ink)" }}>Account Name<RequiredMark /></label>
                  <input required value={accountEditName.accountName} onChange={(e) => setAccountEditName((p) => ({ ...p, accountName: e.target.value }))} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button type="submit" className="rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>Save</button>
                <button type="button" onClick={() => setEditingAccount(null)} className="rounded-full border px-4 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Cash Book</h2>
          <p className="mt-3 text-3xl font-extrabold" style={{ color: "var(--color-ink)" }}>{money(summary.cashBalance)}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>Current cash on hand — updates automatically with every cash expense or income entry.</p>
          {summary.role && (
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
              Your role: {summary.role}
            </p>
          )}
        </div>
      </div>

      {chartData && (
        <div className="mt-6">
          <h2 className="mb-3 font-semibold" style={{ color: "var(--color-ink)" }}>Trends</h2>
          <FinanceCharts {...chartData} currency={summary.currency} />
        </div>
      )}

      <div className="mt-6 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Transactions</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-full border p-1" style={{ borderColor: "var(--color-line)" }}>
              {(["all", "expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className="rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors"
                  style={typeFilter === t ? { backgroundColor: "var(--color-action)", color: "#fff" } : { color: "var(--color-ink-soft)" }}
                >
                  {t}
                </button>
              ))}
            </div>
            {can("delete_expense") && (summary.pendingApprovalCount ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => setPendingOnly((p) => !p)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
                style={pendingOnly ? { backgroundColor: "var(--color-action)", color: "#fff" } : { backgroundColor: "#fff6d9", color: "#8a6700" }}
              >
                {summary.pendingApprovalCount} awaiting approval
              </button>
            )}
          </div>
        </div>

        <DataTable
          columns={transactionColumns}
          fixedLayout
          rows={transactions ?? []}
          getRowKey={(t) => t.id}
          itemLabel="transactions"
          emptyMessage="No transactions yet."
          filteredEmptyMessage="No transactions match your filters."
          search={{ placeholder: "Search vendor, amount, category…", filter: (t, q) => transactionSearchText(t).toLowerCase().includes(q) }}
          dateFilter={{ getDate: (t) => t.transaction_date }}
          exportFilename="finance-transactions"
          minWidth={720}
        />
      </div>

      {addModal && bookOwnerId && (
        <AddTransactionModal
          transactionType={addModal}
          accounts={summary.accounts.filter((a) => a.is_active)}
          bookOwnerId={bookOwnerId}
          onClose={() => setAddModal(null)}
          onSaved={handleTransactionSaved}
        />
      )}

      {editingTransaction && bookOwnerId && (
        <AddTransactionModal
          key={editingTransaction.id}
          transactionType={editingTransaction.transaction_type}
          accounts={summary.accounts.filter((a) => a.is_active)}
          bookOwnerId={bookOwnerId}
          editing={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSaved={handleTransactionSaved}
        />
      )}

      <TransactionDocumentsDrawer
        transactionId={activeDocTransaction?.id ?? null}
        transactionLabel={activeDocTransaction ? `${activeDocTransaction.expense_categories?.name ?? activeDocTransaction.transaction_type} · ${money(activeDocTransaction.amount)}` : ""}
        onClose={() => setActiveDocTransaction(null)}
      />
    </div>
  );
}
