import { test, expect } from "@playwright/test";

// Holiday Calendar: real add -> filter -> remove by an admin; a staff
// member sees the same list read-only (no Add Holiday action, no Remove
// column).
test.describe("Holidays — admin", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("admin adds a holiday, filters by type, then removes it", async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);
    const holidayName = `Playwright Holiday ${suffix}`;
    // A fixed date collides with any earlier run's holiday still sitting
    // in the DB (one holiday per calendar date per org — see
    // api/holidays/route.ts's 23505 handling) if that run failed before
    // reaching the Remove step. Derive a date from the suffix instead so
    // every run gets its own.
    const dayOffset = 1 + (Number(suffix) % 300);
    const holidayDate = new Date(Date.UTC(2027, 0, 1) + dayOffset * 86400000).toISOString().slice(0, 10);

    await page.goto("/dashboard/holidays");
    await expect(page.getByRole("heading", { name: "Holiday Calendar" })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Add Holiday" }).click();
    await page.getByPlaceholder("Holiday name").fill(holidayName);
    await page.locator('input[type="date"]').fill(holidayDate);
    await page.locator("select").filter({ hasText: "Company Holiday" }).selectOption("festival");
    await page.getByRole("button", { name: "Add Holiday", exact: true }).click();
    await expect(page.getByText("Holiday added.")).toBeVisible({ timeout: 10000 });

    const row = page.locator("tr", { hasText: holidayName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("festival")).toBeVisible();

    // Filtering to "National" should hide it; clearing the filter should
    // show it again. The type filter is a MultiSelect (checkbox popover),
    // not a native <select> — its trigger's own label cycles through
    // "All types" / one option's label / "N selected" as the selection
    // changes (see MultiSelect.tsx), so match any of those rather than
    // one fixed string, which would stop matching after the first click.
    // Excludes the header's "Notifications — N need attention" button,
    // which also carries aria-expanded.
    // The trigger's accessible name also includes its little count badge
    // (e.g. "National 1") once something's selected, so this can't be an
    // exact match.
    const typeFilterTrigger = page.getByRole("button", { name: /^(All types|National|Festival|Company)( \d+)?$|^\d+ selected$/ });
    await typeFilterTrigger.click();
    await page.getByRole("button", { name: "National", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(row).toHaveCount(0);
    await typeFilterTrigger.click();
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await page.keyboard.press("Escape");
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
