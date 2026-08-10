import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";

// GET /api/expense-manager/budgets?bookOwnerId=...&month=YYYY-MM —
// Module 14: every category with a budget set, its cap, and actual
// spend for the given month (defaults to the current month).
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bookOwnerId = searchParams.get("bookOwnerId") || profile.id;
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: budgets, error } = await supabase
    .from("expense_budgets")
    .select("*, expense_categories(name)")
    .eq("book_owner_id", bookOwnerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!budgets || budgets.length === 0) return NextResponse.json({ budgets: [] });

  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  // Date.UTC, not new Date(y, m, ...) — the latter is local time and
  // toISOString() converts it back to UTC, which lands a day earlier for
  // any timezone ahead of UTC. As an exclusive month-end bound in IST
  // that silently dropped the last day of every month from the range.
  const monthEnd = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  const { data: monthTx } = await supabase
    .from("expense_transactions")
    .select("category_id, amount")
    .eq("customer_id", bookOwnerId)
    .eq("transaction_type", "expense")
    .eq("status", "approved")
    .gte("transaction_date", monthStart)
    .lt("transaction_date", monthEnd);

  const actualByCategory = new Map<string, number>();
  for (const t of monthTx ?? []) {
    if (!t.category_id) continue;
    actualByCategory.set(t.category_id, (actualByCategory.get(t.category_id) ?? 0) + Number(t.amount));
  }

  return NextResponse.json({
    month,
    budgets: budgets.map((b) => {
      const actual = actualByCategory.get(b.category_id) ?? 0;
      return {
        id: b.id,
        categoryId: b.category_id,
        categoryName: (b.expense_categories as unknown as { name: string } | null)?.name ?? "Uncategorized",
        monthlyAmount: Number(b.monthly_amount),
        actual,
        remaining: Number(b.monthly_amount) - actual,
        // Guarded: POST rejects a non-positive cap, but nothing stops a
        // zero reaching this table by another route, and dividing by it
        // renders the budget bar as NaN% or Infinity% rather than
        // failing loudly.
        percentUsed: Number(b.monthly_amount) > 0 ? Math.round((actual / Number(b.monthly_amount)) * 100) : 0,
      };
    }),
  });
}

// POST /api/expense-manager/budgets — set or update (upsert on
// book+category) a category's standing monthly cap. Gated to
// manage_accounts, same trust bar as recurring templates.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { bookOwnerId: requestedBookOwnerId, categoryId, monthlyAmount } = body ?? {};
  const bookOwnerId = requestedBookOwnerId || profile.id;
  if (!categoryId || typeof monthlyAmount !== "number" || monthlyAmount <= 0) {
    return NextResponse.json({ error: "categoryId and a positive monthlyAmount are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "manage_accounts")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: bookProfile } = await supabase.from("expense_business_profiles").select("organization_id").eq("customer_id", bookOwnerId).single();
  if (!bookProfile) return NextResponse.json({ error: "Business profile not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("expense_budgets")
    .upsert(
      { book_owner_id: bookOwnerId, organization_id: bookProfile.organization_id, category_id: categoryId, monthly_amount: monthlyAmount, created_by: profile.id },
      { onConflict: "book_owner_id,category_id" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, budget: data }, { status: 201 });
}
