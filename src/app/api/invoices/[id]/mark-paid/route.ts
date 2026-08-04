import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";

// POST /api/invoices/[id]/mark-paid — manual reconciliation for however
// a customer actually paid (call-in, bank transfer, etc.) alongside the
// Razorpay auto-confirm path. Staff/admin only, and — same scoping as the
// invoices list — a non-admin can only mark paid an invoice they created
// or one created by their own reporting chain, not any invoice in the
// system by guessing/being handed its id.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  if (profile.account_type !== "admin") {
    const { data: existing } = await supabase.from("invoices").select("created_by").eq("id", id).single();
    const chain = await getReportingChainIds(profile.id);
    if (!existing || !existing.created_by || ![profile.id, ...chain].includes(existing.created_by)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("invoice_events").insert({ invoice_id: id, event_type: "status_changed", actor_id: profile.id, detail: "marked paid" });

  return NextResponse.json({ ok: true, invoice: data });
}
