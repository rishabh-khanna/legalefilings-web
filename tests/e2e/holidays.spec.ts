import { test, expect } from "@playwright/test";

// Holiday Calendar: real add -> filter -> remove by an admin; a staff
// member sees the same list read-only (no Add Holiday action, no Remove
// column).
test.describe("Holidays — admin", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("admin adds a holiday, filters by type, then removes it", async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);
    const holidayName = `Playwright Holiday ${suffix}`;

    await page.goto("/dashboard/holidays");
    await expect(page.getByRole("heading", { name: "Holiday Calendar" })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Add Holiday" }).click();
    await page.getByPlaceholder("Holiday name").fill(holidayName);
    await page.locator('input[type="date"]').fill("2026-12-25");
    await page.locator("select").filter({ hasText: "Company Holiday" }).selectOption("festival");
    await page.getByRole("button", { name: "Add Holiday", exact: true }).click();
    await expect(page.getByText("Holiday added.")).toBeVisible({ timeout: 10000 });

    const row = page.locator("tr", { hasText: holidayName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("festival")).toBeVisible();

    // Filtering to "National" should hide it; back to "All types" should
    // show it again.
    await page.locator("select").filter({ hasText: "All types" }).selectOption("national");
    await expect(row).toHaveCount(0);
    await page.locator("select").filter({ hasText: "All types" }).selectOption("all");
    await expect(row).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Holiday removed.")).toBeVisible({ timeout: 10000 });
    await expect(row).toHaveCount(0);
  });
});

test.describe("Holidays — staff (read-only)", () => {
  test.use({ storageState: "tests/e2e/.auth/rater.json" });

  test("a non-admin staff member sees the calendar without any add/remove controls", async ({ page }) => {
    await page.goto("/dashboard/holidays");
    await expect(page.getByRole("heading", { name: "Holiday Calendar" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Add Holiday" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  });
});

test("API: staff without admin rights is forbidden from adding a holiday", async ({ browser }) => {
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const res = await raterCtx.request.post("/api/holidays", {
    data: { name: "Should Be Blocked", date: "2026-12-31", type: "company" },
  });
  expect(res.status()).toBe(403);
  await raterCtx.close();
});
