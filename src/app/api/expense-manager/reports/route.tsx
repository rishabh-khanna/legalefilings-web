import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";
import { formatMoney } from "@/lib/currency";
import { SITE_NAME } from "@/config/site";

type Row = (string | number)[];
type ReportShape = { title: string; headers: string[]; rows: Row[]; totals?: Row };

// Leading "#" row-number column — applied once here, right before a
// report leaves this route (JSON for the on-screen table, or CSV/PDF),
// so every report type gets it uniformly without each of the report
// builder functions above needing to know about it. The totals row (if
// any) gets a blank first cell instead of a number — it's a summary
// line, not a numbered record.
function withRowNumbers(report: ReportShape): ReportShape {
  return {
    ...report,
    headers: ["#", ...report.headers],
    rows: report.rows.map((row, i) => [i + 1, ...row]),
    totals: report.totals ? ["", ...report.totals] : undefined,
  };
}

type TxRow = {
  id: string;
  transaction_type: "expense" | "income";
  transaction_date: string;
  amount: number;
  payment_mode: string;
  account_id: string | null;
  party_name: string | null;
  description: string | null;
  reference_number: string | null;
  document_number: string | null;
  gst_applicable: boolean;
  gstin: string | null;
  taxable_value: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  tds_applicable: boolean;
  tds_section: string | null;
  tds_rate: number | null;
  tds_amount: number | null;
  expense_categories: { name: string } | null;
  expense_accounts: { bank_name: string; account_name: string } | null;
};

function matchesSearch(tx: TxRow, search: string) {
  const haystack = [
    tx.party_name, tx.description, tx.reference_number, tx.document_number,
    tx.expense_categories?.name, tx.payment_mode, tx.transaction_date, String(tx.amount),
    tx.expense_accounts?.bank_name, tx.expense_accounts?.account_name,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function dayBook(rows: TxRow[], currency: string): ReportShape {
  let expenseTotal = 0;
  let incomeTotal = 0;
  const body = rows.map((t) => {
    if (t.transaction_type === "expense") expenseTotal += Number(t.amount);
    else incomeTotal += Number(t.amount);
    return [
      t.transaction_date, t.transaction_type, t.expense_categories?.name ?? "—", t.party_name ?? "—",
      t.payment_mode, t.expense_accounts ? `${t.expense_accounts.bank_name} ${t.expense_accounts.account_name}` : "Cash", formatMoney(Number(t.amount), currency),
    ];
  });
  return {
    title: "Day Book",
    headers: ["Date", "Type", "Category", "Party", "Mode", "Account", "Amount"],
    rows: body,
    totals: ["", "", "", "", "", "Net", formatMoney(incomeTotal - expenseTotal, currency)],
  };
}

function ledger(rows: TxRow[], openingBalance: number, label: string, currency: string): ReportShape {
  const sorted = [...rows].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date) || a.id.localeCompare(b.id));
  let running = openingBalance;
  const body: Row[] = [["Opening Balance", "", "", "", "", formatMoney(running, currency)]];
  for (const t of sorted) {
    const delta = t.transaction_type === "income" ? Number(t.amount) : -Number(t.amount);
    running += delta;
    body.push([
      t.transaction_date, t.expense_categories?.name ?? "—", t.party_name ?? "—",
      t.transaction_type === "income" ? formatMoney(Number(t.amount), currency) : "", t.transaction_type === "expense" ? formatMoney(Number(t.amount), currency) : "",
      formatMoney(running, currency),
    ]);
  }
  return { title: `Ledger — ${label}`, headers: ["Date", "Category", "Party", "Credit", "Debit", "Balance"], rows: body };
}

function groupedReport(rows: TxRow[], groupBy: "category" | "vendor" | "bank", title: string, currency: string): ReportShape {
  const groups = new Map<string, { count: number; total: number }>();
  for (const t of rows) {
    const key =
      groupBy === "category" ? (t.expense_categories?.name ?? "Uncategorized")
      : groupBy === "vendor" ? (t.party_name ?? "Unknown")
      : t.expense_accounts ? `${t.expense_accounts.bank_name} — ${t.expense_accounts.account_name}` : "Cash";
    const entry = groups.get(key) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(t.amount);
    groups.set(key, entry);
  }
  const body = Array.from(groups.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, g]) => [name, g.count, formatMoney(g.total, currency)]);
  const grandTotal = Array.from(groups.values()).reduce((sum, g) => sum + g.total, 0);
  return { title, headers: [groupBy === "category" ? "Category" : groupBy === "vendor" ? "Vendor" : "Bank", "Entries", "Total"], rows: body, totals: ["", "Total", formatMoney(grandTotal, currency)] };
}

function periodSummary(rows: TxRow[], granularity: "month" | "year", currency: string): ReportShape {
  const groups = new Map<string, { income: number; expense: number }>();
  for (const t of rows) {
    const key = granularity === "month" ? t.transaction_date.slice(0, 7) : t.transaction_date.slice(0, 4);
    const entry = groups.get(key) ?? { income: 0, expense: 0 };
    if (t.transaction_type === "income") entry.income += Number(t.amount);
    else entry.expense += Number(t.amount);
    groups.set(key, entry);
  }
  const body = Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, g]) => [period, formatMoney(g.income, currency), formatMoney(g.expense, currency), formatMoney(g.income - g.expense, currency)]);
  return { title: granularity === "month" ? "Monthly Summary" : "Yearly Summary", headers: [granularity === "month" ? "Month" : "Year", "Income", "Expense", "Net"], rows: body };
}

function gstPurchaseRegister(rows: TxRow[], currency: string): ReportShape {
  const filtered = rows.filter((t) => t.transaction_type === "expense" && t.gst_applicable);
  const body = filtered.map((t) => [
    t.transaction_date, t.party_name ?? "—", t.gstin ?? "—", t.document_number ?? "—",
    formatMoney(Number(t.taxable_value ?? 0), currency), formatMoney(Number(t.cgst ?? 0), currency), formatMoney(Number(t.sgst ?? 0), currency), formatMoney(Number(t.igst ?? 0), currency), formatMoney(Number(t.amount), currency),
  ]);
  const total = filtered.reduce((sum, t) => sum + Number(t.amount), 0);
  return {
    title: "GST Purchase Register",
    headers: ["Date", "Vendor", "GSTIN", "Bill No.", "Taxable Value", "CGST", "SGST", "IGST", "Total"],
    rows: body,
    totals: ["", "", "", "", "", "", "", "Total", formatMoney(total, currency)],
  };
}

// GST Summary — the other half of GST Purchase Register: Output GST
// (GST charged on income/sales) minus Input GST (GST paid on expenses)
// = what's actually owed or reclaimable, using the same per-transaction
// GST fields already captured on both sides.
function gstSummary(rows: TxRow[], currency: string): ReportShape {
  const gstRows = rows.filter((t) => t.gst_applicable);
  const outputGst = gstRows.filter((t) => t.transaction_type === "income");
  const inputGst = gstRows.filter((t) => t.transaction_type === "expense");
  const sumTax = (list: TxRow[]) => list.reduce((sum, t) => sum + Number(t.cgst ?? 0) + Number(t.sgst ?? 0) + Number(t.igst ?? 0), 0);
  const outputTotal = sumTax(outputGst);
  const inputTotal = sumTax(inputGst);
  return {
    title: "GST Summary",
    headers: ["", "Entries", "Taxable Value", "GST Amount"],
    rows: [
      ["Output GST (on income)", outputGst.length, formatMoney(outputGst.reduce((s, t) => s + Number(t.taxable_value ?? 0), 0), currency), formatMoney(outputTotal, currency)],
      ["Input GST (on expenses)", inputGst.length, formatMoney(inputGst.reduce((s, t) => s + Number(t.taxable_value ?? 0), 0), currency), formatMoney(inputTotal, currency)],
    ],
    totals: ["", "", outputTotal - inputTotal >= 0 ? "Net Payable" : "Net Refundable", formatMoney(Math.abs(outputTotal - inputTotal), currency)],
  };
}

// Profit & Loss — income by category, expenses by category, net at the
// bottom. Straightforward given the underlying data; the only real
// design choice was putting both sides in one table instead of two
// separate reports, which is how a P&L actually reads.
function profitAndLoss(rows: TxRow[], currency: string): ReportShape {
  const group = (list: TxRow[]) => {
    const m = new Map<string, number>();
    for (const t of list) {
      const key = t.expense_categories?.name ?? "Uncategorized";
      m.set(key, (m.get(key) ?? 0) + Number(t.amount));
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };
  const income = group(rows.filter((t) => t.transaction_type === "income"));
  const expense = group(rows.filter((t) => t.transaction_type === "expense"));
  const totalIncome = income.reduce((s, [, v]) => s + v, 0);
  const totalExpense = expense.reduce((s, [, v]) => s + v, 0);

  const body: Row[] = [["Income", "", ""]];
  for (const [name, amt] of income) body.push(["", name, formatMoney(amt, currency)]);
  body.push(["", "Total Income", formatMoney(totalIncome, currency)]);
  body.push(["Expenses", "", ""]);
  for (const [name, amt] of expense) body.push(["", name, formatMoney(amt, currency)]);
  body.push(["", "Total Expenses", formatMoney(totalExpense, currency)]);

  return {
    title: "Profit & Loss Statement",
    headers: ["", "Category", "Amount"],
    rows: body,
    totals: ["", "Net Profit / (Loss)", formatMoney(totalIncome - totalExpense, currency)],
  };
}

// TDS Report — vendor + section + rate for every expense that had TDS
// deducted, so it's ready to hand to whoever's filing the TDS return.
function tdsReport(rows: TxRow[], currency: string): ReportShape {
  const filtered = rows.filter((t) => t.transaction_type === "expense" && t.tds_applicable);
  const body = filtered.map((t) => [
    t.transaction_date, t.party_name ?? "—", t.tds_section ?? "—", t.tds_rate != null ? `${t.tds_rate}%` : "—",
    formatMoney(Number(t.amount), currency), formatMoney(Number(t.tds_amount ?? 0), currency),
  ]);
  const total = filtered.reduce((sum, t) => sum + Number(t.tds_amount ?? 0), 0);
  return {
    title: "TDS Report",
    headers: ["Date", "Vendor", "Section", "Rate", "Gross Amount", "TDS Deducted"],
    rows: body,
    totals: ["", "", "", "", "Total TDS", formatMoney(total, currency)],
  };
}

function toCsvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
function toCsv(report: ReportShape) {
  const lines = [report.headers, ...report.rows];
  if (report.totals) lines.push(report.totals);
  return lines.map((row) => row.map((cell) => toCsvCell(String(cell))).join(",")).join("\n");
}

const pdfStyles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: "#0f172a" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#5b6b81", marginBottom: 16 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e8ecf2", paddingVertical: 5 },
  th: { fontSize: 9, fontWeight: 700, flex: 1 },
  td: { fontSize: 9, flex: 1 },
  totalsRow: { flexDirection: "row", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#0f172a" },
});

// report.rows/totals are built once via formatMoney() and shared with
// the CSV/JSON paths below, where ₹ is correct (Unicode-safe formats).
// Only the PDF path needs the ASCII-safe swap, since @react-pdf/renderer's
// default font (Helvetica, a fixed PDF Standard 14 font with no custom
// font registered here) has no glyph for ₹ — added to Unicode in 2010,
// decades after that font's fixed glyph set was defined. Cheaper to
// sanitize right here at the render boundary than to thread a
// PDF-vs-CSV distinction through every formatMoney call above.
function pdfSafe(value: string | number): string {
  return String(value).replace(/₹/g, "Rs. ").replace(/−/g, "-");
}

function ReportPdf({ report }: { report: ReportShape }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page} orientation="landscape">
        <Text style={pdfStyles.title}>{SITE_NAME}</Text>
        <Text style={pdfStyles.subtitle}>{report.title}</Text>
        <View style={pdfStyles.tr}>
          {report.headers.map((h, i) => (
            <Text key={i} style={pdfStyles.th}>{h}</Text>
          ))}
        </View>
        {report.rows.map((row, i) => (
          <View key={i} style={pdfStyles.tr}>
            {row.map((cell, j) => (
              <Text key={j} style={pdfStyles.td}>{pdfSafe(cell)}</Text>
            ))}
          </View>
        ))}
        {report.totals && (
          <View style={pdfStyles.totalsRow}>
            {report.totals.map((cell, i) => (
              <Text key={i} style={{ fontSize: 9, fontWeight: 700, flex: 1 }}>{pdfSafe(cell)}</Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

// GET /api/expense-manager/reports — Module 8/9/10: every named report in
// the spec maps onto one of a handful of real computations (day book,
// ledger, grouped totals, period summary, GST register) rather than 11
// near-duplicate code paths — the dropdown label is what varies, not the
// underlying query.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bookOwnerId = searchParams.get("bookOwnerId") || profile.id;
  const reportType = searchParams.get("reportType") ?? "day_book";
  const transactionTypeParam = searchParams.get("transactionType");
  const accountId = searchParams.get("accountId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search") ?? "";
  const format = searchParams.get("format") ?? "json";

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  const requiredPermission = format === "json" ? "view_reports" : "download_reports";
  if (!access || !hasPermission(access, requiredPermission)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: currencyProfile } = await supabase.from("expense_business_profiles").select("currency, cash_balance, cash_opening_balance").eq("customer_id", bookOwnerId).single();
  const currency = currencyProfile?.currency ?? "INR";

  // Balance Sheet is a snapshot of *current* balances, not a
  // date-ranged list of transactions — handled separately from
  // everything else here, which all reads from the filtered rows query
  // below. Deliberately scoped to cash/bank only and labeled as such —
  // this module doesn't track loans, fixed assets, or receivables/
  // payables, so presenting this as a complete balance sheet would be
  // misleading; it's exactly what it says it is, nothing more.
  if (reportType === "balance_sheet") {
    // Closed accounts included. Closing an account is a "keep it out of
    // the pay-from picker" flag — the API and the confirm dialog both
    // promise the balance stays visible — so omitting it from a balance
    // sheet understates assets the business genuinely holds. That is the
    // one thing a balance sheet must not do. Labelled so the reader can
    // see which accounts are closed rather than being quietly counted.
    const { data: accounts } = await supabase
      .from("expense_accounts")
      .select("bank_name, account_name, current_balance, is_active")
      .eq("customer_id", bookOwnerId);
    const body: Row[] = (accounts ?? []).map((a) => [
      `${a.bank_name} — ${a.account_name}${a.is_active ? "" : " (closed)"}`,
      formatMoney(Number(a.current_balance), currency),
    ]);
    body.push(["Cash", formatMoney(Number(currencyProfile?.cash_balance ?? 0), currency)]);
    const total = (accounts ?? []).reduce((s, a) => s + Number(a.current_balance), 0) + Number(currencyProfile?.cash_balance ?? 0);
    const report: ReportShape = withRowNumbers({
      title: "Balance Sheet (Cash & Bank Basis) — as of today",
      headers: ["Account", "Balance"],
      rows: body,
      totals: ["Total Assets (cash & bank only)", formatMoney(total, currency)],
    });
    if (format === "csv") {
      return new NextResponse(toCsv(report), { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="Balance-Sheet.csv"` } });
    }
    if (format === "pdf") {
      const buffer = await renderToBuffer(<ReportPdf report={report} />);
      return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Balance-Sheet.pdf"` } });
    }
    return NextResponse.json(report);
  }

  let query = supabase
    .from("expense_transactions")
    .select("*, expense_categories(name), expense_accounts(bank_name, account_name)")
    .eq("customer_id", bookOwnerId)
    .eq("status", "approved")
    .order("transaction_date", { ascending: false });
  if (transactionTypeParam === "expense" || transactionTypeParam === "income") query = query.eq("transaction_type", transactionTypeParam);
  if (from) query = query.gte("transaction_date", from);
  if (to) query = query.lte("transaction_date", to);
  if (reportType === "ledger" && accountId && accountId !== "cash") query = query.eq("account_id", accountId);
  if (reportType === "ledger" && accountId === "cash") query = query.eq("payment_mode", "cash");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data ?? []) as unknown as TxRow[];
  if (search.trim()) rows = rows.filter((t) => matchesSearch(t, search.trim()));

  let report: ReportShape;
  switch (reportType) {
    case "ledger": {
      let openingBalance = 0;
      let label = "Cash";
      if (accountId && accountId !== "cash") {
        const { data: account } = await supabase.from("expense_accounts").select("opening_balance, bank_name, account_name").eq("id", accountId).eq("customer_id", bookOwnerId).single();
        openingBalance = Number(account?.opening_balance ?? 0);
        label = account ? `${account.bank_name} — ${account.account_name}` : "Account";
      } else {
        openingBalance = Number(currencyProfile?.cash_opening_balance ?? 0);
      }

      // The account's own opening_balance is only the right starting
      // point when `rows` covers every transaction since account
      // creation. The moment a `from` filter excludes earlier ones (the
      // Reports page defaults to "This Month"), the running balance
      // needs to carry forward whatever happened before that date too —
      // otherwise every row's balance is silently wrong the instant an
      // account has any history before the filtered window.
      if (from) {
        let priorQuery = supabase
          .from("expense_transactions")
          .select("transaction_type, amount")
          .eq("customer_id", bookOwnerId)
          .eq("status", "approved")
          .lt("transaction_date", from);
        priorQuery = accountId && accountId !== "cash" ? priorQuery.eq("account_id", accountId) : priorQuery.eq("payment_mode", "cash");
        const { data: priorTx } = await priorQuery;
        for (const t of priorTx ?? []) {
          openingBalance += t.transaction_type === "income" ? Number(t.amount) : -Number(t.amount);
        }
      }

      report = ledger(rows, openingBalance, label, currency);
      break;
    }
    case "category_wise":
      report = groupedReport(rows, "category", "Category-wise Report", currency);
      break;
    case "vendor_wise":
      report = groupedReport(rows, "vendor", "Vendor-wise Report", currency);
      break;
    case "bank_wise":
      report = groupedReport(rows, "bank", "Bank-wise Report", currency);
      break;
    case "monthly_summary":
      report = periodSummary(rows, "month", currency);
      break;
    case "yearly_summary":
      report = periodSummary(rows, "year", currency);
      break;
    case "gst_purchase_register":
      report = gstPurchaseRegister(rows, currency);
      break;
    case "gst_summary":
      report = gstSummary(rows, currency);
      break;
    case "profit_and_loss":
      report = profitAndLoss(rows, currency);
      break;
    case "tds_report":
      report = tdsReport(rows, currency);
      break;
    case "day_book":
    default:
      report = dayBook(rows, currency);
      break;
  }
  report = withRowNumbers(report);

  if (format === "csv") {
    return new NextResponse(toCsv(report), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${report.title.replace(/\s+/g, "-")}.csv"` },
    });
  }
  if (format === "pdf") {
    const buffer = await renderToBuffer(<ReportPdf report={report} />);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${report.title.replace(/\s+/g, "-")}.pdf"` },
    });
  }

  return NextResponse.json(report);
}
