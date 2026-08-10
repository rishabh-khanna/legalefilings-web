import { test, expect } from "@playwright/test";

// customerPaid's Business Finance book is set up for real by
// business-finance-setup.spec.ts (idempotent — already done by the time
// this file runs). These specs cover the sub-pages that spec doesn't:
// Activity, Budgets, Import, Recurring, Reports, Settings, Team.
test.use({ storageState: "tests/e2e/.auth/customerPaid.json" });

test("Activity log shows a real recorded action", async ({ page }) => {
  await page.goto("/dashboard/finance/activity");
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible({ timeout: 15000 });
  // business-finance-setup.spec.ts already recorded at least one expense
  // transaction against this book — the audit log should show it, not
  // "No activity recorded yet."
  await expect(page.getByText("No activity recorded yet.")).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByText("added an expense", { exact: false }).first()).toBeVisible();
});

test("admin sets a monthly budget for a category and sees spend tracked against it", async ({ page }) => {
  await page.goto("/dashboard/finance/budgets");
  await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible({ timeout: 15000 });

  await page.locator("text=Category").locator("xpath=following-sibling::select[1]").selectOption({ index: 1 });
  const categoryLabel = await page.locator("text=Category").locator("xpath=following-sibling::select[1]").locator("option:checked").textContent();
  await page.locator("text=Monthly Cap").locator("xpath=following-sibling::input[1]").fill("50000");
  await page.getByRole("button", { name: "Set Budget" }).click();

  const cleanLabel = categoryLabel!.replace(" (already budgeted)", "");
  const budgetCard = page.locator("div", { hasText: cleanLabel }).filter({ hasText: "remaining" }).first();
  await expect(budgetCard).toBeVisible({ timeout: 10000 });
  await expect(budgetCard.getByText("of ₹50,000.00", { exact: false })).toBeVisible();
});

test("Import from Invoices page loads and lists importable (or none) without erroring", async ({ page }) => {
  await page.goto("/dashboard/finance/import");
  await expect(page.getByRole("heading", { name: "Import from Invoices" })).toBeVisible({ timeout: 15000 });
  // Either real importable invoices show up, or the explicit empty state
  // does — either way, the page must resolve to one of them, not hang
  // on a loading spinner or throw.
  await expect(
    page.getByText("Nothing to import", { exact: false }).or(page.locator("button", { hasText: "Import as Expense" }).first())
  ).toBeVisible({ timeout: 10000 });
});

test("admin creates a recurring expense template and can pause it", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const description = `Playwright Recurring ${suffix}`;

  await page.goto("/dashboard/finance/recurring");
  await expect(page.getByRole("heading", { name: "Recurring Expenses" })).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "+ New Recurring Entry" }).click();
  await page.locator("text=Category").locator("xpath=following-sibling::select[1]").selectOption({ index: 1 });
  await page.getByPlaceholder("Description (e.g. Office Rent)").fill(description);
  await page.getByPlaceholder("Amount").fill("1200");
  // Payment Mode has no adjacent label in this form (bare <select>) — the
  // only select on the page offering a literal "Cash" option is it,
  // since Category's options are category names and the type select
  // only offers Expense/Income.
  await page.locator("select").filter({ hasText: "Cash" }).selectOption("cash");
  await page.getByPlaceholder("Vendor / Party").fill("Playwright Vendor");
  await page.getByRole("button", { name: "Save Recurring Entry" }).click();

  const row = page.locator("tr", { hasText: description });
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row.getByRole("button", { name: "Active" })).toBeVisible();

  await row.getByRole("button", { name: "Active" }).click();
  await expect(row.getByRole("button", { name: "Paused" })).toBeVisible({ timeout: 10000 });
});

test("admin runs a report and can export it as CSV/PDF", async ({ page }) => {
  await page.goto("/dashboard/finance/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "This Month" }).click();
  await expect(page.locator("table.dt-table").or(page.getByText("No data for this selection."))).toBeVisible({ timeout: 10000 });

  const csvLink = page.getByRole("link", { name: "CSV", exact: true });
  const pdfLink = page.getByRole("link", { name: "PDF", exact: true });
  await expect(csvLink).toHaveAttribute("href", /reportType=day_book/);
  await expect(pdfLink).toHaveAttribute("href", /format=pdf/);
});

test("owner changes finance alert thresholds and it persists", async ({ page }) => {
  await page.goto("/dashboard/finance/settings");
  await expect(page.getByRole("heading", { name: "Finance Settings" })).toBeVisible({ timeout: 15000 });

  await page.locator("text=Low Balance Alert Threshold").locator("xpath=following-sibling::input[1]").fill("15000");
  await page.locator("text=Large Expense Alert Threshold").locator("xpath=following-sibling::input[1]").fill("75000");
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible({ timeout: 10000 });

  await page.reload();
  await expect(page.locator("text=Low Balance Alert Threshold").locator("xpath=following-sibling::input[1]")).toHaveValue("15000");
  await expect(page.locator("text=Large Expense Alert Threshold").locator("xpath=following-sibling::input[1]")).toHaveValue("75000");
});

test("owner adds a new team member to the book with a role", async ({ page }) => {
  const suffix = Date.now();
  const email = `finance-team-${suffix}@example.com`;

  await page.goto("/dashboard/finance/team");
  await expect(page.getByRole("heading", { name: "Team" })).toBeVisible({ timeout: 15000 });

  // Scoped to the invite form specifically — BookSwitcher renders its
  // own <select> too whenever this account has access to more than one
  // book, which would otherwise shift which select ".first()" resolves to.
  const inviteForm = page.locator("form", { has: page.getByRole("button", { name: "Add to Team" }) });
  await inviteForm.locator('input[type="email"]').fill(email);
  await inviteForm.getByPlaceholder("Full Name (if new)").fill(`Finance Team ${suffix}`);
  await inviteForm.locator("select").selectOption("viewer");
  await inviteForm.getByRole("button", { name: "Add to Team" }).click();

  await expect(page.getByText(`${email} was added as viewer`, { exact: false })).toBeVisible({ timeout: 15000 });
  const row = page.locator("tr", { hasText: `Finance Team ${suffix}` });
  await expect(row).toBeVisible({ timeout: 10000 });

  // Playwright auto-DISMISSES native dialogs by default (not accepts) —
  // without an explicit handler, window.confirm() here short-circuits
  // and the member is never actually removed.
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(row).toHaveCount(0, { timeout: 10000 });
});
