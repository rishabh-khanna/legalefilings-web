import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { buildInvoicePdfBuffer, type PdfLineItem } from "@/lib/invoice-pdf";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, profiles!invoices_customer_id_fkey(full_name, company), invoice_line_items(*)")
    .eq("id", id)
    .single();

  if (error || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  // The PDF's company header is whichever org actually issued this
  // invoice, not the viewer's own org (relevant for a platform_admin
  // viewing across orgs).
  const { data: company } = await supabase.from("company_settings").select("*").eq("organization_id", invoice.organization_id).single();

  const isOwnCustomerInvoice = invoice.customer_id === profile.id;
  if (!isOwnCustomerInvoice) {
    if (!isStaffOrAdmin(profile)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!canSeeAllOrgs(profile) && invoice.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
      const chain = await getReportingChainIds(profile.id);
      if (!invoice.created_by || ![profile.id, ...chain].includes(invoice.created_by)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  let relatedInvoiceNumber: string | null = null;
  if (invoice.related_invoice_id) {
    const { data: related } = await supabase.from("invoices").select("invoice_number").eq("id", invoice.related_invoice_id).single();
    relatedInvoiceNumber = related?.invoice_number ?? null;
  }

  const buffer = await buildInvoicePdfBuffer({
    invoice: { ...invoice, related_invoice_number: relatedInvoiceNumber },
    company,
    items: (invoice.invoice_line_items as PdfLineItem[] | undefined) ?? [],
  });

  await supabase.from("invoice_events").insert({ invoice_id: id, event_type: "downloaded", actor_id: profile.id });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
