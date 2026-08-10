import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";
import { formatMoney } from "@/lib/currency";
import { toISTDateString } from "@/lib/ist-date";

// GET /api/expense-manager/summary?bookOwnerId=... — the Module 1
// dashboard numbers: bank/cash balances, this month's totals, net P/L,
// and a recent-transactions feed. Defaults to the caller's own books; a
// member with access to someone else's passes bookOwnerId.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bookOwnerId = searchParams.get("bookOwnerId") || profile.id;

  const supabase = getSupabaseAdmin();

  // A book that hasn't completed setup yet has no membership row for
  // anyone (setup is what creates the owner's row) — that's only ever
  // reachable for the caller's own id, so this falls back to the
  // "not set up" response rather than a 403 for that one specific case.
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access) {
    if (bookOwnerId === profile.id) return NextResponse.json({ ownerId: bookOwnerId, setupCompleted: false });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!hasPermission(access, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // "This month" means the IST calendar month — these books belong to
  // Indian businesses and transaction_date is a plain date column.
  // setHours(0,0,0,0) sets LOCAL midnight and toISOString() then
  // converts it back to UTC, which in IST resolved to the LAST DAY OF
  // THE PREVIOUS MONTH — so every "this month" figure on the dashboard
  // silently included one extra day of the month before.
  const todayIST = toISTDateString(new Date());
  const monthStart = `${todayIST.slice(0, 7)}-01`;

  const [{ data: businessProfile }, { data: accounts }, { data: monthTx }, { data: recent }, { count: pendingCount }] = await Promise.all([
    supabase.from("expense_business_profiles").select("*").eq("customer_id", bookOwnerId).maybeSingle(),
    // Every account, not just active ones — a closed account needs to
    // stay visible (with its final balance) so it can be reopened, and
    // so it isn't just silently unreachable from the UI. Its balance is
    // excluded from the KPI total below, but the row itself is shown.
    supabase.from("expense_accounts").select("*").eq("customer_id", bookOwnerId).order("created_at", { ascending: true }),
    supabase
      .from("expense_transactions")
      .select("transaction_type, amount, status")
      .eq("customer_id", bookOwnerId)
      .eq("status", "approved")
      .gte("transaction_date", monthStart),
    supabase
      .from("expense_transactions")
      .select("*, expense_categories(name)")
      .eq("customer_id", bookOwnerId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("expense_transactions").select("id", { count: "exact", head: true }).eq("customer_id", bookOwnerId).eq("status", "pending"),
  ]);

  // Every account, closed ones included. Closing is explicitly a
  // "drop out of the pay-from picker" flag, not a write-off — both the
  // API and the confirmation dialog promise the user "its balance stays
  // visible". Excluding it here broke that promise and made real money
  // silently vanish from the dashboard, while the balance-trend chart
  // (which reconstructs from opening balance + every transaction) kept
  // counting it, so the two disagreed the moment anyone closed an
  // account. The chart can't drop it either: removing a closed
  // account's history would retroactively rewrite every past month.
  const totalBankBalance = (accounts ?? []).reduce((sum, a) => sum + Number(a.current_balance), 0);
  const monthExpenses = (monthTx ?? []).filter((t) => t.transaction_type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const monthIncome = (monthTx ?? []).filter((t) => t.transaction_type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const cashBalance = Number(businessProfile?.cash_balance ?? 0);

  // Module 11 — computed on the fly rather than stored/dismissible
  // notifications; there's no read/unread state to manage, this just
  // reflects "is something true right now."
  const currency = businessProfile?.currency ?? "INR";
  const alerts: string[] = [];
  if (pendingCount) alerts.push(`${pendingCount} entr${pendingCount === 1 ? "y" : "ies"} awaiting your approval.`);
  if (businessProfile?.low_balance_threshold != null) {
    const threshold = Number(businessProfile.low_balance_threshold);
    if (cashBalance < threshold) alerts.push(`Cash balance (${formatMoney(cashBalance, currency)}) is below your ${formatMoney(threshold, currency)} alert threshold.`);
    for (const a of (accounts ?? []).filter((acc) => acc.is_active)) {
      if (Number(a.current_balance) < threshold) alerts.push(`${a.bank_name} — ${a.account_name} balance (${formatMoney(a.current_balance, currency)}) is below your ${formatMoney(threshold, currency)} alert threshold.`);
    }
  }
  // IST day/month too — on a UTC server these were a day behind for
  // anyone looking between IST midnight and 5:30 AM, so the month-end
  // and GST-deadline nudges fired on the wrong day.
  const [istYear, istMonth, istDay] = todayIST.split("-").map(Number);
  // A closed account holding money is almost always an unfinished job —
  // the balance should have been moved out before closing. Surfaced
  // rather than silently folded into the total.
  for (const a of (accounts ?? []).filter((acc) => !acc.is_active && Number(acc.current_balance) !== 0)) {
    alerts.push(
      `${a.bank_name} — ${a.account_name} is closed but still holds ${formatMoney(a.current_balance, currency)}. Transfer it out to keep your books tidy.`
    );
  }

  const dayOfMonth = istDay;
  const daysInMonth = new Date(Date.UTC(istYear, istMonth, 0)).getUTCDate();
  if (dayOfMonth >= daysInMonth - 2) alerts.push("The month is closing soon — a good time to review and close your books.");
  if (dayOfMonth >= 15 && dayOfMonth <= 20) alerts.push("GST returns are typically due around the 20th — check your GST Purchase Register.");

  return NextResponse.json({
    ownerId: bookOwnerId,
    currency,
    setupCompleted: Boolean(businessProfile?.setup_completed),
    role: access.role,
    permissions: access.permissions,
    approvalRequired: Boolean(businessProfile?.approval_required),
    lowBalanceThreshold: businessProfile?.low_balance_threshold != null ? Number(businessProfile.low_balance_threshold) : null,
    largeExpenseThreshold: businessProfile?.large_expense_threshold != null ? Number(businessProfile.large_expense_threshold) : null,
    pendingApprovalCount: pendingCount ?? 0,
    alerts,
    bankBalance: totalBankBalance,
    cashBalance,
    monthExpenses,
    monthIncome,
    netThisMonth: monthIncome - monthExpenses,
    accounts: accounts ?? [],
    recentTransactions: recent ?? [],
  });
}
