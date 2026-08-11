import { test as setup, expect } from "@playwright/test";

// Logs in every seeded account once and saves its storage state to
// tests/e2e/.auth/<role>.json — every other spec reuses these instead of
// re-logging-in per test. All of these are created by
// scripts/seed-demo.mjs; the role names here are the suite's own labels,
// not anything the product knows about.
const DEMO_PASSWORD = "Chatak@2026";
export const ACCOUNTS = {
  admin: "arvind.menon@legalefilings.com",
  groupLeader: "kavya.reddy@legalefilings.com",
  leader: "farhan.qureshi@legalefilings.com",
  rater: "sneha.kulkarni@legalefilings.com",
  customerFree: "imran.shaikh@crescenttraders.co.in",
  customerPaid: "aarti.deshpande@deshpandetextiles.in",
  // is_platform_admin=true — a separate axis from account_type, needed
  // for /dashboard/platform/*, which an ordinary org admin (Arvind
  // above) is deliberately NOT allowed into.
  platformAdmin: "nandini.iyer@legalefilings.com",
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
