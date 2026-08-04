import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

// GET /api/holidays — any signed-in user (staff/admin) can view the
// calendar; RLS also allows this directly, but routing through the API
// keeps the pattern consistent with everything else in this app.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("holidays").select("*").order("date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holidays: data });
}

// POST /api/holidays — admin only.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { name, date, type } = body ?? {};
  if (!name || !date) return NextResponse.json({ error: "name and date are required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("holidays")
    .insert({ name, date, type: type ?? "company", created_by: profile.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, holiday: data }, { status: 201 });
}
