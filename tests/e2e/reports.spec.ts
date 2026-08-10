import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Reports is a page of plain CSV-download links (no JS request, just an
// <a href> to /api/reports?type=...) — the real risk is a report type
// throwing server-side on real data, not a UI interaction, so this hits
// every report type directly and checks it comes back as a real CSV
// with a header row, not an error JSON body.
const REPORT_TYPES = ["attendance", "salary", "leave", "employees", "department", "invoice-ageing"];

test("Reports page lists every report with a working Export CSV link", async ({ page }) => {
  await page.goto("/dashboard/admin/reports");
  // The page's heading is "Data Exports" — "Reports" survives only as
  // this test's own name and the nav label, not the on-page heading.
  await expect(page.getByRole("heading", { name: "Data Exports" })).toBeVisible({ timeout: 15000 });

  for (const label of ["Attendance Report", "Salary Report", "Leave Report", "Employee List", "Department-wise Report", "Invoice Ageing Report"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Export CSV" })).toHaveCount(6);
});

for (const type of REPORT_TYPES) {
  test(`API: ${type} report returns a real CSV, not an error`, async ({ request }) => {
    const res = await request.get(`/api/reports?type=${type}`);
    expect(res.ok(), await res.text()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("text/csv");
    const body = await res.text();
    const firstLine = body.split("\n")[0];
    expect(firstLine.startsWith("#,"), `unexpected header row: ${firstLine}`).toBeTruthy();
  });
}

test("API: staff without the reports tool grant is forbidden", async ({ browser }) => {
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const res = await raterCtx.request.get("/api/reports?type=employees");
  expect(res.status()).toBe(403);
  await raterCtx.close();
});
