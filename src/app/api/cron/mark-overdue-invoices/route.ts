import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { sendInvoiceReminderEmail } from "@/lib/email";
import { logEmailFailure } from "@/lib/email-failures";
import { SITE_URL } from "@/config/site";

// Kept as a literal list rather than derived at query time — PostgREST
// needs concrete values, and these are exactly the types for which
// invoiceBalanceSign() is +1 (see src/lib/invoice-calc.ts).
const COLLECTABLE_TYPES = ["gst", "non_gst", "export", "debit_note"];

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

  // Only documents that represent money actually owed. A credit note is
  // the business owing the CUSTOMER, and a proforma is a quotation —
  // flagging either "overdue" (and then chasing it below) would demand
  // payment for something that was never a receivable.
  const { data: overdueInvoices, error } = await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .in("status", ["sent", "partially_paid"])
    .in("invoice_type", COLLECTABLE_TYPES)
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

  const reminders = await sendDueReminders(supabase);

  return NextResponse.json({ ok: true, markedOverdue: overdueInvoices?.length ?? 0, ...reminders });
}

// Which reminder (if any) an invoice is due for today, based on how far
// past its due date it is. Negative = not yet due.
//
// The schedule deliberately stops at 30 days rather than nagging
// forever: past that point an unpaid invoice is a conversation for a
// human to have, not a job for a cron, and continuing to auto-email
// only trains the recipient to filter you out.
const REMINDER_SCHEDULE: { kind: string; dayOffset: number }[] = [
  { kind: "due_soon", dayOffset: -3 },
  { kind: "overdue_1", dayOffset: 1 },
  { kind: "overdue_7", dayOffset: 7 },
  { kind: "overdue_14", dayOffset: 14 },
  { kind: "overdue_30", dayOffset: 30 },
];

function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86400000);
}

async function sendDueReminders(supabase: ReturnType<typeof getSupabaseAdmin>) {
  // Only invoices that are actually chaseable: issued, not settled, not
  // cancelled, and not still a draft nobody has sent.
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, total, due_at, status, customer_id, organization_id, invoice_payments(amount), profiles!invoices_customer_id_fkey(full_name), organizations(name)"
    )
    .in("status", ["sent", "partially_paid", "overdue"])
    .in("invoice_type", COLLECTABLE_TYPES)
    .not("due_at", "is", null);

  let sent = 0;
  let skipped = 0;

  for (const invoice of invoices ?? []) {
    const paid = ((invoice.invoice_payments as { amount: number }[] | null) ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const amountDue = Number(invoice.total) - paid;
    // Balance, not total — a part-paid invoice must chase what's left,
    // not re-bill the whole amount. Half-a-rupee tolerance matches the
    // rounding already used by the payment routes.
    if (amountDue <= 0.5) continue;

    const daysOverdue = daysBetween(new Date(invoice.due_at as string), new Date());
    const due = REMINDER_SCHEDULE.filter((r) => daysOverdue >= r.dayOffset).sort((a, b) => b.dayOffset - a.dayOffset)[0];
    if (!due) continue;

    // Claim before sending. The unique (invoice_id, kind) constraint
    // makes this the idempotency gate: if the row already exists this
    // reminder has been sent (or a concurrent run is sending it), and we
    // skip rather than emailing the same customer twice.
    const { error: claimError } = await supabase
      .from("invoice_reminders")
      .insert({ invoice_id: invoice.id, kind: due.kind });
    if (claimError) {
      skipped++;
      continue;
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(invoice.customer_id as string);
    const customerEmail = authUser?.user?.email;
    if (!customerEmail) {
      skipped++;
      continue;
    }

    try {
      await sendInvoiceReminderEmail({
        customerName: (invoice.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "there",
        customerEmail,
        invoiceNumber: invoice.invoice_number as string,
        amountDue,
        dueDate: invoice.due_at as string,
        payUrl: `${SITE_URL}/pay/${invoice.id}`,
        daysOverdue,
        orgName: (invoice.organizations as unknown as { name: string | null } | null)?.name ?? undefined,
      });
      await supabase.from("invoice_events").insert({
        invoice_id: invoice.id,
        event_type: "reminder_sent",
        detail: `Payment reminder sent (${due.kind}) — ₹${amountDue.toLocaleString("en-IN")} outstanding`,
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send payment reminder for invoice ${invoice.id}:`, err);
      // Release the claim so the next run can retry this reminder —
      // otherwise a transient SMTP failure would permanently consume
      // this customer's only chance of being chased at this stage.
      await supabase.from("invoice_reminders").delete().eq("invoice_id", invoice.id).eq("kind", due.kind);
      await logEmailFailure(supabase, {
        emailType: "payment_reminder",
        recipientEmail: customerEmail,
        relatedEntity: `invoice:${invoice.id}`,
        errorMessage: err instanceof Error ? err.message : String(err),
        organizationId: invoice.organization_id as string,
      });
      skipped++;
    }
  }

  return { remindersSent: sent, remindersSkipped: skipped };
}
