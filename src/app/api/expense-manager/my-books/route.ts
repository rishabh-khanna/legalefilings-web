import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

// GET /api/expense-manager/my-books — every book (own or invited onto)
// this profile has access to, for the book-switcher — an accountant
// might work across several different customers' books, so the UI needs
// a way to list and switch between them, not just assume "my books" is
// always exactly one.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: memberships, error } = await supabase
    .from("expense_book_members")
    .select("book_owner_id, role, profiles!expense_book_members_book_owner_id_fkey(full_name)")
    .eq("member_id", profile.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    books: (memberships ?? []).map((m) => ({
      bookOwnerId: m.book_owner_id,
      role: m.role,
      ownerName: (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "Unknown",
      isOwn: m.book_owner_id === profile.id,
    })),
  });
}
