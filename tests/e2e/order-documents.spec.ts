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
