import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { loadInvoiceForStaffAccess } from "@/lib/organization";
import { buildInvoicePdfBuffer, type PdfLineItem } from "@/lib/invoice-pdf";
import { sendInvoiceEmail } from "@/lib/email";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !isStaffOrAdmin(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const invoiceAccess = await loadInvoiceForStaffAccess(supabase, profile, id);
  if (!invoiceAccess) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, profiles!invoices_customer_id_fkey(full_name, company), invoice_line_items(*), invoice_payments(amount)")
    .eq("id", id)
    .single();
  if (error || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const { data: authUser } = await supabase.auth.admin.getUserById(invoice.customer_id);
  const customerEmail = authUser?.user?.email;
  if (!customerEmail) return NextResponse.json({ error: "Customer has no email on file" }, { status: 400 });

  const { data: company } = await supabase.from("company_settings").select("*").eq("organization_id", invoice.organization_id).single();
  // Org fetched before the PDF, not inside the try below — the QR's
  // payee label needs it, and emailing an invoice whose pay code is
  // branded with the wrong company is worse than not emailing at all.
  const { data: org } = await supabase.from("organizations").select("name").eq("id", invoice.organization_id).single();

  // Same lookup as the download route — without it, a credit/debit
  // note's PDF always showed "Against Invoice: —" when emailed, even
  // though downloading the identical document showed the real reference.
  let relatedInvoiceNumber: string | null = null;
  if (invoice.related_invoice_id) {
    const { data: related } = await supabase.from("invoices").select("invoice_number").eq("id", invoice.related_invoice_id).single();
    relatedInvoiceNumber = related?.invoice_number ?? null;
  }

  const buffer = await buildInvoicePdfBuffer({
    invoice: { ...invoice, related_invoice_number: relatedInvoiceNumber },
    company,
    items: (invoice.invoice_line_items as PdfLineItem[] | undefined) ?? [],
    orgName: org?.name ?? null,
  });

  try {
    await sendInvoiceEmail({
      customerName: invoice.profiles?.full_name ?? "there",
      customerEmail,
      invoiceNumber: invoice.invoice_number,
      amount: Number(invoice.total),
      pdfBuffer: Buffer.from(buffer),
      orgName: org?.name,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send email" }, { status: 500 });
  }

  await supabase.from("invoice_events").insert({ invoice_id: id, event_type: "status_changed", actor_id: profile.id, detail: `Emailed to ${customerEmail}` });
  if (invoice.status === "draft") {
    await supabase.from("invoices").update({ status: "sent" }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
