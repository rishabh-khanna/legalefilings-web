import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

const BUSINESS_TYPES = ["proprietorship", "partnership", "llp", "private_limited", "ngo", "trust", "individual"];

// GET /api/expense-manager/setup — whether the caller has completed
// first-time setup yet, and if so, their business profile. Used to be
// customer-only (Phase 1, before staff/accountant book access existed),
// but every other expense-manager route now treats staff/admin as
// legitimate users too — Business Finance's own nav item is shown to
// staff, and /dashboard/finance already renders this exact setup wizard
// for anyone (any account_type) with no book yet. Restricting only this
// one route left staff/admin stuck looking at a wizard they could never
// actually submit.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("expense_business_profiles").select("*").eq("customer_id", profile.id).maybeSingle();
  return NextResponse.json({ profile: data });
}

// POST /api/expense-manager/setup — Module 2: business type + financial
// year + currency + opening cash balance, plus one or more bank accounts
// in the same call ("Add Another Bank" on the setup screen). Creates the
// business profile if this is the first time, or updates it if they're
// re-running setup (financial year rollover, etc.) — upsert on the
// unique customer_id, not insert-only.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { businessType, financialYear, currency, cashOpeningBalance, accounts } = body as Record<string, unknown>;
  if (!BUSINESS_TYPES.includes(String(businessType))) {
    return NextResponse.json({ error: "Invalid businessType" }, { status: 400 });
  }
  if (!financialYear || typeof financialYear !== "string") {
    return NextResponse.json({ error: "financialYear is required" }, { status: 400 });
  }
  const openingCash = typeof cashOpeningBalance === "number" ? cashOpeningBalance : 0;

  const supabase = getSupabaseAdmin();
  const { data: businessProfile, error } = await supabase
    .from("expense_business_profiles")
    .upsert(
      {
        customer_id: profile.id,
        organization_id: profile.organization_id,
        business_type: businessType,
        financial_year: financialYear,
        currency: typeof currency === "string" && currency ? currency : "INR",
        cash_opening_balance: openingCash,
        cash_balance: openingCash,
        setup_completed: true,
      },
      { onConflict: "customer_id" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Every book has a real 'owner' row in expense_book_members (Phase 3)
  // — this is what makes every other route's access check a single
  // lookup, regardless of whether the caller is the original owner or
  // someone later invited onto the book.
  await supabase
    .from("expense_book_members")
    .upsert({ book_owner_id: profile.id, member_id: profile.id, organization_id: profile.organization_id, role: "owner" }, { onConflict: "book_owner_id,member_id" });

  const accountRows = Array.isArray(accounts)
    ? (accounts as Record<string, unknown>[])
        .filter((a) => a.bankName && a.accountName)
        .map((a) => ({
          customer_id: profile.id,
          organization_id: profile.organization_id,
          bank_name: String(a.bankName),
          account_name: String(a.accountName),
          opening_balance: typeof a.openingBalance === "number" ? a.openingBalance : 0,
          opening_date: a.openingDate ? String(a.openingDate) : new Date().toISOString().slice(0, 10),
          current_balance: typeof a.openingBalance === "number" ? a.openingBalance : 0,
        }))
    : [];

  if (accountRows.length > 0) {
    const { error: accountsError } = await supabase.from("expense_accounts").insert(accountRows);
    if (accountsError) return NextResponse.json({ error: accountsError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: businessProfile }, { status: 201 });
}
