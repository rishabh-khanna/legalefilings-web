import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";
import { nextRunAfter } from "@/lib/invoice-calc";
import { createBilledInvoice, type CreateBilledInvoiceInput } from "@/lib/create-billed-invoice";

// GET /api/recurring-invoices/run — generates a real Billed Invoice for
// every active template whose next_run_date has arrived, then advances
// next_run_date by its frequency. Vercel Cron always triggers via GET
// (see vercel.json, same pattern as the existing birthdays cron), so
// this is GET rather than POST even though it has a side effect — it's
// also how staff/admin trigger a manual "Run Now" on a single template
// (?templateId=).
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  let staffProfile: Awaited<ReturnType<typeof getCurrentProfile>> = null;
  if (!isCron) {
    staffProfile = await getCurrentProfile();
    const isCustomerOperator = staffProfile?.account_type === "customer" && (await hasToolAccess(staffProfile, "invoice_crm"));
    if (!isStaffOrAdmin(staffProfile) && !isCustomerOperator) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get("templateId");

  const supabase = getSupabaseAdmin();
  let query = supabase.from("recurring_invoice_templates").select("*").eq("active", true);
  // The cron path (isCron) intentionally processes every organization's
  // due templates — that's the whole point of it. The manual "Run Now"
  // path is a real staff/admin session and must stay inside their own
  // org, same as every other invoice route.
  if (staffProfile && !canSeeAllOrgs(staffProfile)) query = query.eq("organization_id", staffProfile.organization_id);
  query = templateId ? query.eq("id", templateId) : query.lte("next_run_date", new Date().toISOString().slice(0, 10));
  const { data: templates, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { templateId: string; invoiceId?: string; error?: string }[] = [];
  for (const template of templates ?? []) {
    try {
      const payload = template.payload as CreateBilledInvoiceInput;
      const invoice = await createBilledInvoice({
        ...payload,
        customerId: template.customer_id,
        invoiceType: template.invoice_type,
        createdBy: template.created_by,
      });
      await supabase
        .from("recurring_invoice_templates")
        .update({
          // Advance from the schedule's own due date, not from now — a
          // cron that ran late, or a manual "Run Now", would otherwise
          // drag every future billing date along with it.
          next_run_date: nextRunAfter(new Date(`${template.next_run_date}T00:00:00Z`), template.frequency, template.anchor_day)
            .toISOString()
            .slice(0, 10),
          last_generated_invoice_id: invoice.id,
        })
        .eq("id", template.id);
      results.push({ templateId: template.id, invoiceId: invoice.id });
    } catch (err) {
      results.push({ templateId: template.id, error: err instanceof Error ? err.message : "Failed to generate" });
    }
  }

  return NextResponse.json({ ok: true, generated: results.filter((r) => r.invoiceId).length, results });
}
