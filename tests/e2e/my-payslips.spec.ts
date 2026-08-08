import { test, expect } from "@playwright/test";

// My Payslips (staff self-view) — Rahul Rater has at least one real
// generated payslip from payroll-lop.spec.ts, so this exercises the
// real list + download flow rather than an empty-state smoke test.
test.use({ storageState: "tests/e2e/.auth/rater.json" });

test("staff sees their own generated payslips and can download one", async ({ page }) => {
  await page.goto("/dashboard/payslips");
  await expect(page.getByRole("heading", { name: "My Payslips" })).toBeVisible({ timeout: 15000 });

  const row = page.locator("tbody tr").first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("No payslips yet.")).toHaveCount(0);

  const downloadLink = row.getByRole("link", { name: "Download PDF" });
  const href = await downloadLink.getAttribute("href");
  expect(href).toMatch(/\/api\/payroll\/payslips\/.+\/download/);

  const downloadRes = await page.request.get(href!);
  expect(downloadRes.ok(), await downloadRes.text().catch(() => "")).toBeTruthy();
  expect((await downloadRes.body()).byteLength).toBeGreaterThan(0);
});

test("API: a rater cannot fetch another staff member's payslips by staffId", async ({ browser }) => {
  const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
  const meRes = await adminCtx.request.get("/api/admin/tool-grants");
  const { staff } = await meRes.json();
  const admin = staff.find((s: { full_name: string | null }) => s.full_name === "Asha Admin");
  expect(admin, "seeded admin 'Asha Admin' not found").toBeTruthy();
  await adminCtx.close();

  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const res = await raterCtx.request.get(`/api/payroll/payslips?staffId=${admin.id}`);
  // Either scoped down to the rater's own data (ignoring the param) or
  // explicitly forbidden — either way, it must never return someone
  // else's payslips.
  if (res.ok()) {
    const { payslips } = await res.json();
    expect(payslips.every((p: { staff_id?: string }) => !p.staff_id || p.staff_id !== admin.id)).toBe(true);
  } else {
    expect(res.status()).toBe(403);
  }
  await raterCtx.close();
});
