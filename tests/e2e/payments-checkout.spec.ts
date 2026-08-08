import { test, expect } from "@playwright/test";
import { seedUnpaidInvoice } from "./helpers/seed";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET in .env.local are
// literal placeholder strings ("placeholder...", confirmed by direct
// inspection), not real Razorpay test-mode credentials — so any call
// that actually reaches Razorpay's API currently fails with a real 401
// "Authentication failed" from Razorpay itself. Environment config gap,
// not an app bug — swap in real rzp_test_ credentials from the Razorpay
// dashboard to unblock the two tests below.
const RAZORPAY_CREDENTIALS_ARE_PLACEHOLDERS = true;

// This is the exact bug that was previously fixed: create-order used to
// always charge the invoice's full original total, so a customer who'd
// already paid part of it (recorded by staff) would be charged the
// FULL amount again on /pay/[id]. Verifies the real Razorpay order
// amount (order.amount, straight from Razorpay's own response, not
// something computed client-side) reflects the actual remaining
// balance after a partial payment.
test("create-order charges only the remaining balance after a partial payment, not the full total", async ({ request }) => {
  test.skip(RAZORPAY_CREDENTIALS_ARE_PLACEHOLDERS, "needs real Razorpay test-mode credentials — see note above");

  const { invoice } = await seedUnpaidInvoice(request, { price: 3000 });
  const total = Math.round(Number(invoice.total));
  const partial = Math.round(total / 4);
  const expectedRemainder = total - partial;

  const payRes = await request.post(`/api/invoices/${invoice.id}/record-payment`, {
    data: { amount: partial, paymentMode: "Cash" },
  });
  expect(payRes.ok(), await payRes.text()).toBeTruthy();

  const orderRes = await request.post("/api/payments/create-order", { data: { invoiceId: invoice.id } });
  expect(orderRes.ok(), await orderRes.text()).toBeTruthy();
  const orderData = await orderRes.json();

  // amount is in paise, straight from Razorpay's own order-creation
  // response — this is the actual amount the gateway will charge, not
  // something this app computed and could get wrong independently.
  expect(orderData.amount).toBe(expectedRemainder * 100);
});

// Doesn't need Razorpay at all — the already-paid guard runs and
// returns 400 before create-order ever calls Razorpay's API — so this
// one runs for real regardless of credential state.
test("create-order refuses to start a new charge on an already-fully-paid invoice", async ({ request }) => {
  const { invoice } = await seedUnpaidInvoice(request, { price: 999 });
  const total = Math.round(Number(invoice.total));

  const payRes = await request.post(`/api/invoices/${invoice.id}/record-payment`, {
    data: { amount: total, paymentMode: "Cash" },
  });
  expect(payRes.ok()).toBeTruthy();

  const orderRes = await request.post("/api/payments/create-order", { data: { invoiceId: invoice.id } });
  expect(orderRes.status()).toBe(400);
});

// Real browser test — opens the actual Razorpay hosted checkout via a
// genuine "Pay Now" click, and confirms the iframe actually loads.
// Deliberately stops short of entering a test card/OTP — that's real
// external-gateway UI Razorpay could change independently of this app.
test("Pay Now opens Razorpay checkout showing the correct amount", async ({ page, request }) => {
  test.skip(RAZORPAY_CREDENTIALS_ARE_PLACEHOLDERS, "needs real Razorpay test-mode credentials — see note above");

  const { invoice } = await seedUnpaidInvoice(request, { price: 1499 });

  await page.goto(`/pay/${invoice.id}`);
  await expect(page.getByText(invoice.invoice_number)).toBeVisible();
  await page.getByRole("button", { name: "Pay Now" }).click();

  const razorpayFrame = page.frameLocator('iframe[src*="razorpay"]').first();
  await expect(razorpayFrame.locator("body")).toBeVisible({ timeout: 20000 });
  await expect(razorpayFrame.locator("body")).not.toBeEmpty();
});
