import { test, expect } from "@playwright/test";
import { getDbAdmin } from "./helpers/db-admin";

// src/proxy.ts's org access-expiry gate (lines ~112-127): once an org's
// access_expires_at passes, every /dashboard/* request for that org's
// staff gets redirected to /dashboard/access-expired, except the
// EXPIRY_ALLOWLIST (that page itself, and /dashboard/profile). This is
// the actual enforcement of "CRM access is bundled free with a plan for
// a year, then lapses" (see /api/platform/crm-access-requests/[id]'s
// ACCESS_DURATION_DAYS) — completely untested until now.
//
// There's no product-level way to backdate access_expires_at (the only
// place it's ever set is at CRM-access-request approval, always
// ACCESS_DURATION_DAYS in the future) — org creation via
// /api/platform/organizations leaves it null (no expiry) entirely. So:
// provision a real org through the real API, then go straight to the DB
// with the service-role key to simulate "a year has passed."
test.describe("Org access-expiry gate", () => {
  test("staff of an org whose access has expired are redirected app-wide to /dashboard/access-expired, except /dashboard/profile", async ({ browser }) => {
    test.setTimeout(60 * 1000);
    const suffix = Date.now();
    const orgName = `Access Expiry Test Co ${suffix}`;
    const adminEmail = `access-expiry-admin-${suffix}@example.com`;

    const platformCtx = await browser.newContext({ storageState: "tests/e2e/.auth/platformAdmin.json" });
    const orgRes = await platformCtx.request.post("/api/platform/organizations", {
      data: {
        name: orgName,
        slug: `access-expiry-test-${suffix}`,
        planTier: "starter",
        adminFullName: `Access Expiry Admin ${suffix}`,
        adminEmail,
      },
    });
    expect(orgRes.ok(), await orgRes.text()).toBeTruthy();
    const { organization, tempPassword } = await orgRes.json();
    await platformCtx.close();

    const db = getDbAdmin();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: backdateError } = await db.from("organizations").update({ access_expires_at: yesterday }).eq("id", organization.id);
    expect(backdateError, backdateError?.message).toBeNull();

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminPage.goto("/login");
    await adminPage.getByPlaceholder("Enter your email").fill(adminEmail);
    await adminPage.getByPlaceholder("Enter your password").fill(tempPassword);
    await adminPage.getByRole("button", { name: "Sign in" }).click();
    await expect(adminPage).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // An ordinary admin-only section bounces to access-expired...
    await adminPage.goto("/dashboard/admin/employees");
    await expect(adminPage).toHaveURL(/\/dashboard\/access-expired$/, { timeout: 10000 });
    await expect(adminPage.getByText("Your CRM access has expired", { exact: false })).toBeVisible();

    // ...and so does a non-admin-prefixed CRM page, proving the gate runs
    // on every /dashboard/* route, not just /dashboard/admin/*.
    await adminPage.goto("/dashboard/leave");
    await expect(adminPage).toHaveURL(/\/dashboard\/access-expired$/, { timeout: 10000 });

    // Profile stays reachable — explicitly allowlisted so someone can
    // still see their own details (and the renewal contact info) instead
    // of being locked out of the app entirely.
    await adminPage.goto("/dashboard/profile");
    await expect(adminPage).toHaveURL(/\/dashboard\/profile$/, { timeout: 10000 });
    await expect(adminPage.getByRole("heading", { name: "Edit Profile" })).toBeVisible({ timeout: 10000 });

    await adminCtx.close();
  });

  test("a customer account is exempt from an org's access-expiry gate — they don't belong to a CRM org to lose access to", async ({ browser }) => {
    // customerFree/customerPaid have no organization_id tied to a
    // tenant org's expiry in the way this gate checks (it's skipped
    // outright for account_type === "customer") — confirm a customer can
    // still reach an ordinary dashboard page without ever hitting the
    // access-expired redirect, using the suite's own seeded customer.
    const customerCtx = await browser.newContext({ storageState: "tests/e2e/.auth/customerPaid.json" });
    const customerPage = await customerCtx.newPage();
    await customerPage.goto("/dashboard/orders");
    await expect(customerPage).toHaveURL(/\/dashboard\/orders$/, { timeout: 10000 });
    await expect(customerPage.getByRole("heading", { name: "Order History" })).toBeVisible({ timeout: 10000 });
    await customerCtx.close();
  });
});
