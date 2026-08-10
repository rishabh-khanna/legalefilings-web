import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// The company-wide payslip register — separate from Payroll (which is
// just the salary-structure form + generate action). Rahul Rater has at
// least one real generated payslip from payroll-lop.spec.ts, so this
// exercises the real register + download, not an empty state.
test("admin sees the company-wide payslip register and can download a payslip", async ({ page }) => {
  await page.goto("/dashboard/admin/payslips");
  await expect(page.getByRole("heading", { name: "Payslips" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("No payslips generated yet.")).toHaveCount(0);

  // DataTable now paginates (10 rows/page) — with enough seeded/test
  // payslips in the register, Rahul Rater's own rows aren't guaranteed
  // to land on page 1. Search narrows it down first, same as a real
  // admin would do to find one specific employee in a long register.
  // The register is also grouped by employee (groupBy on the DataTable),
  // which inserts a "Rahul Rater · N payslips" group-header row — that
  // row ALSO matches a plain hasText:"Rahul Rater" filter but has no
  // download link inside it, so anchor on a row that actually contains
  // the "Download PDF" link instead of on the name text.
  await page.getByPlaceholder("Search employee…").fill("Rahul Rater");
  const row = page.locator("tr", { has: page.getByRole("link", { name: "Download PDF" }) }).first();
  await expect(row).toBeVisible({ timeout: 10000 });

  const downloadLink = row.getByRole("link", { name: "Download PDF" });
  const href = await downloadLink.getAttribute("href");
  expect(href).toMatch(/\/api\/payroll\/payslips\/.+\/download/);
  const downloadRes = await page.request.get(href!);
  expect(downloadRes.ok(), await downloadRes.text().catch(() => "")).toBeTruthy();
  expect((await downloadRes.body()).byteLength).toBeGreaterThan(0);

  // A single-org admin's view should never show an Organization column —
  // that only appears once results genuinely span more than one org
  // (platform_admin).
  await expect(page.getByRole("columnheader", { name: "Organization" })).toHaveCount(0);
});

test("a staff member (non-admin, non-delegated) is bounced away from the payslip register page", async ({ browser }) => {
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const raterPage = await raterCtx.newPage();
  await raterPage.goto("/dashboard/admin/payslips");
  await expect(raterPage).toHaveURL(/\/dashboard$/, { timeout: 10000 });
  await raterCtx.close();
});
