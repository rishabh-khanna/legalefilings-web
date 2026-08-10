import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";
import { toISTDateString } from "@/lib/ist-date";

// GET /api/expense-manager/charts?bookOwnerId=&months=6 — Module 13's
// dashboard charts, computed from the same transaction history every
// other report reads. Bank Balance Trend isn't a stored time series
// (only the current balance is) — it's reconstructed by starting from
// the account+cash opening balances and walking every approved
// transaction forward in date order, same running-balance approach the
// Ledger report uses, just combined across every account and cash.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bookOwnerId = searchParams.get("bookOwnerId") || profile.id;
  const months = Math.min(Number(searchParams.get("months") ?? 6), 24);

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Anchored to the IST calendar month and built in UTC. The previous
  // version mutated a local Date and then serialised it with
  // toISOString(), so the range boundary shifted by a day depending on
  // what time of day the page was opened — transactions on that
  // boundary were double-counted into the opening balance or dropped
  // from the chart entirely, intermittently.
  const [istY, istM] = toISTDateString(new Date()).split("-").map(Number);
  const rangeStart = new Date(Date.UTC(istY, istM - 1 - (months - 1), 1));
  const rangeStartStr = rangeStart.toISOString().slice(0, 10);

  const [{ data: accounts }, { data: businessProfile }, { data: priorTx }, { data: rangeTx }] = await Promise.all([
    supabase.from("expense_accounts").select("opening_balance").eq("customer_id", bookOwnerId),
    supabase.from("expense_business_profiles").select("cash_opening_balance").eq("customer_id", bookOwnerId).single(),
    supabase
      .from("expense_transactions")
      .select("transaction_type, amount")
      .eq("customer_id", bookOwnerId)
      .eq("status", "approved")
      .lt("transaction_date", rangeStartStr),
    supabase
      .from("expense_transactions")
      .select("transaction_type, amount, transaction_date, expense_categories(name)")
      .eq("customer_id", bookOwnerId)
      .eq("status", "approved")
      .gte("transaction_date", rangeStartStr)
      .order("transaction_date", { ascending: true }),
  ]);

  const baseBalance =
    (accounts ?? []).reduce((s, a) => s + Number(a.opening_balance), 0) +
    Number(businessProfile?.cash_opening_balance ?? 0) +
    (priorTx ?? []).reduce((s, t) => s + (t.transaction_type === "income" ? Number(t.amount) : -Number(t.amount)), 0);

  const monthKeys: string[] = [];
  for (let i = 0; i < months; i++) {
    // Built from UTC parts rather than mutating a Date with local
    // setMonth — mixing the two is what produced the boundary drift
    // above, and month keys must line up exactly with the YYYY-MM slice
    // of transaction_date used to bucket rows below.
    const d = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth() + i, 1));
    monthKeys.push(d.toISOString().slice(0, 7));
  }

  const monthlyTrend = new Map<string, { income: number; expense: number }>();
  for (const key of monthKeys) monthlyTrend.set(key, { income: 0, expense: 0 });

  let running = baseBalance;
  const balanceByMonth = new Map<string, number>();
  for (const t of (rangeTx ?? []) as { transaction_type: "expense" | "income"; amount: number; transaction_date: string }[]) {
    const key = t.transaction_date.slice(0, 7);
    const entry = monthlyTrend.get(key);
    if (entry) {
      if (t.transaction_type === "income") entry.income += Number(t.amount);
      else entry.expense += Number(t.amount);
    }
    running += t.transaction_type === "income" ? Number(t.amount) : -Number(t.amount);
    balanceByMonth.set(key, running);
  }

  let lastKnownBalance = baseBalance;
  const bankBalanceTrend = monthKeys.map((key) => {
    if (balanceByMonth.has(key)) lastKnownBalance = balanceByMonth.get(key)!;
    return { month: key, balance: lastKnownBalance };
  });

  const monthlyExpenses = monthKeys.map((key) => ({ month: key, expense: monthlyTrend.get(key)!.expense }));
  const incomeVsExpense = monthKeys.map((key) => ({ month: key, income: monthlyTrend.get(key)!.income, expense: monthlyTrend.get(key)!.expense }));
  const cashFlow = monthKeys.map((key) => ({ month: key, net: monthlyTrend.get(key)!.income - monthlyTrend.get(key)!.expense }));

  const categoryTotals = new Map<string, number>();
  for (const t of (rangeTx ?? []) as unknown as { transaction_type: string; amount: number; expense_categories: { name: string } | null }[]) {
    if (t.transaction_type !== "expense") continue;
    const name = t.expense_categories?.name ?? "Uncategorized";
    categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + Number(t.amount));
  }
  const categoryBreakdown = Array.from(categoryTotals.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

  return NextResponse.json({
    monthlyExpenses,
    incomeVsExpense,
    cashFlow,
    bankBalanceTrend,
    categoryBreakdown,
    topCategories: categoryBreakdown.slice(0, 5),
  });
}
