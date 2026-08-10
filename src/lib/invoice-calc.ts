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

// Which direction a document moves the customer's balance.
//
//   +1  a receivable — the customer owes this (gst, non_gst, export,
//       and debit_note, which exists precisely to bill MORE)
//   -1  a credit note — the business owes the customer, so it REDUCES
//       what they owe
//    0  proforma — a quotation, not an accounting document. It is not a
//       receivable and must never appear in an outstanding balance or be
//       chased for payment.
//
// The statement ledger previously pushed every type as a debit, so a
// credit note INCREASED what the customer owed instead of reducing it —
// a ₹2,000 credit note moved a ₹10,000 balance to ₹12,000 rather than
// ₹8,000, a ₹4,000 error in the wrong direction.
export function invoiceBalanceSign(invoiceType: string): -1 | 0 | 1 {
  if (invoiceType === "credit_note") return -1;
  if (invoiceType === "proforma") return 0;
  return 1;
}

/** Types that represent real money owed and can legitimately be chased for payment. */
export function isCollectableInvoiceType(invoiceType: string): boolean {
  return invoiceBalanceSign(invoiceType) === 1;
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

// Advances a recurring schedule by one period.
//
// setMonth/setFullYear roll over instead of clamping — 31 Jan + 1 month
// lands on 3 Mar, which both skipped February's invoice and permanently
// moved the series onto the 3rd. anchorDay (the day the series is meant
// to bill on) is clamped to the target month's last day instead, so a
// 31st series runs 31 Jan, 28 Feb, 31 Mar rather than drifting down.
//
// `date` must be the schedule's own due date, never "now" — advancing
// from the moment the job happened to run means a late cron or a manual
// "Run Now" silently moves every future billing date with it.
// Everything here is UTC (setUTCDate/getUTCMonth, Date.UTC). The result
// is serialised with toISOString() by every caller, so doing the
// arithmetic in local time would shift the answer back a day for any
// timezone ahead of UTC — in IST a schedule advanced to 31 Mar would be
// stored as 30 Mar, and drift another day on every subsequent run.
export function nextRunAfter(date: Date, frequency: string, anchorDay?: number | null): Date {
  const next = new Date(date);
  if (frequency === "weekly") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  const monthsToAdd = frequency === "quarterly" ? 3 : frequency === "yearly" ? 12 : 1;
  const day = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : date.getUTCDate();
  // Move to the 1st first so changing the month can't roll over on its
  // own before the clamp below has a chance to apply.
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + monthsToAdd);
  const lastDayOfTargetMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return next;
}
