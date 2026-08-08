import { test, expect } from "@playwright/test";

// Admin sees "Create User" (direct creation via /api/admin/create-user)
// — real click-through: create a customer account and confirm a temp
// password comes back, proving the account was actually created, not
// just a form submit that looked successful.
test.describe("Create User — admin", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("admin creates a customer account directly and gets a temp password", async ({ page }) => {
    const suffix = Date.now();
    const email = `create-user-flow-${suffix}@example.com`;

    await page.goto("/dashboard/admin/users");
    await expect(page.getByRole("heading", { name: "Create User" })).toBeVisible({ timeout: 15000 });

    await page.locator("text=Full Name").locator("xpath=following-sibling::input[1]").fill(`Create User Flow ${suffix}`);
    await page.locator("text=Email").locator("xpath=following-sibling::input[1]").fill(email);
    await page.getByRole("button", { name: "Create User", exact: true }).click();

    await expect(page.getByText("Account created.")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Temporary password", { exact: false })).toBeVisible();
    await expect(page.locator("span.font-mono.font-semibold")).toBeVisible();
  });
});

// A non-admin staff member sees "Request New User" instead — it lands
// in the account_requests approval queue rather than creating a live
// account (see /api/account-requests/request-user).
test.describe("Create User — non-admin staff", () => {
  test.use({ storageState: "tests/e2e/.auth/rater.json" });

  test("a non-admin staff member's Create User page is actually a request, not direct creation", async ({ page, request }) => {
    const suffix = Date.now();
    const email = `request-user-flow-${suffix}@example.com`;

    await page.goto("/dashboard/admin/users");
    await expect(page.getByRole("heading", { name: "Request New User" })).toBeVisible({ timeout: 15000 });

    await page.locator("text=Full Name").locator("xpath=following-sibling::input[1]").fill(`Request User Flow ${suffix}`);
    await page.locator("text=Email").locator("xpath=following-sibling::input[1]").fill(email);
    await page.getByRole("button", { name: "Submit Request" }).click();
    await expect(page.getByText("Request submitted", { exact: false })).toBeVisible({ timeout: 15000 });

    // No temp password should ever appear for a non-admin submitter — this
    // is a pending request, not a live account.
    await expect(page.getByText("Temporary password", { exact: false })).toHaveCount(0);

    // Verify server-side via the public status-check endpoint (the same
    // one a submitter would use to check on their own request) — it
    // should show up as "pending", not "approved".
    const statusRes = await request.get(`/api/account-requests?email=${encodeURIComponent(email)}`);
    expect(statusRes.ok()).toBeTruthy();
    const { request: accountRequest } = await statusRes.json();
    expect(accountRequest, "account request not found via status-check API").toBeTruthy();
    expect(accountRequest.status).toBe("pending");
  });
});
