import { test, expect } from "@playwright/test";
import path from "path";
import { seedUnpaidInvoice } from "./helpers/seed";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

const VALID_FILE = path.join(__dirname, "fixtures", "test-document.png");
const DISALLOWED_FILE = path.join(__dirname, "fixtures", "disallowed.txt");

async function openOrderDrawer(page: import("@playwright/test").Page, orderId: string) {
  await page.goto("/dashboard/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  const row = page.locator(`tr:has-text("${orderId.slice(0, 8)}")`);
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.locator("td").last().getByRole("button").click();
  // NOTE: the dashboard sidebar has its own "Documents" nav link,
  // wrapped in its own <aside>, and it sits earlier in the DOM than the
  // drawer — a plain "text=Documents" ancestor lookup silently scopes to
  // the SIDEBAR's aside instead of the drawer, making every assertion
  // below look for text that will never appear there. "PROCESS STATUS"
  // is unique to the drawer's content.
  const drawer = page.locator("aside").filter({ hasText: "PROCESS STATUS" });
  await expect(drawer).toBeVisible();
  return drawer;
}

test("uploading a document flips order status to Under Review and shows in the list", async ({ page, request }) => {
  const { order } = await seedUnpaidInvoice(request, { price: 1200 });
  const drawer = await openOrderDrawer(page, order.id);

  await expect(drawer.getByText("Documents Needed")).toBeVisible();

  await drawer.locator('input[type="file"]').setInputFiles(VALID_FILE);
  await expect(drawer.getByText("Under Review")).toBeVisible({ timeout: 10000 });
  await expect(drawer.getByText("test-document.png")).toBeVisible();
  await expect(drawer.getByText("pending", { exact: true })).toBeVisible();
});

test("uploading a disallowed file type is rejected with a clear error, not silently accepted", async ({ page, request }) => {
  const { order } = await seedUnpaidInvoice(request, { price: 1200 });
  const drawer = await openOrderDrawer(page, order.id);

  await drawer.locator('input[type="file"]').setInputFiles(DISALLOWED_FILE);
  await expect(drawer.getByText(/file type isn't allowed/)).toBeVisible({ timeout: 10000 });
  // No document row should have been created for the rejected file.
  await expect(drawer.getByText("disallowed.txt")).toHaveCount(0);
});

test("staff can verify an individual document", async ({ page, request }) => {
  const { order } = await seedUnpaidInvoice(request, { price: 1200 });
  const drawer = await openOrderDrawer(page, order.id);

  await drawer.locator('input[type="file"]').setInputFiles(VALID_FILE);
  await expect(drawer.getByText("pending", { exact: true })).toBeVisible({ timeout: 10000 });

  const docRow = drawer.locator("text=test-document.png").locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await docRow.getByRole("button", { name: "Verify" }).click();
  await expect(docRow.getByText("verified", { exact: true })).toBeVisible({ timeout: 10000 });
});

test("staff can reject a document with a note", async ({ page, request }) => {
  const { order } = await seedUnpaidInvoice(request, { price: 1200 });
  const drawer = await openOrderDrawer(page, order.id);

  await drawer.locator('input[type="file"]').setInputFiles(VALID_FILE);
  await expect(drawer.getByText("pending", { exact: true })).toBeVisible({ timeout: 10000 });

  const docRow = drawer.locator("text=test-document.png").locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await docRow.getByRole("button", { name: "Reject" }).click();
  await docRow.getByPlaceholder(/Why\?/).fill("Blurry, please re-upload");
  await docRow.getByRole("button", { name: "Confirm" }).click();

  await expect(docRow.getByText("rejected", { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(docRow.getByText("Blurry, please re-upload")).toBeVisible();
});

// Download was never covered — upload/verify/reject all were, but the
// actual download link (a redirect to a short-lived signed Supabase
// Storage URL, see the download route's own comment on why it isn't a
// permanent public link) had zero test coverage.
test("the uploaded document's download link resolves to a real signed URL, and the file is actually fetchable", async ({ page, request }) => {
  const { order } = await seedUnpaidInvoice(request, { price: 1200 });
  const drawer = await openOrderDrawer(page, order.id);

  await drawer.locator('input[type="file"]').setInputFiles(VALID_FILE);
  await expect(drawer.getByText("pending", { exact: true })).toBeVisible({ timeout: 10000 });

  const downloadLink = drawer.getByRole("link", { name: "test-document.png" });
  await expect(downloadLink).toBeVisible();
  const href = await downloadLink.getAttribute("href");
  expect(href).toMatch(new RegExp(`/api/orders/${order.id}/documents/.+/download`));

  // Follow the redirect ourselves rather than clicking (which opens a
  // new tab) — confirms both the redirect target is a real signed
  // storage URL and that URL actually serves the file, not a dead link.
  const redirectRes = await page.request.get(href!, { maxRedirects: 0 });
  expect(redirectRes.status()).toBe(307);
  const signedUrl = redirectRes.headers()["location"];
  expect(signedUrl).toBeTruthy();
  expect(signedUrl).toContain("/storage/v1/object/sign/");

  const fileRes = await page.request.get(signedUrl!);
  expect(fileRes.ok()).toBeTruthy();
  expect(fileRes.headers()["content-type"]).toContain("image");
});

test("a different customer can't download another customer's order document", async ({ page, request, browser }) => {
  const { order } = await seedUnpaidInvoice(request, { price: 1200 });
  const drawer = await openOrderDrawer(page, order.id);
  await drawer.locator('input[type="file"]').setInputFiles(VALID_FILE);
  await expect(drawer.getByText("pending", { exact: true })).toBeVisible({ timeout: 10000 });
  const href = await drawer.getByRole("link", { name: "test-document.png" }).getAttribute("href");

  const otherCustomerCtx = await browser.newContext({ storageState: "tests/e2e/.auth/customerPaid.json" });
  const res = await otherCustomerCtx.request.get(href!, { maxRedirects: 0 });
  // Either a clean 404 ("Order not found" — loadOrderForAccess scopes to
  // the caller) or, if this customer happens to own a same-shaped order
  // elsewhere, still never a 2xx/redirect to the real file.
  expect([403, 404]).toContain(res.status());
  await otherCustomerCtx.close();
});

// The actual bug fixed earlier: "Mark all verified" used to only flip
// the order-level badge, leaving individual pending document rows
// untouched underneath it — an order could read "Documents Verified"
// with zero documents actually reviewed. Confirms the individual row
// updates too, not just the order-level summary badge.
test("'Mark all verified' also verifies individual pending documents, not just the order badge", async ({ page, request }) => {
  const { order } = await seedUnpaidInvoice(request, { price: 1200 });
  const drawer = await openOrderDrawer(page, order.id);

  await drawer.locator('input[type="file"]').setInputFiles(VALID_FILE);
  await expect(drawer.getByText("pending", { exact: true })).toBeVisible({ timeout: 10000 });

  await drawer.getByRole("button", { name: "Mark all verified" }).click();
  await expect(drawer.getByText("Documents Verified")).toBeVisible({ timeout: 10000 });

  // This is the real regression check — the individual document row's
  // own status badge, not just the order-level summary.
  const docRow = drawer.locator("text=test-document.png").locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await expect(docRow.getByText("verified", { exact: true })).toBeVisible();
  await expect(docRow.getByText("pending", { exact: true })).toHaveCount(0);
});
