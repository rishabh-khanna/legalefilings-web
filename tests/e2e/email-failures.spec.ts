import { test, expect } from "@playwright/test";
import { getDbAdmin } from "./helpers/db-admin";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Functional coverage — not just the nav smoke-check paid-customer-full-
// access.spec.ts does. There's no product path that makes a real
// transactional email fail on demand, so this seeds a row directly into
// email_failures (same pattern access-expiry-gate.spec.ts uses for
// backdating org access — see helpers/db-admin.ts), then drives the real
// "Resolve" button through the actual UI/API.
test("admin sees a real email failure and can mark it resolved", async ({ page, request }) => {
  const orgRes = await request.get("/api/business-settings");
  expect(orgRes.ok()).toBeTruthy();
  const { settings } = await orgRes.json();
  const organizationId = settings.organization_id;

  const recipient = `playwright-failure-${Date.now()}@example.com`;
  const db = getDbAdmin();
  const { data: failure, error } = await db
    .from("email_failures")
    .insert({
      organization_id: organizationId,
      email_type: "payment_confirmation",
      recipient_email: recipient,
      related_entity: "invoice:playwright-test",
      error_message: "SMTP connection timed out (seeded by Playwright)",
      resolved: false,
    })
    .select()
    .single();
  if (error) throw new Error(`seed email_failures: ${error.message}`);

  await page.goto("/dashboard/admin/email-failures");
  await expect(page.getByRole("heading", { name: "Email Failures" })).toBeVisible({ timeout: 15000 });

  const row = page.locator("tr", { hasText: recipient });
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row.getByText("Payment Confirmation")).toBeVisible();
  await expect(row.getByText("SMTP connection timed out", { exact: false })).toBeVisible();

  await row.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText("Marked resolved.")).toBeVisible({ timeout: 10000 });

  // Default view is unresolved-only — the row must actually disappear,
  // not just show a success toast while staying visible.
  await expect(page.locator("tr", { hasText: recipient })).toHaveCount(0, { timeout: 10000 });

  const { data: after } = await db.from("email_failures").select("resolved, resolved_by").eq("id", failure.id).single();
  expect(after?.resolved).toBe(true);
  expect(after?.resolved_by).toBeTruthy();
});

test("a customer account is bounced away from Email Failures", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/customerFree.json" });
  const page = await ctx.newPage();
  await page.goto("/dashboard/admin/email-failures");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });
  await ctx.close();
});
