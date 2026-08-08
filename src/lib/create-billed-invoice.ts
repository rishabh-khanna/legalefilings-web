import { getSupabaseAdmin } from "@/lib/supabase-admin";
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

export type CreateBilledInvoiceInput = {
  organizationId: string;
  customerId: string;
  invoiceType?: string;
  relatedInvoiceId?: string;
  items: LineItemInput[];
  discountType?: "flat" | "percentage" | null;
  discountValue?: number;
  freight?: number;
  packing?: number;
  courier?: number;
  otherCharges?: number;
  tdsRate?: number;
  paymentTerms?: string;
  placeOfSupply?: string;
  reverseCharge?: boolean;
  notes?: string;
  pdfTemplate?: string;
  gstRegistrationId?: string;
  customerGstin?: string;
  customerPan?: string;
  customerState?: string;
  customerStateCode?: string;
  customerBillingAddress?: string;
  customerShippingAddress?: string;
  createdBy: string | null;
  orderId?: string;
};

// The ad-hoc (non-order) invoice creation logic — same GST/discount/TDS
// math as everything else in this module, extracted out of the API
// route so the recurring-invoice cron can generate a real Billed Invoice
// the same way a human would through the wizard, rather than a
// second, possibly-diverging code path.
export async function createBilledInvoice(input: CreateBilledInvoiceInput) {
  const supabase = getSupabaseAdmin();
  const invoiceType = input.invoiceType ?? "gst";
  if ((invoiceType === "credit_note" || invoiceType === "debit_note") && !input.relatedInvoiceId) {
    throw new Error("relatedInvoiceId is required for a credit or debit note");
  }
  if (!input.items || input.items.length === 0) {
    throw new Error("At least one line item is required");
  }
  // Each item's own quantity/rate used to silently coerce a missing or
  // invalid value to 0 below (`Number(i.quantity) || 0`) instead of
  // rejecting it — a line item with 0 quantity contributes nothing to
  // the invoice total, so a request with every item like that (or a
  // bad numeric string that coerced to 0) would produce a real,
  // saved ₹0 invoice with no indication anything was wrong. Description
  // and a positive quantity are the two things that make a line item
  // real; rate is deliberately allowed to be 0 (a waived/complimentary
  // item alongside paid ones is a legitimate invoice).
  for (const [idx, item] of input.items.entries()) {
    if (!item.description?.trim()) throw new Error(`Line item ${idx + 1}: description is required`);
    if (!(Number(item.quantity) > 0)) throw new Error(`Line item ${idx + 1}: quantity must be greater than 0`);
    if (!(Number(item.rate) >= 0)) throw new Error(`Line item ${idx + 1}: rate must be 0 or greater`);
  }

  const [{ data: customer }, { data: company }, { data: registration }] = await Promise.all([
    supabase.from("profiles").select("full_name, company, gstin, pan_number, state, state_code, billing_address, shipping_address, organization_id").eq("id", input.customerId).single(),
    supabase.from("company_settings").select("state_code, invoice_number_prefix, default_invoice_notes").eq("organization_id", input.organizationId).single(),
    input.gstRegistrationId
      ? supabase.from("company_gst_registrations").select("state_code").eq("id", input.gstRegistrationId).eq("organization_id", input.organizationId).single()
      : Promise.resolve({ data: null }),
  ]);
  if (!customer) throw new Error("Customer not found");
  // The customer picker already only ever offers same-org customers, but
  // this is the actual money-creating path — worth the extra check
  // rather than trusting the caller filtered correctly upstream.
  if (customer.organization_id !== input.organizationId) throw new Error("Customer does not belong to this organization");

  const taxable = isTaxableInvoiceType(invoiceType);
  const companyStateCode = registration?.state_code ?? company?.state_code ?? "";
  const customerStateCode = input.customerStateCode ?? customer.state_code ?? "";
  const isIntraState = !!companyStateCode && companyStateCode === customerStateCode;

  const lineItemDrafts: LineItemDraft[] = input.items.map((i) => ({
    description: i.description,
    hsnSacCode: i.hsnSacCode ?? "",
    itemType: i.itemType ?? "service",
    unit: i.unit ?? "Nos",
    quantity: Number(i.quantity) || 0,
    rate: Number(i.rate) || 0,
    discount: Number(i.discount) || 0,
    gstRate: Number(i.gstRate) || 0,
  }));

  const discountType = input.discountType ?? null;
  const totals = computeInvoiceTotals({
    items: lineItemDrafts,
    isIntraState,
    taxable,
    discountType,
    discountValue: Number(input.discountValue) || 0,
    freight: Number(input.freight) || 0,
    packing: Number(input.packing) || 0,
    courier: Number(input.courier) || 0,
    otherCharges: Number(input.otherCharges) || 0,
    tdsRate: Number(input.tdsRate) || 0,
  });

  const now = new Date();
  const paymentTerms = input.paymentTerms ?? "Immediate";
  const dueDate = resolveDueDate(now, paymentTerms);
  const prefix = company?.invoice_number_prefix || "INV";
  const invoiceNumber = `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${now.getTime().toString().slice(-6)}`;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      organization_id: input.organizationId,
      order_id: input.orderId ?? null,
      customer_id: input.customerId,
      created_by: input.createdBy,
      invoice_type: invoiceType,
      related_invoice_id: input.relatedInvoiceId ?? null,
      gst_registration_id: input.gstRegistrationId ?? null,
      pdf_template: input.pdfTemplate ?? "classic",
      subtotal: totals.subtotal,
      tax_amount: totals.taxTotal,
      cgst_total: totals.cgstTotal,
      sgst_total: totals.sgstTotal,
      igst_total: totals.igstTotal,
      discount_type: discountType,
      discount_value: Number(input.discountValue) || 0,
      discount_amount: totals.discountAmount,
      freight: Number(input.freight) || 0,
      packing: Number(input.packing) || 0,
      courier: Number(input.courier) || 0,
      other_charges: Number(input.otherCharges) || 0,
      tds_rate: Number(input.tdsRate) || 0,
      tds_amount: totals.tdsAmount,
      total: totals.invoiceValue,
      status: "draft",
      issued_at: now.toISOString(),
      due_at: dueDate.toISOString(),
      payment_terms: paymentTerms,
      place_of_supply: input.placeOfSupply ?? customer.state ?? null,
      reverse_charge: !!input.reverseCharge,
      notes: input.notes ?? company?.default_invoice_notes ?? null,
      customer_gstin: input.customerGstin ?? customer.gstin ?? null,
      customer_pan: input.customerPan ?? customer.pan_number ?? null,
      customer_state: input.customerState ?? customer.state ?? null,
      customer_state_code: customerStateCode || null,
      customer_billing_address: input.customerBillingAddress ?? customer.billing_address ?? null,
      customer_shipping_address: input.customerShippingAddress ?? customer.shipping_address ?? null,
    })
    .select()
    .single();
  if (error || !invoice) throw new Error(error?.message ?? "Failed to create invoice");

  await supabase.from("invoice_line_items").insert(
    totals.lineItems.map((i, idx) => ({
      invoice_id: invoice.id,
      catalog_item_id: input.items[idx]?.catalogItemId ?? null,
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

  await supabase.from("invoice_events").insert({ invoice_id: invoice.id, event_type: "created", actor_id: input.createdBy });

  return invoice;
}
