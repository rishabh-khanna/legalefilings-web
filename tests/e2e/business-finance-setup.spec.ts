import { test, expect } from "@playwright/test";

// customer.paid's Business Finance book is fresh (unset up) as of when
// this suite was written — this file both exercises the wizard's
// validation and, since setup is a one-time/irreversible action per
// book, actually completes it for real so later runs (and other specs)
// see a working book. If a future run finds setup already done, the
// wizard-specific tests are skipped rather than failing on a form that
// no longer renders.
test.use({ storageState: "tests/e2e/.auth/customerPaid.json" });

test("Business Finance page loads without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

  await page.goto("/dashboard/finance");
  await page.waitForLoadState("networkidle");
  expect(errors, `console/page errors: ${JSON.stringify(errors)}`).toEqual([]);
});

test("setup wizard blocks a half-filled bank row instead of silently dropping it", async ({ page }) => {
  await page.goto("/dashboard/finance");
  const wizard = page.getByText("Set up your Business Finance workspace");
  const dashboardReady = page.getByRole("button", { name: "Add Expense" });
  // Wait for the page to settle into ONE of its two possible states
  // before deciding which branch to take — checking isVisible() without
  // waiting can catch the page mid-render and wrongly conclude "not
  // showing" for a wizard that's about to appear a moment later.
  await Promise.race([wizard.waitFor({ state: "visible", timeout: 10000 }), dashboardReady.waitFor({ state: "visible", timeout: 10000 })]).catch(() => {});
  if (!(await wizard.isVisible().catch(() => false))) {
    test.skip(true, "book setup already completed — nothing to validate here");
  }

  // Fill in only the bank name, leave account name empty — the exact
  // scenario that used to get silently dropped on submit with zero
  // feedback (a real bug fixed earlier: FinanceSetupWizard.tsx).
  await page.getByPlaceholder("Bank Name (e.g. HDFC)").fill("HDFC Bank");
  await page.getByRole("button", { name: "Finish Setup" }).click();

  await expect(page.getByText(/needs both a bank name and an account name/)).toBeVisible({ timeout: 5000 });
  // The wizard must still be showing — a blocked submit shouldn't have
  // silently gone through.
  await expect(wizard).toBeVisible();
});

test("completing setup with clean data lands on the real Business Finance dashboard", async ({ page }) => {
  await page.goto("/dashboard/finance");
  const wizard = page.getByText("Set up your Business Finance workspace");
  const dashboardReady = page.getByRole("button", { name: "Add Expense" });
  await Promise.race([wizard.waitFor({ state: "visible", timeout: 10000 }), dashboardReady.waitFor({ state: "visible", timeout: 10000 })]).catch(() => {});
  if (!(await wizard.isVisible().catch(() => false))) {
    test.skip(true, "book setup already completed on a previous run");
  }

  // Clear the half-filled bank row left over from the validation test
  // above (same page instance would have kept it, but this is a fresh
  // navigation) and fill it in completely this time.
  await page.getByPlaceholder("Bank Name (e.g. HDFC)").fill("HDFC Bank");
  await page.getByPlaceholder("Account Name").fill("Playwright Test Business");
  await page.getByPlaceholder("Opening Balance").fill("10000");
  await page.getByPlaceholder("0").fill("5000"); // Opening Cash Balance

  await page.getByRole("button", { name: "Finish Setup" }).click();
  await expect(wizard).toHaveCount(0, { timeout: 15000 });
  // Real dashboard content that only renders once setupCompleted is true.
  await expect(page.getByRole("button", { name: "Add Expense" })).toBeVisible({ timeout: 10000 });
});

test("recording a real expense transaction shows up in the ledger", async ({ page, request }) => {
  await page.goto("/dashboard/finance");
  await expect(page.getByRole("button", { name: "Add Expense" })).toBeVisible({ timeout: 10000 });

  const description = `Playwright test expense ${Date.now()}`;
  await page.getByRole("button", { name: "Add Expense" }).click();

  // AddTransactionModal.tsx: every field is a plain <label> immediately
  // followed by its <input>/<select>, not associated via htmlFor/id —
  // same pattern seen on the Employees page, so getByLabel doesn't
  // resolve here either. Locate structurally instead.
  const modal = page.locator("text=Amount").locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
  await expect(modal).toBeVisible();

  // Category is now a required field, driven by a DetailPickerModal (a
  // custom button + overlay, not a native <select>) — rather than pick
  // whatever existing category happens to be first (ambiguous, and this
  // book's category list isn't test-owned), create a fresh one via its
  // own "+ Add new category…" row, which is deterministic regardless of
  // what already exists.
  await modal.getByText("Select a category").click();
  // The option lives in the picker overlay (rendered at the page level,
  // above the modal); the resulting inline input + Add button render
  // back inside the modal itself once picked.
  await page.getByRole("button", { name: "+ Add new category…" }).click();
  const categoryName = `Playwright Category ${Date.now()}`;
  await modal.getByPlaceholder("New category").fill(categoryName);
  await modal.getByRole("button", { name: "Add", exact: true }).click();
  // handleAddCategory's POST is async — wait for the trigger to actually
  // show the new category (proof categoryId is set) before continuing,
  // or Save can fire while it's still "", tripping "Choose a category."
  await expect(modal.getByRole("button", { name: categoryName })).toBeVisible({ timeout: 10000 });

  await modal.locator("text=Amount").locator("xpath=following-sibling::input[1]").fill("450");
  // "Cash" avoids needing a bank account selected — the default mode is "Bank".
  await modal.locator("text=Payment Mode").locator("xpath=following-sibling::select[1]").selectOption("cash");
  await modal.locator("text=Description").locator("xpath=following-sibling::input[1]").fill(description);

  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(modal).toHaveCount(0, { timeout: 10000 });

  // Verify server-side: the transaction should be findable via the API,
  // approved (or pending, depending on this book's role/approval
  // settings) and for exactly the amount entered.
  const txRes = await request.get("/api/expense-manager/transactions");
  expect(txRes.ok(), await txRes.text()).toBeTruthy();
  const { transactions } = await txRes.json();
  const created = transactions.find((t: { description: string }) => t.description === description);
  expect(created, "newly created transaction not found via API").toBeTruthy();
  expect(Number(created.amount)).toBe(450);
});
