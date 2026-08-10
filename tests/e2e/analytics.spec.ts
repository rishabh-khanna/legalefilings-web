import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Read-only server-rendered page (src/app/dashboard/admin/analytics/page.tsx)
// aggregating real invoices/leads/orders — the risk here isn't a form
// flow, it's the aggregation queries throwing or a chart failing to
// mount against real (possibly zero-row) data. Smoke-covers both: the
// KPI row and all four chart cards actually render.
test("Analytics page renders KPIs and all four charts from real data", async ({ page }) => {
  await page.goto("/dashboard/admin/analytics");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible({ timeout: 15000 });

  // "Collected" — deliberately not "Total Revenue" (money actually
  // received, not invoiced) — plus "Outstanding" alongside it.
  await expect(page.getByText("Collected")).toBeVisible();
  await expect(page.getByText("Outstanding")).toBeVisible();
  await expect(page.getByText("Total Leads")).toBeVisible();
  await expect(page.getByText("Total Orders")).toBeVisible();
  await expect(page.getByText("Deals Won")).toBeVisible();

  await expect(page.getByText("Revenue by Month")).toBeVisible();
  await expect(page.getByText("Leads by Stage")).toBeVisible();
  await expect(page.getByText("Orders by Status")).toBeVisible();
  await expect(page.getByText("Staff Leaderboard — Leads Won vs Assigned")).toBeVisible();
});

test("API: staff without the analytics tool grant is bounced away from the page", async ({ browser }) => {
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const raterPage = await raterCtx.newPage();
  await raterPage.goto("/dashboard/admin/analytics");
  await expect(raterPage).toHaveURL(/\/dashboard$/, { timeout: 10000 });
  await raterCtx.close();
});
