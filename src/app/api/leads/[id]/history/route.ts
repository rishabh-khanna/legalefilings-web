import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

// GET /api/leads/[id]/history — the real stage-change audit trail for a
// lead's activity timeline (populated going forward by the PATCH route's
// lead_status_history insert — leads changed before that existed just
// show no history, honestly, rather than a fabricated one).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("lead_status_history")
    .select("id, old_status, new_status, changed_at, profiles!lead_status_history_changed_by_fkey(full_name)")
    .eq("lead_id", id)
    .order("changed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data });
}
