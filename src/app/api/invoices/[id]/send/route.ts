import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { loadInvoiceForStaffAccess } from "@/lib/organization";

// POST /api/invoices/[id]/send — transitions a draft invoice to "sent"
// without necessarily emailing it (send-email does that too, as a side
// effect) — for when staff hand the invoice to the customer another way
// (WhatsApp, in person) and just want to mark it as formally issued so
// it stops showing as an editable draft.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !isStaffOrAdmin(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const invoice = await loadInvoiceForStaffAccess(supabase, profile, id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status !== "draft") return NextResponse.json({ error: "Only a draft invoice can be marked sent" }, { status: 400 });

  const { data, error } = await supabase.from("invoices").update({ status: "sent" }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("invoice_events").insert({ invoice_id: id, event_type: "status_changed", actor_id: profile.id, detail: "Marked as sent" });

  return NextResponse.json({ ok: true, invoice: data });
}
