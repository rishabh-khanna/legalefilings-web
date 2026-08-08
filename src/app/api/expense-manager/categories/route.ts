import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";

// GET /api/expense-manager/categories?type=expense|income&bookOwnerId=...
// — the shared system defaults plus that book owner's own custom ones.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const bookOwnerId = searchParams.get("bookOwnerId") || profile.id;

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let query = supabase
    .from("expense_categories")
    .select("*")
    .or(`is_system.eq.true,customer_id.eq.${bookOwnerId}`)
    .order("name", { ascending: true });
  if (type === "expense" || type === "income") query = query.eq("transaction_type", type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data });
}

// POST /api/expense-manager/categories — a custom category for a book,
// alongside the system defaults. Anyone who can add entries can add a
// category (they're the ones who'll hit "nothing fits" while entering
// a transaction) — same gate as add_expense, not manage_accounts.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { bookOwnerId: requestedBookOwnerId, name, transactionType } = body ?? {};
  const bookOwnerId = requestedBookOwnerId || profile.id;
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name is required" }, { status: 400 });
  const type = transactionType === "income" ? "income" : "expense";

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "add_expense")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: bookProfile } = await supabase.from("expense_business_profiles").select("organization_id").eq("customer_id", bookOwnerId).single();

  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ customer_id: bookOwnerId, organization_id: bookProfile?.organization_id ?? profile.organization_id, name: name.trim(), transaction_type: type })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, category: data }, { status: 201 });
}
