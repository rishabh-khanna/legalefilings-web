import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { computeInvoiceTotals } from "@/lib/invoice-calc";
import { allocateInvoiceNumber } from "@/lib/invoice-number";

// Shared by the two "buy a plan" paths (staff-assisted buy-for-customer,
// and direct customer checkout) — both create a single-line-item order
// invoice and need the same GST math as the CRM's ad-hoc invoice
// wizard, not a flat unconditional 18%. Checkout doesn't collect the
// customer's state at all (that form only asks name/email/phone/plan),
// so when it's unknown this defaults to the company's own state
// (CGST+SGST) rather than guessing inter-state — the common case for
// most of a India-based service business's customers, and a safe
// default in that it doesn't misclassify a same-state sale as export.
export async function createOrderInvoice(opts: {
  organizationId: string;
  orderId: string;
  customerId: string;
  service: string;
  plan: string;
  price: number;
  taxRatePercent?: number;
  createdBy?: string;
}) {
  const supabase = getSupabaseAdmin();
  const [{ data: company }, { data: customer }] = await Promise.all([
    supabase.from("company_settings").select("state, state_code, invoice_number_prefix, default_invoice_notes, financial_year_start_month").eq("organization_id", opts.organizationId).single(),
    supabase.from("profiles").select("gstin, pan_number, state, state_code, billing_address, shipping_address").eq("id", opts.customerId).eq("organization_id", opts.organizationId).single(),
  ]);

  const isIntraState = !customer?.state_code || !company?.state_code || customer.state_code === company.state_code;
  const gstRate = opts.taxRatePercent ?? 18;

  const totals = computeInvoiceTotals({
    items: [{ description: `${opts.service} — ${opts.plan}`, hsnSacCode: "", itemType: "service", unit: "Nos", quantity: 1, rate: opts.price, discount: 0, gstRate }],
    isIntraState,
    taxable: true,
    discountType: null,
    discountValue: 0,
    freight: 0,
    packing: 0,
    courier: 0,
    otherCharges: 0,
    tdsRate: 0,
  });

  const now = new Date();
  const invoiceNumber = await allocateInvoiceNumber(supabase, opts.organizationId, {
    prefix: company?.invoice_number_prefix,
    financialYearStartMonth: company?.financial_year_start_month,
    now,
  });

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      organization_id: opts.organizationId,
      order_id: opts.orderId,
      customer_id: opts.customerId,
      created_by: opts.createdBy ?? null,
      invoice_type: "gst",
      subtotal: totals.subtotal,
      tax_amount: totals.taxTotal,
      cgst_total: totals.cgstTotal,
      sgst_total: totals.sgstTotal,
      igst_total: totals.igstTotal,
      total: totals.invoiceValue,
      status: "sent",
      issued_at: now.toISOString(),
      payment_terms: "Immediate",
      notes: company?.default_invoice_notes ?? null,
      customer_gstin: customer?.gstin ?? null,
      customer_pan: customer?.pan_number ?? null,
      customer_state: customer?.state ?? null,
      customer_state_code: customer?.state_code ?? null,
      customer_billing_address: customer?.billing_address ?? null,
      customer_shipping_address: customer?.shipping_address ?? null,
    })
    .select()
    .single();
  if (invoiceError || !invoice) throw new Error(invoiceError?.message ?? "Failed to create invoice");

  const line = totals.lineItems[0];
  await supabase.from("invoice_line_items").insert({
    invoice_id: invoice.id,
    description: line.description,
    item_type: "service",
    unit: line.unit,
    quantity: line.quantity,
    unit_price: line.rate,
    discount: line.discount,
    gst_rate: line.gstRate,
    taxable_value: line.taxableValue,
    cgst_amount: line.cgstAmount,
    sgst_amount: line.sgstAmount,
    igst_amount: line.igstAmount,
    amount: line.lineTotal,
  });

  return invoice;
}
