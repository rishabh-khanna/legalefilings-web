import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { computeInvoiceTotals, isTaxableInvoiceType, resolveDueDate, type LineItemDraft } from "@/lib/invoice-calc";

type LineItemInput = {
  catalogItemId?: string;
  description: string;
  itemType?: "product" | "service";
  hsnSacCode?: string;
  unit?: string;
  quantity: number;
  rate: number;
  discount?: number;
  gstRate?: number;
};

// GET /api/invoices/[id] — the full invoice + line items, for loading
// back into the wizard to edit (or just to view).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, invoice_line_items(*)")
    .eq("id", id)
    .single();
  if (error || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.customer_id !== profile.id) {
    if (!isStaffOrAdmin(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  return NextResponse.json({ invoice });
}

// PATCH /api/invoices/[id] — edits a draft invoice in place: replaces
// its line items and recomputes every total, same math as creation.
// Deliberately restricted to draft status — once an invoice has been
// sent/paid/emailed it's a legal record of what was billed, not
// something to silently rewrite; a correction after that point should
// be a credit/debit note instead, not an edit.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !isStaffOrAdmin(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("invoices").select("status, created_by, customer_id, invoice_type, organization_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (existing.status !== "draft") return NextResponse.json({ error: "Only a draft invoice can be edited — issue a credit/debit note instead" }, { status: 400 });
  if (!canSeeAllOrgs(profile) && existing.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
    const chain = await getReportingChainIds(profile.id);
    if (!existing.created_by || ![profile.id, ...chain].includes(existing.created_by)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const b = body as Record<string, unknown>;

  const customerId = (b.customerId as string | undefined) ?? existing.customer_id;
  const items = (b.items as LineItemInput[] | undefined) ?? [];
  const invoiceType = (b.invoiceType as string | undefined) ?? existing.invoice_type;
  if (items.length === 0) return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });

  const [{ data: customer }, { data: company }] = await Promise.all([
    supabase.from("profiles").select("state, state_code, organization_id").eq("id", customerId).single(),
    supabase.from("company_settings").select("state_code, default_invoice_notes").eq("organization_id", existing.organization_id).single(),
  ]);
  if (customer && customer.organization_id !== existing.organization_id) {
    return NextResponse.json({ error: "Customer does not belong to this invoice's organization" }, { status: 400 });
  }

  const taxable = isTaxableInvoiceType(invoiceType);
  const customerStateCode = (b.customerStateCode as string | undefined) ?? customer?.state_code ?? "";
  const isIntraState = !!company?.state_code && company.state_code === customerStateCode;

  const lineItemDrafts: LineItemDraft[] = items.map((i) => ({
    description: i.description,
    hsnSacCode: i.hsnSacCode ?? "",
    itemType: i.itemType ?? "service",
    unit: i.unit ?? "Nos",
    quantity: Number(i.quantity) || 0,
    rate: Number(i.rate) || 0,
    discount: Number(i.discount) || 0,
    gstRate: Number(i.gstRate) || 0,
  }));

  const discountType = (b.discountType as "flat" | "percentage" | null | undefined) ?? null;
  const totals = computeInvoiceTotals({
    items: lineItemDrafts,
    isIntraState,
    taxable,
    discountType,
    discountValue: Number(b.discountValue) || 0,
    freight: Number(b.freight) || 0,
    packing: Number(b.packing) || 0,
    courier: Number(b.courier) || 0,
    otherCharges: Number(b.otherCharges) || 0,
    tdsRate: Number(b.tdsRate) || 0,
  });

  const paymentTerms = (b.paymentTerms as string | undefined) ?? "Immediate";
  const dueDate = resolveDueDate(new Date(), paymentTerms);

  const { data: updated, error } = await supabase
    .from("invoices")
    .update({
      customer_id: customerId,
      invoice_type: invoiceType,
      related_invoice_id: (b.relatedInvoiceId as string | undefined) ?? null,
      subtotal: totals.subtotal,
      tax_amount: totals.taxTotal,
      cgst_total: totals.cgstTotal,
      sgst_total: totals.sgstTotal,
      igst_total: totals.igstTotal,
      discount_type: discountType,
      discount_value: Number(b.discountValue) || 0,
      discount_amount: totals.discountAmount,
      freight: Number(b.freight) || 0,
      packing: Number(b.packing) || 0,
      courier: Number(b.courier) || 0,
      other_charges: Number(b.otherCharges) || 0,
      tds_rate: Number(b.tdsRate) || 0,
      tds_amount: totals.tdsAmount,
      total: totals.invoiceValue,
      due_at: dueDate.toISOString(),
      payment_terms: paymentTerms,
      place_of_supply: (b.placeOfSupply as string | undefined) ?? null,
      reverse_charge: !!b.reverseCharge,
      notes: (b.notes as string | undefined) ?? company?.default_invoice_notes ?? null,
      pdf_template: (b.pdfTemplate as string | undefined) ?? undefined,
      customer_gstin: (b.customerGstin as string | undefined) ?? null,
      customer_pan: (b.customerPan as string | undefined) ?? null,
      customer_state: (b.customerState as string | undefined) ?? null,
      customer_state_code: customerStateCode || null,
      customer_billing_address: (b.customerBillingAddress as string | undefined) ?? null,
      customer_shipping_address: (b.customerShippingAddress as string | undefined) ?? null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("invoice_line_items").delete().eq("invoice_id", id);
  await supabase.from("invoice_line_items").insert(
    totals.lineItems.map((i, idx) => ({
      invoice_id: id,
      catalog_item_id: items[idx]?.catalogItemId ?? null,
      description: i.description,
      item_type: i.itemType,
      hsn_sac_code: i.hsnSacCode || null,
      unit: i.unit,
      quantity: i.quantity,
      unit_price: i.rate,
      discount: i.discount,
      gst_rate: i.gstRate,
      taxable_value: i.taxableValue,
      cgst_amount: i.cgstAmount,
      sgst_amount: i.sgstAmount,
      igst_amount: i.igstAmount,
      amount: i.lineTotal,
    }))
  );

  await supabase.from("invoice_events").insert({ invoice_id: id, event_type: "status_changed", actor_id: profile.id, detail: "Draft edited" });

  return NextResponse.json({ ok: true, invoice: updated });
}
