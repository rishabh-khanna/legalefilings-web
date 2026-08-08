import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Real generate-and-download flow (src/app/api/hr-letters/generate/route.ts):
// pick a template, fill its dynamic fields, submit, and confirm an
// actual PDF comes back as a download — not just that the form submits.
test("admin generates an Offer Letter PDF for real", async ({ page }) => {
  await page.goto("/dashboard/admin/hr-letters");
  await expect(page.getByRole("heading", { name: "HR Letter Generator" })).toBeVisible({ timeout: 15000 });

  // Offer Letter is the default (first) template — its fields are the
  // common set plus Proposed Joining Date and Annual CTC. Labels aren't
  // wired via htmlFor/id, so fields are found structurally.
  await expect(page.getByRole("button", { name: "Offer Letter", exact: true })).toBeVisible();
  await page.locator("text=Employee Name").locator("xpath=following-sibling::input[1]").fill("Playwright Test Employee");
  await page.locator("text=Designation").locator("xpath=following-sibling::input[1]").fill("Software Engineer");
  await page.locator("text=Department").locator("xpath=following-sibling::input[1]").fill("Engineering");
  await page.locator("text=Proposed Joining Date").locator("xpath=following-sibling::input[1]").fill("2026-09-01");
  await page.locator("text=Annual CTC (₹)").locator("xpath=following-sibling::input[1]").fill("1200000");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("Offer-Letter");
  await expect(page.getByText("Letter generated and downloaded.")).toBeVisible({ timeout: 10000 });
});

// Switching templates should swap the field set — Relieving Letter has
// no CTC field, confirming the form is actually template-driven, not a
// fixed set that silently ignores the picked template.
test("switching templates changes which fields are shown", async ({ page }) => {
  await page.goto("/dashboard/admin/hr-letters");
  await expect(page.getByRole("heading", { name: "HR Letter Generator" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Annual CTC (₹)")).toBeVisible();

  await page.getByRole("button", { name: "Relieving Letter" }).click();
  await expect(page.getByText("Annual CTC (₹)")).toHaveCount(0);
});

// The generate API itself only checks isStaffOrAdmin (any staff level
// can call it) — the actual admin-only restriction is enforced one
// layer up, at the page/route level in proxy.ts's ADMIN_ONLY_SECTIONS,
// same pattern as Analytics/Departments/etc.
test("a staff member without the hr_letters tool grant is bounced away from the page", async ({ browser }) => {
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const raterPage = await raterCtx.newPage();
  await raterPage.goto("/dashboard/admin/hr-letters");
  await expect(raterPage).toHaveURL(/\/dashboard$/, { timeout: 10000 });
  await raterCtx.close();
});
