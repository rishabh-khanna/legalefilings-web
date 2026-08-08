import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

// DELETE /api/admin/tool-grants/[id] — revoke a delegated grant. Org
// admin only, and scoped to the admin's own org (can't revoke a grant
// belonging to another org just by guessing its id).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("staff_tool_grants").delete().eq("id", id).eq("organization_id", profile.organization_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
