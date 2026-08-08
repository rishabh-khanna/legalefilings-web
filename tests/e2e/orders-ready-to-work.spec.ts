import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

test("Orders page 'Ready to work' filter toggles the visible row count", async ({ page }) => {
  await page.goto("/dashboard/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();

  const toggle = page.getByRole("button", { name: /Ready to work/ });
  await expect(toggle).toBeVisible();

  const rowsBefore = await page.locator("tbody tr").count();

  await toggle.click();
  await expect(page.getByRole("button", { name: /Showing ready to work/ })).toBeVisible();
  const rowsAfterFilter = await page.locator("tbody tr").count();

  // Filtering can only ever narrow the list (or match it exactly if every
  // order happens to be ready) — it should never show MORE rows than the
  // unfiltered view.
  expect(rowsAfterFilter).toBeLessThanOrEqual(rowsBefore);

  // Toggle back off — should return to the original (or a superset) count.
  await page.getByRole("button", { name: /Showing ready to work/ }).click();
  await expect(toggle).toBeVisible();
  const rowsAfterToggleOff = await page.locator("tbody tr").count();
  expect(rowsAfterToggleOff).toBeGreaterThanOrEqual(rowsAfterFilter);
});
