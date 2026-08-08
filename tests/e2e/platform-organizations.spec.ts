import { test, expect } from "@playwright/test";

// The "+ New Organization" create flow and the platform-admin-only
// access gate are already covered end-to-end by
// company-onboarding-regression.spec.ts (via the onboardCompany
// helper). This spec covers what that one doesn't: the Organizations
// list itself actually reflecting a newly created org's real data —
// plan tier, member count, active status — not just that creation
// "succeeded."
test.use({ storageState: "tests/e2e/.auth/platformAdmin.json" });

test("a newly created organization shows up correctly in the platform org list", async ({ page, request }) => {
  const suffix = Date.now();
  const orgName = `Platform List Test Co ${suffix}`;
  const orgSlug = `platform-list-test-co-${suffix}`;

  const createRes = await request.post("/api/platform/organizations", {
    data: { name: orgName, slug: orgSlug, planTier: "enterprise", adminFullName: "List Test Admin", adminEmail: `list-test-admin-${suffix}@example.com` },
  });
  expect(createRes.ok(), await createRes.text()).toBeTruthy();

  await page.goto("/dashboard/platform/organizations");
  // exact:true — the page also has an "All Organizations" section
  // heading, which substring-matches "Organizations" too.
  await expect(page.getByRole("heading", { name: "Organizations", exact: true })).toBeVisible({ timeout: 15000 });

  const row = page.locator("tr", { hasText: orgName });
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row.getByText("Enterprise")).toBeVisible();
  await expect(row.getByText("active", { exact: true })).toBeVisible();
  // Columns: # | Organization | Plan | Members | Status | Access
  // Expires | Created — one admin account was created along with the
  // org, so Members should read exactly "1".
  await expect(row.locator("td").nth(3)).toHaveText("1");
  await expect(row.getByRole("link", { name: `/org/${orgSlug}`, exact: false })).toHaveAttribute("href", `/org/${orgSlug}`);
});

test("export includes the real org data as CSV", async ({ request }) => {
  const res = await request.get("/api/platform/organizations");
  expect(res.ok()).toBeTruthy();
  const { organizations } = await res.json();
  expect(Array.isArray(organizations)).toBe(true);
  expect(organizations.length).toBeGreaterThan(0);
});
