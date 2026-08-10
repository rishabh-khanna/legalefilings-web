import path from "path";
import { test, expect } from "@playwright/test";

const TEST_FILE = path.join(__dirname, "fixtures", "test-document.png");

// Real upload-and-download round trip on Documents (src/app/api/employee-documents).
test.describe("Documents — admin", () => {
  test.use({ storageState: "tests/e2e/.auth/admin.json" });

  test("admin uploads a document for themselves and can download it back", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible({ timeout: 15000 });

    const beforeCount = await page.locator("tbody tr").count();

    await page.locator("text=Document Type").locator("xpath=following-sibling::select[1]").selectOption("PAN");
    await page.locator('input[type="file"]').setInputFiles(TEST_FILE);
    // exact:true — the table's now-sortable column headers ("Uploaded",
    // "Uploaded By", "Uploaded For") all substring-match "Upload" too.
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(page.getByText("Document uploaded.")).toBeVisible({ timeout: 15000 });

    const row = page.locator("tr", { hasText: "PAN" }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    const downloadLink = row.getByRole("link", { name: "Download" });
    const href = await downloadLink.getAttribute("href");
    expect(href).toMatch(/\/api\/employee-documents\/.+\/download/);

    // The route redirects to a private-bucket signed URL rather than
    // serving with Content-Disposition: attachment, so for an image
    // fixture Chromium just renders it inline — no Playwright "download"
    // event fires. Follow the redirect chain directly instead and
    // confirm it actually resolves to real, fetchable file bytes.
    const downloadRes = await page.request.get(href!);
    expect(downloadRes.ok(), await downloadRes.text().catch(() => "")).toBeTruthy();
    expect((await downloadRes.body()).byteLength).toBeGreaterThan(0);

    await expect(page.locator("tbody tr")).toHaveCount(beforeCount + 1);
  });
});

test.describe("Documents — rater", () => {
  test.use({ storageState: "tests/e2e/.auth/rater.json" });

  test("a rater without reports can't switch to view another staff member's documents", async ({ page }) => {
    await page.goto("/dashboard/documents");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible({ timeout: 15000 });
    // No one reports to a rater, so the "Viewing" switcher shouldn't even
    // be offered — same reasoning as the subtitle text confirms.
    await expect(page.getByText("Upload and manage your own documents", { exact: false })).toBeVisible();
    await expect(page.getByText("Viewing", { exact: true })).toHaveCount(0);
  });
});

test("API: a rater cannot fetch another staff member's documents by staffId", async ({ browser }) => {
  const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
  const meRes = await adminCtx.request.get("/api/admin/tool-grants");
  const { staff } = await meRes.json();
  const admin = staff.find((s: { full_name: string | null }) => s.full_name === "Asha Admin");
  expect(admin, "seeded admin 'Asha Admin' not found").toBeTruthy();
  await adminCtx.close();

  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const res = await raterCtx.request.get(`/api/employee-documents?staffId=${admin.id}`);
  expect(res.status()).toBe(403);
  await raterCtx.close();
});
