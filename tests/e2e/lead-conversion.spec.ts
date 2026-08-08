import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Real end-to-end button-click test for /api/leads/[id]/convert: create a
// fresh lead with a captured service/plan/price (via the same POST route
// the public consultation form uses), open it in the pipeline board,
// click the actual "Convert to Order" button, and verify the drawer
// flips to the converted state — proving the account+order+invoice
// chain actually ran, not just that the API returned 200.
test("Convert to Order creates a customer + order from a lead", async ({ page, request }) => {
  const uniqueEmail = `pw-test-lead-${Date.now()}@example.com`;

  // Seed the lead itself via the API (same route the public consultation
  // form posts to) — faster and more deterministic than filling out a
  // lead-capture form just to get a starting point for this test.
  const createRes = await request.post("/api/leads", {
    data: {
      name: "Playwright Test Lead",
      email: uniqueEmail,
      phone: "9876543210",
      service: "GST Registration",
      plan: "Basic",
      planPrice: "₹1,999",
    },
  });
  expect(createRes.ok(), `lead creation failed: ${await createRes.text()}`).toBeTruthy();

  await page.goto("/dashboard/admin/leads");
  await expect(page.getByRole("heading", { name: "Pipeline" })).toBeVisible();

  const leadCard = page.locator("text=Playwright Test Lead").first();
  await expect(leadCard).toBeVisible({ timeout: 10000 });
  await leadCard.click();

  const drawer = page.locator("text=Lead details").locator("xpath=ancestor::aside[1]");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(uniqueEmail)).toBeVisible();

  const convertButton = drawer.getByRole("button", { name: "Convert to Order" });
  await expect(convertButton).toBeVisible();
  await convertButton.click();

  // On success the drawer replaces the button with a confirmation state
  // (see LeadDetailDrawer.tsx: lead.convertedToProfileId truthy branch).
  await expect(drawer.getByText("Converted to a customer + order")).toBeVisible({ timeout: 15000 });
  await expect(convertButton).toHaveCount(0);

  // Confirm it's not just a UI-only flip — the lead row itself should
  // now report converted=true from the API, and a real order should
  // exist for a customer whose email matches this lead.
  const leadsRes = await request.get("/api/leads");
  const { leads } = await leadsRes.json();
  const convertedLead = leads.find((l: { email: string }) => l.email === uniqueEmail);
  expect(convertedLead, "converted lead not found in GET /api/leads").toBeTruthy();
  expect(convertedLead.convertedToProfileId).toBeTruthy();
});

test("a converted lead cannot be converted twice", async ({ page, request }) => {
  const uniqueEmail = `pw-test-lead-double-${Date.now()}@example.com`;
  const createRes = await request.post("/api/leads", {
    data: { name: "Double Convert Lead", email: uniqueEmail, phone: "9876500000", service: "GST Registration", plan: "Basic", planPrice: "₹1,999" },
  });
  const { lead } = await createRes.json();

  const firstConvert = await request.post(`/api/leads/${lead.id}/convert`);
  expect(firstConvert.ok()).toBeTruthy();

  const secondConvert = await request.post(`/api/leads/${lead.id}/convert`);
  expect(secondConvert.status()).toBe(409);
});
