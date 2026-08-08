import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { applyExpenseBalanceEffect, logExpenseAudit } from "@/lib/expense-manager";
import { sendBillReminderEmail } from "@/lib/email";
import { logEmailFailure } from "@/lib/email-failures";

function addOneMonth(dayOfMonth: number, from: string): string {
  const [y, m] = from.split("-").map(Number);
  return new Date(y, m, dayOfMonth).toISOString().slice(0, 10);
}

// GET /api/cron/expense-recurring — triggered daily by Vercel Cron (see
// vercel.json). Two jobs in one pass, both driven off the same
// recurring-template table:
//   1. Any template due today or earlier (a missed day if the cron
//      didn't run) gets turned into a real transaction, same as if
//      someone had entered it by hand — Smart Automation #4.
//   2. Any template due in the next 3 days gets a reminder email, once
//      per due date (last_reminded_at tracks that) — Smart Automation
//      #5 / Module 11's bill reminder.
// Fails CLOSED, not open: this used to skip the secret check entirely
// whenever CRON_SECRET was unset, which would make a platform-wide,
// cross-org "generate real financial transactions" trigger fully
// public. Same fallback pattern as /api/recurring-invoices/run — no
// valid cron secret means it now requires a real platform_admin
// session instead of nothing at all.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const profile = await getCurrentProfile();
    if (!profile?.is_platform_admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: dueTemplates } = await supabase
    .from("expense_recurring_templates")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_date", today);

  let created = 0;
  for (const template of dueTemplates ?? []) {
    const { data: tx, error } = await supabase
      .from("expense_transactions")
      .insert({
        customer_id: template.book_owner_id,
        organization_id: template.organization_id,
        transaction_type: template.transaction_type,
        transaction_date: template.next_run_date,
        category_id: template.category_id,
        description: template.description ?? "Recurring entry",
        amount: template.amount,
        payment_mode: template.payment_mode,
        account_id: template.account_id,
        party_name: template.party_name,
        status: "approved",
        created_by: template.created_by,
      })
      .select()
      .single();
    if (error || !tx) continue;

    await applyExpenseBalanceEffect(supabase, tx, 1);
    await logExpenseAudit(supabase, {
      bookOwnerId: template.book_owner_id,
      organizationId: template.organization_id,
      actorId: template.created_by,
      action: `added_${template.transaction_type}`,
      entityType: "transaction",
      entityId: tx.id,
      detail: `${template.description ?? "Recurring entry"} — ₹${Number(template.amount).toLocaleString("en-IN")} (recurring)`,
    });

    await supabase
      .from("expense_recurring_templates")
      .update({ next_run_date: addOneMonth(template.day_of_month, template.next_run_date) })
      .eq("id", template.id);
    created += 1;
  }

  const reminderWindow = new Date();
  reminderWindow.setDate(reminderWindow.getDate() + 3);
  const reminderCutoff = reminderWindow.toISOString().slice(0, 10);

  const { data: upcomingTemplates } = await supabase
    .from("expense_recurring_templates")
    .select("*")
    .eq("is_active", true)
    .gt("next_run_date", today)
    .lte("next_run_date", reminderCutoff)
    .or(`last_reminded_at.is.null,last_reminded_at.neq.${today}`);

  let reminded = 0;
  for (const template of upcomingTemplates ?? []) {
    const { data: authUser } = await supabase.auth.admin.getUserById(template.book_owner_id);
    const email = authUser?.user?.email;
    if (!email) continue;
    try {
      await sendBillReminderEmail({
        email,
        description: template.description ?? "Recurring bill",
        amount: Number(template.amount),
        dueDate: template.next_run_date,
      });
      await supabase.from("expense_recurring_templates").update({ last_reminded_at: today }).eq("id", template.id);
      reminded += 1;
    } catch (err) {
      console.error(`Failed to send bill reminder for template ${template.id}:`, err);
      await logEmailFailure(supabase, {
        emailType: "bill_reminder",
        recipientEmail: email,
        relatedEntity: `expense_recurring_templates:${template.id}`,
        errorMessage: err instanceof Error ? err.message : String(err),
        organizationId: template.organization_id,
      });
    }
  }

  return NextResponse.json({ ok: true, created, reminded });
}
