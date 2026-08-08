import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/rater.json" });

// Edit Profile writes directly via the Supabase browser client (not an
// API route) — real persistence check means reloading the page after
// save, not just trusting the optimistic "Saved." toast.
test("staff member updates their profile and it persists across a reload", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const phone = `98765${suffix.slice(-5)}`;

  await page.goto("/dashboard/profile");
  await expect(page.getByRole("heading", { name: "Edit Profile" })).toBeVisible({ timeout: 15000 });

  // Rater is staff — read-only Employee Details block should show,
  // Company field should not (that's the customer-only field).
  await expect(page.getByText("Employee Details")).toBeVisible();
  await expect(page.getByLabel("Company")).toHaveCount(0);

  // Top-level fields have real htmlFor/id label wiring, so getByLabel
  // works. The Employee Details sub-sections (Bank/Aadhaar/PAN/Emergency)
  // use bare <label> with no htmlFor — structural lookup for those.
  await page.getByLabel("Phone").fill(phone);
  await page.getByLabel("State").selectOption("Delhi");
  await page.locator("text=Bank Name").locator("xpath=following-sibling::input[1]").fill(`Playwright Bank ${suffix}`);
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 10000 });

  await page.reload();
  await expect(page.getByLabel("Phone")).toHaveValue(phone);
  await expect(page.getByLabel("State")).toHaveValue("Delhi");
  await expect(page.locator("text=Bank Name").locator("xpath=following-sibling::input[1]")).toHaveValue(`Playwright Bank ${suffix}`);
});

test("a customer account sees Company instead of Employee Details", async ({ browser }) => {
  const customerCtx = await browser.newContext({ storageState: "tests/e2e/.auth/customerFree.json" });
  const page = await customerCtx.newPage();
  await page.goto("/dashboard/profile");
  await expect(page.getByRole("heading", { name: "Edit Profile" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("Company")).toBeVisible();
  await expect(page.getByText("Employee Details")).toHaveCount(0);
  await customerCtx.close();
});
