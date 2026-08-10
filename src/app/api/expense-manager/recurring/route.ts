import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";

// All UTC: new Date(y, m, d) builds a local date and toISOString()
// converts it back, landing a day early for any timezone ahead of UTC —
// in IST this set every new recurring template's first run one day
// before the day the user actually picked. Also clamps to the target
// month's last day so a 29/30/31 pick doesn't roll into the next month.
function nextRunDateFor(dayOfMonth: number, from = new Date()): string {
  const year = from.getUTCFullYear();
  const month = from.getUTCDate() > dayOfMonth ? from.getUTCMonth() + 1 : from.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(dayOfMonth, lastDay))).toISOString().slice(0, 10);
}

// GET /api/expense-manager/recurring?bookOwnerId=... — every standing
// monthly commitment (rent, salaries, subscriptions...) for a book.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bookOwnerId = searchParams.get("bookOwnerId") || profile.id;

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("expense_recurring_templates")
    .select("*, expense_categories(name)")
    .eq("book_owner_id", bookOwnerId)
    .order("next_run_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

// POST /api/expense-manager/recurring — Smart Automation #4: "Recurring
// Expenses... automatically create monthly entries." Gated to
// manage_accounts (owner/admin) — this is a standing commitment that'll
// keep moving money on its own every month without anyone re-approving
// it, so it gets the same trust bar as opening a bank account, not the
// day-to-day "add_expense" bar.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const {
    bookOwnerId: requestedBookOwnerId, transactionType, categoryId, description, amount, paymentMode, accountId, partyName, dayOfMonth,
  } = body ?? {};
  const bookOwnerId = requestedBookOwnerId || profile.id;

  if (transactionType !== "expense" && transactionType !== "income") {
    return NextResponse.json({ error: "transactionType must be 'expense' or 'income'" }, { status: 400 });
  }
  if (!categoryId) return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
  if (typeof amount !== "number" || amount <= 0) return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  if (!["bank", "cash", "upi", "cheque", "card"].includes(String(paymentMode))) return NextResponse.json({ error: "Invalid paymentMode" }, { status: 400 });
  if (paymentMode !== "cash" && !accountId) return NextResponse.json({ error: "accountId is required unless paymentMode is 'cash'" }, { status: 400 });
  const day = Number(dayOfMonth);
  if (!Number.isInteger(day) || day < 1 || day > 28) return NextResponse.json({ error: "dayOfMonth must be between 1 and 28" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "manage_accounts")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: bookProfile } = await supabase.from("expense_business_profiles").select("organization_id").eq("customer_id", bookOwnerId).single();
  if (!bookProfile) return NextResponse.json({ error: "Business profile not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("expense_recurring_templates")
    .insert({
      book_owner_id: bookOwnerId,
      organization_id: bookProfile.organization_id,
      transaction_type: transactionType,
      category_id: categoryId,
      description: description || null,
      amount,
      payment_mode: paymentMode,
      account_id: paymentMode === "cash" ? null : accountId,
      party_name: partyName || null,
      day_of_month: day,
      next_run_date: nextRunDateFor(day),
      created_by: profile.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, template: data }, { status: 201 });
}
