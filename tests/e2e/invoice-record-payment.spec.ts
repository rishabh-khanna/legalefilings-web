import { test, expect } from "@playwright/test";
import { seedUnpaidInvoice } from "./helpers/seed";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

// Staff-recorded payment (cash/bank/UPI/cheque, not Razorpay) — the
// direct money-recording path staff use daily. Real clicks through the
// actual "Record Payment" modal, checking the invoice's status badge
// transitions correctly: sent -> partially_paid -> paid, and that the
// balance shown decreases by exactly the recorded amount each time.
//
// Amounts are derived from the seeded invoice's real total, not
// hardcoded — createOrderInvoice applies 18% GST on top of the price
// passed to buy-for-customer, so a ₹2,000 order becomes a ₹2,360 invoice.
test("recording a partial then a completing payment transitions invoice status correctly", async ({ page, request }) => {
  const { invoice } = await seedUnpaidInvoice(request, { price: 2000 });
  const total = Math.round(Number(invoice.total));
  const partial = Math.round(total / 3);
  const remainder = total - partial;

  await page.goto("/dashboard/invoices");
  await expect(page.getByRole("heading", { name: "Order Invoices" })).toBeVisible();

  const row = page.locator(`tr:has-text("${invoice.invoice_number}")`);
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row.getByText("sent", { exact: true })).toBeVisible();

  // Partial payment.
  await row.getByRole("button", { name: "Record Payment" }).click();
  const modal = page.locator("text=Record Payment —").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  await expect(modal).toBeVisible();
  await expect(modal.getByText(`Balance outstanding: ${inr(total)}`)).toBeVisible();
  await modal.getByPlaceholder("Amount Received (₹)").fill(String(partial));
  await modal.getByRole("button", { name: "Record Payment" }).click();
  await expect(modal).toHaveCount(0, { timeout: 10000 });

  await expect(row.getByText("partially paid", { exact: false })).toBeVisible({ timeout: 10000 });
  await expect(row).toContainText(inr(remainder));

  // Completing payment for the remainder.
  await row.getByRole("button", { name: "Record Payment" }).click();
  const modal2 = page.locator("text=Record Payment —").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  await expect(modal2).toBeVisible();
  await expect(modal2.getByText(`Balance outstanding: ${inr(remainder)}`)).toBeVisible();
  await modal2.getByPlaceholder("Amount Received (₹)").fill(String(remainder));
  await modal2.getByRole("button", { name: "Record Payment" }).click();
  await expect(modal2).toHaveCount(0, { timeout: 10000 });

  await expect(row.getByText("paid", { exact: true })).toBeVisible({ timeout: 10000 });
  // A fully paid invoice's Record Payment button should disappear —
  // there's nothing left to record.
  await expect(row.getByRole("button", { name: "Record Payment" })).toHaveCount(0);

  // Verify server-side, not just the badge.
  const invoicesRes = await request.get("/api/invoices");
  const { invoices } = await invoicesRes.json();
  const updated = invoices.find((i: { id: string }) => i.id === invoice.id);
  expect(updated.status).toBe("paid");
});

test("record-payment API rejects a negative or zero amount", async ({ request }) => {
  const { invoice } = await seedUnpaidInvoice(request, { price: 1500 });
  const res = await request.post(`/api/invoices/${invoice.id}/record-payment`, {
    data: { amount: 0, paymentMode: "Cash" },
  });
  expect(res.status()).toBe(400);

  const res2 = await request.post(`/api/invoices/${invoice.id}/record-payment`, {
    data: { amount: -100, paymentMode: "Cash" },
  });
  expect(res2.status()).toBe(400);
});
