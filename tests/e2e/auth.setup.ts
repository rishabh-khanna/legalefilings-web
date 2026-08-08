import { test as setup, expect } from "@playwright/test";

// Logs in every seeded demo account once and saves its storage state to
// tests/e2e/.auth/<role>.json — every other spec reuses these instead of
// re-logging-in per test. Demo password/accounts come straight from
// src/components/DemoLoginCredentials.tsx (seeded by scripts/seed-database.mjs).
const DEMO_PASSWORD = "Demo@12345";
export const ACCOUNTS = {
  admin: "admin@legalefilings.com",
  groupLeader: "groupleader@legalefilings.com",
  leader: "leader@legalefilings.com",
  rater: "rater@legalefilings.com",
  customerFree: "customer.free@legalefilings.com",
  customerPaid: "customer.paid@legalefilings.com",
  // Dedicated is_platform_admin=true test account (not one of the seeded
  // org-scoped demo accounts above) — provisioned once via a one-off
  // admin script, same password as every other demo account. Needed for
  // /dashboard/platform/organizations, which the regular seeded admin
  // account is deliberately NOT allowed into (org-scoped admin, not
  // platform admin).
  platformAdmin: "platformadmin.e2e@legalefilings.com",
} as const;

for (const [role, email] of Object.entries(ACCOUNTS)) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Enter your email").fill(email);
    await page.getByPlaceholder("Enter your password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await page.context().storageState({ path: `tests/e2e/.auth/${role}.json` });
  });
}
