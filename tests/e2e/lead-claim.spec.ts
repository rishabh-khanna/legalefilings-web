import { test, expect } from "@playwright/test";

// Real bug found via manual testing on the Pipeline board (Team Leads
// CRM): claiming a genuinely unassigned lead always failed with "already
// claimed by someone else," even though nobody had touched it. Root
// cause was in the API's atomic claim UPDATE — leads.assigned_to is
// NULL in the database for an unclaimed lead ("Unassigned" is only ever
// a display fallback applied in JS), but the claim query matched on the
// literal string "Unassigned", which `column = 'Unassigned'` can never
// do against a NULL column. Every real claim silently 409'd.
test("claiming a genuinely unassigned lead succeeds; a second claim on the same lead correctly still fails", async ({ browser }) => {
  const suffix = Date.now();

  // A public (unauthenticated) submission never self-assigns — this is
  // the one reliable way to get a lead that's genuinely NULL/unclaimed,
  // as opposed to one created by a logged-in staff member (which
  // self-assigns to the creator).
  const publicCtx = await browser.newContext();
  const createRes = await publicCtx.request.post("/api/leads", {
    data: { name: `Claim Test ${suffix}`, email: `claim-test-${suffix}@example.com`, phone: "9876500000" },
  });
  expect(createRes.ok(), await createRes.text()).toBeTruthy();
  const { lead } = await createRes.json();
  expect(lead.assignedTo).toBe("Unassigned");
  await publicCtx.close();

  const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });

  const firstClaim = await adminCtx.request.patch("/api/leads", { data: { id: lead.id, claim: true } });
  expect(firstClaim.ok(), await firstClaim.text()).toBeTruthy();
  const { lead: claimed } = await firstClaim.json();
  expect(claimed.assignedTo).not.toBe("Unassigned");

  // A genuine second claim on an already-taken lead should still fail —
  // the fix must not turn this into a no-op success for everyone.
  const secondClaim = await raterCtx.request.patch("/api/leads", { data: { id: lead.id, claim: true } });
  expect(secondClaim.status()).toBe(409);

  await adminCtx.close();
  await raterCtx.close();
});

test("UI: claiming a lead on the Pipeline board removes the Claim button and shows the claimer's name", async ({ browser }) => {
  const suffix = Date.now();
  const publicCtx = await browser.newContext();
  await publicCtx.request.post("/api/leads", {
    data: { name: `Claim UI Test ${suffix}`, email: `claim-ui-test-${suffix}@example.com`, phone: "9876500000" },
  });
  await publicCtx.close();

  const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
  const adminPage = await adminCtx.newPage();
  await adminPage.goto("/dashboard/admin/leads");
  await expect(adminPage.getByRole("heading", { name: "Pipeline" })).toBeVisible({ timeout: 15000 });

  // Anchor on the lead's own name text, then climb to its card — the
  // per-card element is `rounded-xl`, distinct from the column wrapper's
  // `rounded-2xl`, so this can't accidentally match the whole column.
  const card = adminPage.locator("p", { hasText: `Claim UI Test ${suffix}` }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await expect(card).toBeVisible({ timeout: 10000 });
  await card.getByRole("button", { name: "Claim" }).click();
  await expect(adminPage.getByText("Lead claimed.")).toBeVisible({ timeout: 10000 });

  await expect(card.getByRole("button", { name: "Claim" })).toHaveCount(0);
  await expect(card.getByText("Arvind Menon")).toBeVisible();

  await adminCtx.close();
});
