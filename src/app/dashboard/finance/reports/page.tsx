"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileDown } from "lucide-react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { BookSwitcher } from "@/components/finance/BookSwitcher";
import { LoadingBlock } from "@/components/Spinner";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { currentFinancialYearStart, financialYearOptions, financialYearRange } from "@/lib/financial-year";

type Account = { id: string; bank_name: string; account_name: string };
type ReportShape = { title: string; headers: string[]; rows: (string | number)[][]; totals?: (string | number)[] };

const REPORT_OPTIONS: { value: string; label: string; transactionType?: "expense" | "income"; needsAccount?: boolean }[] = [
  { value: "day_book", label: "Day Book" },
  { value: "day_book", label: "Expense Register", transactionType: "expense" },
  { value: "day_book", label: "Monthly Expense Report", transactionType: "expense" },
  { value: "ledger", label: "Ledger", needsAccount: true },
  { value: "ledger", label: "Cash Book" },
  { value: "category_wise", label: "Category-wise Expense", transactionType: "expense" },
  { value: "vendor_wise", label: "Vendor-wise Expense", transactionType: "expense" },
  { value: "bank_wise", label: "Bank-wise Expense", transactionType: "expense" },
  { value: "monthly_summary", label: "Monthly Summary" },
  { value: "yearly_summary", label: "Yearly Summary" },
  { value: "gst_purchase_register", label: "GST Purchase Register" },
  { value: "gst_summary", label: "GST Summary (Output vs Input)" },
  { value: "tds_report", label: "TDS Report" },
  { value: "profit_and_loss", label: "Profit & Loss Statement" },
  { value: "balance_sheet", label: "Balance Sheet (Cash & Bank)" },
];

type DatePreset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "financial_year" | "custom";

function computeRange(preset: DatePreset, fyStartYear: number): { from: string; to: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  switch (preset) {
    case "today":
      return { from: fmt(startOfDay(now)), to: fmt(startOfDay(now)) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: fmt(startOfDay(y)), to: fmt(startOfDay(y)) };
    }
    case "this_week": {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      return { from: fmt(startOfDay(start)), to: fmt(startOfDay(now)) };
    }
    case "last_week": {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay() - 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { from: fmt(startOfDay(start)), to: fmt(startOfDay(end)) };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(start), to: fmt(startOfDay(now)) };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(start), to: fmt(end) };
    }
    case "financial_year":
      return financialYearRange(fyStartYear);
    default:
      return { from: "", to: "" };
  }
}

export default function FinanceReportsPage() {
  const [bookOwnerId, setBookOwnerId] = useState<string | null>(null);
  const [reportIndex, setReportIndex] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("cash");
  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [fyStartYear, setFyStartYear] = useState(currentFinancialYearStart());
  const [search, setSearch] = useState("");
  const [report, setReport] = useState<ReportShape | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = REPORT_OPTIONS[reportIndex];
  const range = preset === "custom" ? { from: customFrom, to: customTo } : computeRange(preset, fyStartYear);

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
      const res = await fetch(`/api/expense-manager/accounts?bookOwnerId=${bookOwnerId}`);
      const data = await res.json();
      if (res.ok) setAccounts(data.accounts ?? []);
    }, 0);
    return () => clearTimeout(kickoff);
  }, [bookOwnerId]);

  const buildQuery = useCallback(
    (format: "json" | "csv" | "pdf") => {
      if (!bookOwnerId) return "";
      const params = new URLSearchParams({ bookOwnerId, reportType: selected.value, format });
      if (selected.transactionType) params.set("transactionType", selected.transactionType);
      if (selected.needsAccount || selected.label === "Cash Book") params.set("accountId", selected.label === "Cash Book" ? "cash" : accountId);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      if (search.trim()) params.set("search", search.trim());
      return `/api/expense-manager/reports?${params.toString()}`;
    },
    [bookOwnerId, selected, accountId, range.from, range.to, search]
  );

  const runReport = useCallback(async () => {
    if (!bookOwnerId) return;
    setLoading(true);
    const res = await fetch(buildQuery("json"));
    const data = await res.json();
    setLoading(false);
    if (res.ok) setReport(data);
  }, [buildQuery, bookOwnerId]);

  useEffect(() => {
    if (!bookOwnerId) return;
    if (preset === "custom" && (!customFrom || !customTo)) return;
    const kickoff = setTimeout(runReport, 0);
    return () => clearTimeout(kickoff);
  }, [runReport, preset, customFrom, customTo, bookOwnerId]);

  const inputClass = "rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const presets: { value: DatePreset; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "this_week", label: "This Week" },
    { value: "last_week", label: "Last Week" },
    { value: "this_month", label: "This Month" },
    { value: "last_month", label: "Last Month" },
    { value: "financial_year", label: "Financial Year" },
    { value: "custom", label: "Custom" },
  ];

  const { page, setPage, pageSize, setPageSize, pageItems: pagedRows, totalPages, total, start, end } = usePagination(report?.rows ?? []);

  return (
    <div>
      <DashboardPageHero title="Finance Reports" subtitle="Every report over your recorded expenses and income — export as PDF or CSV (opens directly in Excel).">
        <Link href="/dashboard/finance" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Business Finance
        </Link>
      </DashboardPageHero>

      {bookOwnerId && <BookSwitcher bookOwnerId={bookOwnerId} onChange={setBookOwnerId} />}

      <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Report</label>
            <select value={reportIndex} onChange={(e) => setReportIndex(Number(e.target.value))} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
              {REPORT_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </div>

          {selected.needsAccount && (
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                <option value="cash">Cash</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.bank_name} — {a.account_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} onBlur={runReport} placeholder="Vendor, amount, invoice no…" className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPreset(p.value)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              style={preset === p.value ? { backgroundColor: "var(--color-action)", color: "#fff" } : { border: "1px solid var(--color-line)", color: "var(--color-ink-soft)" }}
            >
              {p.label}
            </button>
          ))}
          {preset === "financial_year" && (
            <select
              value={fyStartYear}
              onChange={(e) => setFyStartYear(Number(e.target.value))}
              className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
            >
              {financialYearOptions().map((fy) => (
                <option key={fy.startYear} value={fy.startYear}>{fy.label}</option>
              ))}
            </select>
          )}
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              <span className="text-sm" style={{ color: "var(--color-ink-soft)" }}>to</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <a
              href={buildQuery("pdf")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white/70 px-3 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
            >
              <FileDown className="h-4 w-4" /> PDF
            </a>
            <a
              href={buildQuery("csv")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white/70 px-3 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
            >
              <Download className="h-4 w-4" /> CSV
            </a>
          </div>
        </div>
      </div>

      {report && report.rows.length > 0 && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          start={start}
          end={end}
          total={total}
          itemLabel="rows"
        />
      )}

      <div className="mt-3 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        {loading ? (
          <LoadingBlock className="py-6" />
        ) : !report || report.rows.length === 0 ? (
          <p className="p-6 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No data for this selection.</p>
        ) : (
          <table className="dt-table w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
                {report.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-semibold" style={{ color: "var(--color-ink)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
              {pagedRows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2" style={{ color: "var(--color-ink-soft)" }}>{cell}</td>
                  ))}
                </tr>
              ))}
              {report.totals && (
                <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
                  {report.totals.map((cell, j) => (
                    <td key={j} className="px-3 py-2 font-semibold" style={{ color: "var(--color-ink)" }}>{cell}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
