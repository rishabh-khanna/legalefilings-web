import { test, expect } from "@playwright/test";
import { computeLineItem, computeInvoiceTotals, resolveDueDate, nextRunAfter, round2, type LineItemDraft } from "../../src/lib/invoice-calc";

// Pure-function regression tests for the actual GST/discount/TDS math
// (src/lib/invoice-calc.ts) — every expected number below is worked out
// by hand, independent of the implementation, so these catch a wrong
// formula, not just a missing field. This is the single source of truth
// both the invoice-creation API and the PDF generator call, so a bug
// here is a bug on every real invoice, not just the UI's display of one.

function item(overrides: Partial<LineItemDraft> = {}): LineItemDraft {
  return { description: "Item", hsnSacCode: "9983", itemType: "service", unit: "Nos", quantity: 1, rate: 1000, discount: 0, gstRate: 18, ...overrides };
}

test.describe("computeLineItem", () => {
  test("intra-state: GST splits evenly into CGST + SGST", () => {
    const line = computeLineItem(item({ quantity: 2, rate: 1000, gstRate: 18 }), { isIntraState: true, taxable: true });
    expect(line.grossAmount).toBe(2000);
    expect(line.taxableValue).toBe(2000);
    expect(line.cgstAmount).toBe(180); // 18% of 2000 = 360, split 180/180
    expect(line.sgstAmount).toBe(180);
    expect(line.igstAmount).toBe(0);
    expect(line.lineTotal).toBe(2360);
  });

  test("inter-state: full GST goes to IGST, no CGST/SGST", () => {
    const line = computeLineItem(item({ quantity: 2, rate: 1000, gstRate: 18 }), { isIntraState: false, taxable: true });
    expect(line.cgstAmount).toBe(0);
    expect(line.sgstAmount).toBe(0);
    expect(line.igstAmount).toBe(360);
    expect(line.lineTotal).toBe(2360);
  });

  test("per-line discount reduces the taxable value before GST is applied", () => {
    const line = computeLineItem(item({ quantity: 1, rate: 1000, discount: 100, gstRate: 18 }), { isIntraState: true, taxable: true });
    expect(line.grossAmount).toBe(1000);
    expect(line.taxableValue).toBe(900); // 1000 - 100
    expect(line.cgstAmount).toBe(81); // 18% of 900 = 162, split 81/81
    expect(line.sgstAmount).toBe(81);
    expect(line.lineTotal).toBe(1062);
  });

  test("non-taxable invoice type (e.g. proforma) charges zero GST regardless of gstRate", () => {
    const line = computeLineItem(item({ quantity: 1, rate: 1000, gstRate: 18 }), { isIntraState: true, taxable: false });
    expect(line.cgstAmount).toBe(0);
    expect(line.sgstAmount).toBe(0);
    expect(line.igstAmount).toBe(0);
    expect(line.lineTotal).toBe(1000);
  });

  test("negative quantity, rate, discount, and gstRate are all clamped to zero, not trusted", () => {
    const line = computeLineItem(item({ quantity: -5, rate: -1000, discount: -50, gstRate: -18 }), { isIntraState: true, taxable: true });
    expect(line.quantity).toBe(0);
    expect(line.rate).toBe(0);
    expect(line.discount).toBe(0);
    expect(line.gstRate).toBe(0);
    expect(line.grossAmount).toBe(0);
    expect(line.taxableValue).toBe(0);
    expect(line.lineTotal).toBe(0);
  });

  test("a discount larger than the gross amount clamps the taxable value to zero, not negative", () => {
    const line = computeLineItem(item({ quantity: 1, rate: 500, discount: 900, gstRate: 18 }), { isIntraState: true, taxable: true });
    expect(line.taxableValue).toBe(0);
    expect(line.cgstAmount).toBe(0);
    expect(line.lineTotal).toBe(0);
  });
});

test.describe("computeInvoiceTotals", () => {
  test("two line items, invoice-level percentage discount, freight/packing, and TDS — full worked example", () => {
    // Item A: 1 x ₹10,000 @ 18% GST -> taxable 10,000, GST 1,800 (900/900)
    // Item B: 2 x ₹2,000 @ 12% GST -> taxable 4,000, GST 480 (240/240)
    // subtotal = 14,000; raw CGST = raw SGST = 1,140; raw tax = 2,280
    // 10% invoice-level discount -> discountAmount = 1,400
    // discountFactor = (14,000 - 1,400) / 14,000 = 0.9
    // cgstTotal = sgstTotal = 1,140 * 0.9 = 1,026; taxTotal = 2,052
    // otherChargesTotal = freight 100 + packing 50 = 150
    // invoiceValue = 14,000 - 1,400 + 2,052 + 150 = 14,802
    // TDS base = subtotal - discount = 12,600; TDS @ 10% = 1,260
    // netReceivable = 14,802 - 1,260 = 13,542
    const totals = computeInvoiceTotals({
      items: [
        item({ description: "A", quantity: 1, rate: 10000, gstRate: 18 }),
        item({ description: "B", quantity: 2, rate: 2000, gstRate: 12 }),
      ],
      isIntraState: true,
      taxable: true,
      discountType: "percentage",
      discountValue: 10,
      freight: 100,
      packing: 50,
      courier: 0,
      otherCharges: 0,
      tdsRate: 10,
    });

    expect(totals.subtotal).toBe(14000);
    expect(totals.discountAmount).toBe(1400);
    expect(totals.cgstTotal).toBe(1026);
    expect(totals.sgstTotal).toBe(1026);
    expect(totals.taxTotal).toBe(2052);
    expect(totals.otherChargesTotal).toBe(150);
    expect(totals.invoiceValue).toBe(14802);
    expect(totals.tdsAmount).toBe(1260);
    expect(totals.netReceivable).toBe(13542);
  });

  test("TDS is computed on the pre-GST taxable value, not the GST-inclusive invoice total", () => {
    // A single ₹10,000 item @ 18% GST with no discount: invoiceValue is
    // 11,800, but TDS at 10% must be 1,000 (10% of 10,000), not 1,180
    // (10% of 11,800) — GST charged on an invoice isn't part of the
    // income subject to TDS.
    const totals = computeInvoiceTotals({
      items: [item({ quantity: 1, rate: 10000, gstRate: 18 })],
      isIntraState: true,
      taxable: true,
      discountType: null,
      discountValue: 0,
      freight: 0,
      packing: 0,
      courier: 0,
      otherCharges: 0,
      tdsRate: 10,
    });
    expect(totals.invoiceValue).toBe(11800);
    expect(totals.tdsAmount).toBe(1000);
    expect(totals.netReceivable).toBe(10800);
  });

  test("a flat discount larger than the subtotal is clamped, not allowed to push the total negative", () => {
    const totals = computeInvoiceTotals({
      items: [item({ quantity: 1, rate: 500, gstRate: 0 })],
      isIntraState: true,
      taxable: true,
      discountType: "flat",
      discountValue: 5000,
      freight: 0,
      packing: 0,
      courier: 0,
      otherCharges: 0,
      tdsRate: 0,
    });
    expect(totals.discountAmount).toBe(500); // clamped to the subtotal, not 5000
    expect(totals.invoiceValue).toBe(0);
  });

  test("a percentage discount above 100% is clamped to 100%, not allowed to invert the total", () => {
    const totals = computeInvoiceTotals({
      items: [item({ quantity: 1, rate: 1000, gstRate: 0 })],
      isIntraState: true,
      taxable: true,
      discountType: "percentage",
      discountValue: 150,
      freight: 0,
      packing: 0,
      courier: 0,
      otherCharges: 0,
      tdsRate: 0,
    });
    expect(totals.discountAmount).toBe(1000); // clamped to 100% of subtotal
    expect(totals.invoiceValue).toBe(0);
  });

  test("freight/packing/courier/otherCharges are never taxed, only added after GST", () => {
    const totals = computeInvoiceTotals({
      items: [item({ quantity: 1, rate: 1000, gstRate: 18 })],
      isIntraState: true,
      taxable: true,
      discountType: null,
      discountValue: 0,
      freight: 200,
      packing: 100,
      courier: 50,
      otherCharges: 25,
      tdsRate: 0,
    });
    // 18% of 1000 = 180 GST; other charges = 375, untaxed.
    expect(totals.taxTotal).toBe(180);
    expect(totals.otherChargesTotal).toBe(375);
    expect(totals.invoiceValue).toBe(1000 + 180 + 375);
  });
});

test.describe("round2", () => {
  test("rounds to 2 decimal places using standard (not floating-point-broken) rounding", () => {
    expect(round2(2.005)).toBe(2.01); // the classic (2.005).toFixed(2) === "2.00" float trap
    expect(round2(10.004)).toBe(10);
    expect(round2(10.005)).toBe(10.01);
    expect(round2(0.1 + 0.2)).toBe(0.3); // 0.1+0.2 === 0.30000000000000004 raw
  });
});

test.describe("resolveDueDate", () => {
  test("'Immediate' leaves the due date equal to the issue date", () => {
    const issued = new Date("2027-01-15T00:00:00Z");
    const due = resolveDueDate(issued, "Immediate");
    expect(due.toISOString().slice(0, 10)).toBe("2027-01-15");
  });

  test("'30 Days' adds exactly 30 calendar days", () => {
    const issued = new Date("2027-01-15T00:00:00Z");
    const due = resolveDueDate(issued, "30 Days");
    expect(due.toISOString().slice(0, 10)).toBe("2027-02-14");
  });

  test("a custom 'N Days' string (wizard's free-text option) is parsed the same way", () => {
    const issued = new Date("2027-01-01T00:00:00Z");
    const due = resolveDueDate(issued, "7 days");
    expect(due.toISOString().slice(0, 10)).toBe("2027-01-08");
  });
});

test.describe("nextRunAfter", () => {
  test("monthly on the 31st clamps to the last day of a shorter month, without drifting permanently", () => {
    // 31 Jan -> 28 Feb (2027 is not a leap year) -> 31 Mar (bounces back
    // up, not stuck at 28 forever) — the anchorDay (31) is preserved
    // separately from the actual clamped date each time.
    const jan31 = new Date("2027-01-31T00:00:00Z");
    const feb = nextRunAfter(jan31, "monthly", 31);
    expect(feb.toISOString().slice(0, 10)).toBe("2027-02-28");
    const mar = nextRunAfter(feb, "monthly", 31);
    expect(mar.toISOString().slice(0, 10)).toBe("2027-03-31");
  });

  test("weekly adds exactly 7 days", () => {
    const start = new Date("2027-03-01T00:00:00Z");
    const next = nextRunAfter(start, "weekly");
    expect(next.toISOString().slice(0, 10)).toBe("2027-03-08");
  });

  test("quarterly adds 3 months, yearly adds 12", () => {
    const start = new Date("2027-01-15T00:00:00Z");
    expect(nextRunAfter(start, "quarterly").toISOString().slice(0, 10)).toBe("2027-04-15");
    expect(nextRunAfter(start, "yearly").toISOString().slice(0, 10)).toBe("2028-01-15");
  });
});
