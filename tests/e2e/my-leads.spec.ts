import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// My Leads: real "+ Add Lead" form submit through /api/leads, then
// confirm the new lead actually appears in the assigned-to-me table
// (client-reload path keyed off the caller's own full_name), with a
// working WhatsApp follow-up link.
test("staff adds a lead via the real form and sees it in their own list", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const leadName = `Playwright Lead ${suffix}`;

  await page.goto("/dashboard/crm");
  await expect(page.getByRole("heading", { name: "My Leads" })).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "+ Add Lead" }).click();
  await page.locator('input[name="name"]').fill(leadName);
  await page.locator('input[name="company"]').fill("Playwright Test Co");
  await page.locator('input[name="email"]').fill(`playwright-lead-${suffix}@example.com`);
  await page.locator('input[name="phone"]').fill("9876543210");
  await page.getByRole("button", { name: "Save Lead" }).click();
  await expect(page.getByText("Lead added.")).toBeVisible({ timeout: 10000 });

  const row = page.locator("tr", { hasText: leadName });
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row.getByText("New", { exact: true })).toBeVisible();
  await expect(row.getByText("Playwright Test Co")).toBeVisible();
  await expect(row.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /wa\.me/);

  // Filtering by status should still surface it (default stage is "new").
  // "All statuses" is one of this select's own option labels — search
  // placeholder text isn't real DOM text, so anchor on the select itself.
  await page.locator("select").filter({ hasText: "All statuses" }).selectOption({ label: "New" });
  await expect(row).toBeVisible();
});

test("API: a lead created by one staff member doesn't leak into another's My Leads list", async ({ browser }) => {
  const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
  const suffix = Date.now();
  const leadEmail = `isolation-lead-${suffix}@example.com`;
  const createRes = await adminCtx.request.post("/api/leads", {
    data: { name: `Isolation Lead ${suffix}`, email: leadEmail, phone: "9876500000" },
  });
  expect(createRes.ok(), await createRes.text()).toBeTruthy();
  await adminCtx.close();

  // This lead was created by the admin (assigned_to = admin's name by
  // default via /api/leads) — a rater's My Leads page queries leads
  // assigned to their own name, so it should never show up there.
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const raterPage = await raterCtx.newPage();
  await raterPage.goto("/dashboard/crm");
  await expect(raterPage.getByRole("heading", { name: "My Leads" })).toBeVisible({ timeout: 15000 });
  await expect(raterPage.getByText(leadEmail)).toHaveCount(0);
  await raterCtx.close();
});
