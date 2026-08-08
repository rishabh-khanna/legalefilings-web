import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Invoice Item Catalog: real create -> edit -> remove of a catalog item
// (the HSN/SAC + GST rate + unit autofill source for ad-hoc invoice
// lines — see src/app/dashboard/admin/product-catalog/page.tsx).
test("admin adds a catalog item, edits its rate, then removes it", async ({ page, request }) => {
  const suffix = Date.now().toString().slice(-6);
  const itemName = `Playwright Catalog Item ${suffix}`;

  await page.goto("/dashboard/admin/product-catalog");
  await expect(page.getByRole("heading", { name: "Invoice Item Catalog" })).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Add Item" }).click();
  await page.locator("text=Name").locator("xpath=following-sibling::input[1]").fill(itemName);
  await page.locator("text=SAC Code").locator("xpath=following-sibling::input[1]").fill("998213");
  await page.locator("text=GST Rate (%)").locator("xpath=following-sibling::input[1]").fill("18");
  await page.locator("text=Unit").locator("xpath=following-sibling::input[1]").fill("Nos");
  await page.locator("text=Default Rate (₹)").locator("xpath=following-sibling::input[1]").fill("1500");
  await page.getByRole("button", { name: "Add Item", exact: true }).click();
  await expect(page.getByText("Item added to catalog.")).toBeVisible({ timeout: 10000 });

  const row = page.locator("tr", { hasText: itemName });
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row.getByText("₹1,500")).toBeVisible();

  await row.getByRole("button", { name: "Edit" }).click();
  const rateInput = page.locator("text=Default Rate (₹)").locator("xpath=following-sibling::input[1]");
  await rateInput.fill("2000");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Item updated.")).toBeVisible({ timeout: 10000 });
  await expect(row.getByText("₹2,000")).toBeVisible();

  // Verify server-side too, not just the optimistic UI.
  const listRes = await request.get("/api/product-service-master");
  const { items } = await listRes.json();
  const created = items.find((i: { name: string }) => i.name === itemName);
  expect(created, "newly created catalog item not found via API").toBeTruthy();
  expect(Number(created.default_rate)).toBe(2000);

  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Item removed.")).toBeVisible({ timeout: 10000 });
  await expect(row).toHaveCount(0, { timeout: 10000 });
});

test("API: staff without the product_catalog tool grant is forbidden from creating an item", async ({ browser }) => {
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const res = await raterCtx.request.post("/api/product-service-master", {
    data: { type: "service", name: "Should Be Blocked", gstRate: 18, unit: "Nos" },
  });
  expect(res.status()).toBe(403);
  await raterCtx.close();
});
