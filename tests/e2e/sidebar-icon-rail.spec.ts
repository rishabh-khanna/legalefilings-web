import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Real smoke test for the sidebar's grouped-section flyout (DashboardShell.tsx)
// — confirms no runtime crash and that a grouped section's hover-triggered
// flyout actually opens, stacks above page content, and navigates.
test("dashboard loads with no console errors and the sidebar renders", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

  await page.goto("/dashboard");
  await expect(page.getByText("Welcome back").first()).toBeVisible({ timeout: 15000 });
  expect(errors, `console/page errors: ${JSON.stringify(errors)}`).toEqual([]);

  const rail = page.locator("nav").filter({ has: page.locator('a[href="/dashboard"]') }).first();
  await expect(rail).toBeVisible();
});

test("hovering a grouped section opens its flyout, and clicking a link inside navigates", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Welcome back").first()).toBeVisible({ timeout: 15000 });

  // "Sales & Billing" is one of the grouped sections for a staff/admin
  // account — hovering its row should open a flyout listing its items.
  const groupRow = page.getByRole("button", { name: "Sales & Billing" });
  await expect(groupRow).toBeVisible();
  await groupRow.hover();

  const flyout = page.locator("div.absolute", { hasText: "Sales & Billing" }).first();
  await expect(flyout).toBeVisible();
  await expect(flyout.getByText("Orders", { exact: true })).toBeVisible();

  await flyout.getByText("Orders", { exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders/);
  // Flyout should close on navigation, not linger open on the new page.
  await expect(flyout).toHaveCount(0);
});

test("moving the mouse away from an open flyout closes it", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Welcome back").first()).toBeVisible({ timeout: 15000 });

  const groupRow = page.getByRole("button", { name: "Sales & Billing" });
  await groupRow.hover();
  const flyout = page.locator("div.absolute", { hasText: "Sales & Billing" }).first();
  await expect(flyout).toBeVisible();

  // Move the pointer well away from both the rail row and the flyout
  // itself — scheduleClose's 150ms timer should then fire and close it.
  await page.mouse.move(900, 500);
  await expect(flyout).toHaveCount(0, { timeout: 5000 });
});
