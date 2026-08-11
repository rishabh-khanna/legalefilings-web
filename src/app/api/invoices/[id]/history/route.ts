import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { loadInvoiceForStaffAccess } from "@/lib/organization";

// GET /api/invoices/[id]/history — the audit trail (created, downloaded,
// status changes, emailed, payments) for this invoice, from
// invoice_events — already being written to on every action, just never
// had a viewer.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !isStaffOrAdmin(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const invoice = await loadInvoiceForStaffAccess(supabase, profile, id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("invoice_events")
    .select("id, event_type, detail, created_at, profiles!invoice_events_actor_id_fkey(full_name)")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data });
}
