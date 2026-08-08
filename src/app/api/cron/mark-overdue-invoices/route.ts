import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

// GET /api/cron/mark-overdue-invoices — triggered daily by Vercel Cron
// (see vercel.json). `overdue` has been a valid invoice_status since the
// original schema, with full UI styling everywhere an invoice status
// shows up (Invoice CRM, Order History, the ageing report) — but nothing
// anywhere ever wrote it. A sent or partially-paid invoice just sat
// there forever, no matter how late it was. This is the one place that
// makes that status reachable: any invoice past its due_at that hasn't
// been paid off gets flipped, across every organization.
//
// Same fail-CLOSED pattern as the other cron routes (birthdays,
// expense-recurring) — no valid cron secret falls back to requiring a
// real platform_admin session instead of running unauthenticated.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const profile = await getCurrentProfile();
    if (!profile?.is_platform_admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString();

  const { data: overdueInvoices, error } = await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .in("status", ["sent", "partially_paid"])
    .lt("due_at", today)
    .select("id, invoice_number");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const invoice of overdueInvoices ?? []) {
    await supabase.from("invoice_events").insert({
      invoice_id: invoice.id,
      event_type: "status_changed",
      detail: "Marked overdue — past due date with an outstanding balance",
    });
  }

  return NextResponse.json({ ok: true, markedOverdue: overdueInvoices?.length ?? 0 });
}
