// Shared invoice math — the creation API and the PDF generator both call
// this so the numbers on the PDF are always exactly what was stored, not
// a second independent (and possibly diverging) calculation.
//
// GST/TDS math here follows standard practice (CGST+SGST for intra-state,
// IGST for inter-state, TDS as an income-tax prepayment that reduces cash
// received but not the invoice's own GST liability) but is not a
// substitute for review by an actual CA/GST practitioner before relying
// on it for statutory filing — same caveat this codebase already carries
// for payroll's PF/ESI/Professional Tax calculations.

export type LineItemDraft = {
  description: string;
  hsnSacCode: string;
  itemType: "product" | "service";
  unit: string;
  quantity: number;
  rate: number;
  discount: number;
  gstRate: number;
};

export type LineItemComputed = LineItemDraft & {
  grossAmount: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
};

export type InvoiceTotals = {
  lineItems: LineItemComputed[];
  subtotal: number; // sum of taxable values, before invoice-level discount
  discountAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  otherChargesTotal: number;
  invoiceValue: number; // grand total the customer owes (before TDS)
  tdsAmount: number;
  netReceivable: number; // what's actually expected in cash
};

// Company's own state code vs the customer's — same state means
// CGST+SGST, different state means IGST. A non-GST/export/proforma
// invoice never carries tax regardless of state.
export function computeLineItem(
  item: LineItemDraft,
  opts: { isIntraState: boolean; taxable: boolean }
): LineItemComputed {
  // Negative quantity/rate/discount/gstRate aren't valid invoice inputs —
  // clamped here rather than trusted from the caller, since a negative
  // rate previously fed straight through into a negative grossAmount
  // (silently becoming a zero-value line via the taxableValue clamp
  // below, rather than actually being rejected), and a negative gstRate
  // would have reduced the tax collected on that line.
  const quantity = Math.max(0, item.quantity);
  const rate = Math.max(0, item.rate);
  const discount = Math.max(0, item.discount);
  const gstRate = Math.max(0, item.gstRate);

  const grossAmount = round2(quantity * rate);
  const taxableValue = round2(Math.max(0, grossAmount - discount));
  const gstAmount = opts.taxable ? (taxableValue * gstRate) / 100 : 0;
  const cgstAmount = round2(opts.taxable && opts.isIntraState ? gstAmount / 2 : 0);
  const sgstAmount = round2(opts.taxable && opts.isIntraState ? gstAmount / 2 : 0);
  const igstAmount = round2(opts.taxable && !opts.isIntraState ? gstAmount : 0);
  return {
    ...item,
    quantity,
    rate,
    discount,
    gstRate,
    grossAmount,
    taxableValue,
    cgstAmount,
    sgstAmount,
    igstAmount,
    lineTotal: round2(taxableValue + cgstAmount + sgstAmount + igstAmount),
  };
}

export function computeInvoiceTotals(opts: {
  items: LineItemDraft[];
  isIntraState: boolean;
  taxable: boolean; // false for non_gst
  discountType: "flat" | "percentage" | null;
  discountValue: number;
  freight: number;
  packing: number;
  courier: number;
  otherCharges: number;
  tdsRate: number;
}): InvoiceTotals {
  const lineItems = opts.items.map((item) => computeLineItem(item, { isIntraState: opts.isIntraState, taxable: opts.taxable }));

  const subtotal = round2(lineItems.reduce((sum, i) => sum + i.taxableValue, 0));
  const rawCgst = lineItems.reduce((sum, i) => sum + i.cgstAmount, 0);
  const rawSgst = lineItems.reduce((sum, i) => sum + i.sgstAmount, 0);
  const rawIgst = lineItems.reduce((sum, i) => sum + i.igstAmount, 0);
  const rawTax = rawCgst + rawSgst + rawIgst;

  // Invoice-level discount (on top of any per-line discount) is applied
  // to the taxable subtotal; tax is then scaled down by the same
  // proportion rather than re-split per line, which keeps the CGST:SGST
  // (or IGST) ratio intact without re-deriving every line. Clamped to
  // non-negative — a negative discountValue previously pushed
  // discountFactor above 1, inflating both the total and the GST
  // charged instead of being rejected.
  const safeDiscountValue = Math.max(0, opts.discountValue);
  const discountAmount = round2(
    !opts.discountType
      ? 0
      : opts.discountType === "percentage"
        ? (subtotal * Math.min(safeDiscountValue, 100)) / 100
        : Math.min(safeDiscountValue, subtotal)
  );
  const discountFactor = subtotal > 0 ? Math.max(0, (subtotal - discountAmount) / subtotal) : 1;

  const cgstTotal = round2(rawCgst * discountFactor);
  const sgstTotal = round2(rawSgst * discountFactor);
  const igstTotal = round2(rawIgst * discountFactor);
  const taxTotal = round2(rawTax * discountFactor);

  const otherChargesTotal = round2(Math.max(0, opts.freight) + Math.max(0, opts.packing) + Math.max(0, opts.courier) + Math.max(0, opts.otherCharges));

  const invoiceValue = round2(subtotal - discountAmount + taxTotal + otherChargesTotal);
  // TDS is deducted on the taxable value (post-discount, pre-GST), not
  // on the GST-inclusive invoice total — per standard Indian TDS
  // practice (e.g. CBDT Circular 23/2017), GST charged separately on an
  // invoice isn't part of the income subject to TDS. Taxing the GST
  // portion too was overstating TDS on every TDS-bearing invoice.
  const tdsBase = round2(Math.max(0, subtotal - discountAmount));
  const tdsAmount = round2((tdsBase * Math.max(0, opts.tdsRate)) / 100);
  const netReceivable = round2(invoiceValue - tdsAmount);

  return {
    lineItems,
    subtotal,
    discountAmount,
    cgstTotal,
    sgstTotal,
    igstTotal,
    taxTotal,
    otherChargesTotal,
    invoiceValue,
    tdsAmount,
    netReceivable,
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function isTaxableInvoiceType(type: string): boolean {
  return type === "gst" || type === "credit_note" || type === "debit_note";
}

// Handles the fixed presets and any "N Days" string generically (covers
// the "Custom" wizard option, which just lets the user type a day count
// rather than being a fifth hardcoded case here).
export function resolveDueDate(issuedAt: Date, paymentTerms: string): Date {
  const due = new Date(issuedAt);
  const match = /^(\d+)\s*Days?$/i.exec(paymentTerms.trim());
  if (match) {
    due.setDate(due.getDate() + Number(match[1]));
  }
  return due;
}

export function nextRunAfter(date: Date, frequency: string): Date {
  const next = new Date(date);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "quarterly") next.setMonth(next.getMonth() + 3);
  else if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}
