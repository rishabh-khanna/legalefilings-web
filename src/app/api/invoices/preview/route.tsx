import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { computeInvoiceTotals, isTaxableInvoiceType, type LineItemDraft } from "@/lib/invoice-calc";
import { buildInvoicePdfBuffer } from "@/lib/invoice-pdf";

type LineItemInput = { description: string; itemType?: "product" | "service"; hsnSacCode?: string; unit?: string; quantity: number; rate: number; discount?: number; gstRate?: number };

// POST /api/invoices/preview — "Step 14: show exactly how the PDF will
// look" without creating anything: builds the same PDF the real
// download route would, from the wizard's in-progress draft, no DB
// writes at all. Staff/admin or a self-serve paid customer, same as
// invoice creation itself.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isSelfServePaidCustomer = profile.account_type === "customer" && profile.customer_tier === "paid";
  if (!isStaffOrAdmin(profile) && !isSelfServePaidCustomer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const b = body as Record<string, unknown>;

  const customerId = isSelfServePaidCustomer ? profile.id : (b.customerId as string | undefined);
  const items = (b.items as LineItemInput[] | undefined) ?? [];
  if (!customerId || items.length === 0) {
    return NextResponse.json({ error: "customerId and at least one line item are required" }, { status: 400 });
  }
  const invoiceType = isSelfServePaidCustomer ? "non_gst" : ((b.invoiceType as string | undefined) ?? "gst");

  const supabase = getSupabaseAdmin();
  const { data: customer } = await supabase
    .from("profiles")
    .select("full_name, company, gstin, pan_number, state, state_code, billing_address, shipping_address, organization_id")
    .eq("id", customerId)
    .single();
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  if (!isSelfServePaidCustomer && !canSeeAllOrgs(profile) && customer.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  // The preview has to reflect whichever org will actually issue this
  // invoice — the customer's own org, same as the real creation route —
  // not the viewer's, or a platform_admin previewing a tenant's invoice
  // would see the wrong company header/GST state entirely.
  const { data: company } = await supabase.from("company_settings").select("*").eq("organization_id", customer.organization_id).single();
  // The preview must show the same payee label the issued PDF will, or
  // it isn't a preview of anything.
  const { data: previewOrg } = await supabase.from("organizations").select("name").eq("id", customer.organization_id).single();

  const taxable = isTaxableInvoiceType(invoiceType);
  const isIntraState = !!company?.state_code && company.state_code === ((b.customerStateCode as string | undefined) ?? customer.state_code ?? "");

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

  const totals = computeInvoiceTotals({
    items: lineItemDrafts,
    isIntraState,
    taxable,
    discountType: (b.discountType as "flat" | "percentage" | null | undefined) ?? null,
    discountValue: Number(b.discountValue) || 0,
    freight: Number(b.freight) || 0,
    packing: Number(b.packing) || 0,
    courier: Number(b.courier) || 0,
    otherCharges: Number(b.otherCharges) || 0,
    tdsRate: isSelfServePaidCustomer ? 0 : Number(b.tdsRate) || 0,
  });

  const now = new Date();
  const pdfItems = totals.lineItems.map((i) => ({
    description: i.description,
    hsn_sac_code: i.hsnSacCode || null,
    quantity: i.quantity,
    unit: i.unit,
    unit_price: i.rate,
    discount: i.discount,
    gst_rate: i.gstRate,
    taxable_value: i.taxableValue,
    cgst_amount: i.cgstAmount,
    sgst_amount: i.sgstAmount,
    igst_amount: i.igstAmount,
    amount: i.lineTotal,
  }));

  const buffer = await buildInvoicePdfBuffer({
    orgName: previewOrg?.name ?? null,
    invoice: {
      invoice_number: "PREVIEW",
      invoice_type: invoiceType,
      profiles: { full_name: customer.full_name, company: customer.company },
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      cgst_total: totals.cgstTotal,
      sgst_total: totals.sgstTotal,
      igst_total: totals.igstTotal,
      freight: Number(b.freight) || 0,
      packing: Number(b.packing) || 0,
      courier: Number(b.courier) || 0,
      other_charges: Number(b.otherCharges) || 0,
      total: totals.invoiceValue,
      tds_amount: totals.tdsAmount,
      tds_rate: isSelfServePaidCustomer ? 0 : Number(b.tdsRate) || 0,
      issued_at: now.toISOString(),
      due_at: null,
      payment_terms: (b.paymentTerms as string | undefined) ?? "Immediate",
      place_of_supply: (b.placeOfSupply as string | undefined) ?? customer.state ?? null,
      reverse_charge: !!b.reverseCharge,
      notes: (b.notes as string | undefined) ?? company?.default_invoice_notes ?? null,
      customer_gstin: (b.customerGstin as string | undefined) ?? customer.gstin ?? null,
      customer_pan: (b.customerPan as string | undefined) ?? customer.pan_number ?? null,
      customer_state: (b.customerState as string | undefined) ?? customer.state ?? null,
      customer_state_code: (b.customerStateCode as string | undefined) ?? customer.state_code ?? null,
      customer_billing_address: (b.customerBillingAddress as string | undefined) ?? customer.billing_address ?? null,
      customer_shipping_address: (b.customerShippingAddress as string | undefined) ?? customer.shipping_address ?? null,
      pdf_template: (b.pdfTemplate as string | undefined) ?? "classic",
    },
    company,
    items: pdfItems,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf" },
  });
}
