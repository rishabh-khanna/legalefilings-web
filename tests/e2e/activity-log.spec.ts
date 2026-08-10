import { test, expect } from "@playwright/test";
import { seedUnpaidInvoice } from "./helpers/seed";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// The org-wide Activity Log at /dashboard/admin/activity — distinct from
// Business Finance's own /dashboard/finance/activity page (already
// covered in business-finance-pages.spec.ts). This one merges
// invoice_events, order_status_history, lead_status_history and
// expense_audit_log into a single admin timeline.
test("Activity Log shows a freshly created order + invoice", async ({ page, request }) => {
  const { order, invoice } = await seedUnpaidInvoice(request, { price: 2499 });

  await page.goto("/dashboard/admin/activity");
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible({ timeout: 15000 });

  // Real data, not the empty state.
  await expect(page.getByText("Nothing recorded yet", { exact: false })).toHaveCount(0, { timeout: 10000 });

  // The invoice's own number is unique enough to prove this exact action
  // (not just any pre-existing row) shows up in the merged timeline.
  await expect(page.getByText(invoice.invoice_number, { exact: false }).first()).toBeVisible({ timeout: 10000 });
  void order;
});

test("a customer account is bounced away from the Activity Log", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/customerFree.json" });
  const page = await ctx.newPage();
  await page.goto("/dashboard/admin/activity");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });
  await ctx.close();
});
