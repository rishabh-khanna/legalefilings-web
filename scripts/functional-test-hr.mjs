// Drives the HR features as real users rather than only loading their
// pages: clocking in and out, applying for and approving leave, adding
// and removing a holiday, requesting and approving an attendance
// correction, uploading a document, and generating an HR letter.
//
// The page-load sweep (walkthrough-all-roles.mjs) proves a screen renders
// and is correctly gated. This proves the thing on the screen actually
// works — a page can render perfectly while the button on it silently
// fails.
//
// Usage: node scripts/functional-test-hr.mjs

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const PASSWORD = "Chatak@2026";
const SHOTS = new URL("../screenshots/functional/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✓" : "  ✘"} ${name}${detail ? `  — ${detail}` : ""}`);
}

const browser = await chromium.launch();
async function signIn(email) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#login-email", email);
  await page.fill("#login-password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 25000 });
  return { ctx, page };
}
const seen = (page, text) => page.getByText(text, { exact: false }).first().isVisible().catch(() => false);

// ── Attendance: clock in, then out ──────────────────────────────────
console.log("\nAttendance — Nusrat Ali (rater)");
{
  const { ctx, page } = await signIn("nusrat.ali@chataksingh.in");
  await page.goto(`${BASE}/dashboard/attendance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const clockIn = page.getByRole("button", { name: /Clock In|Check In/i }).first();
  const clockOut = page.getByRole("button", { name: /Clock Out|Check Out/i }).first();
  if (await clockIn.isVisible().catch(() => false)) {
    await clockIn.click();
    await page.waitForTimeout(2000);
    record("clock in", await clockOut.isVisible().catch(() => false), "Clock Out button appeared");
    await clockOut.click();
    await page.waitForTimeout(2000);
    record("clock out", await clockIn.isVisible().catch(() => false), "back to Clock In");
  } else if (await clockOut.isVisible().catch(() => false)) {
    // Already clocked in from an earlier run — exercise the other half.
    await clockOut.click();
    await page.waitForTimeout(2000);
    record("clock out", await clockIn.isVisible().catch(() => false), "was already clocked in");
  } else {
    record("clock in/out", false, "found neither Clock In nor Clock Out");
    await page.screenshot({ path: `${SHOTS}attendance.png` });
  }
  await ctx.close();
}

// ── Leave: apply, then a manager approves ───────────────────────────
console.log("\nLeave — Nusrat applies, Vikas approves");
let leaveApplied = false;
{
  const { ctx, page } = await signIn("nusrat.ali@chataksingh.in");
  await page.goto(`${BASE}/dashboard/leave`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const open = page.getByRole("button", { name: /Apply for Leave/i }).first();
  if (await open.isVisible().catch(() => false)) await open.click();
  await page.waitForTimeout(800);

  const dates = page.locator('input[type="date"]');
  if (await dates.count() >= 1) {
    // Comfortably in the future: the API refuses backdated leave, and a
    // date already covered by seeded leave would collide with the
    // overlap guard.
    const d = new Date(); d.setDate(d.getDate() + 30 + (Date.now() % 60));
    const key = d.toISOString().slice(0, 10);
    await dates.nth(0).fill(key);
    if (await dates.count() >= 2) await dates.nth(1).fill(key);
    const reason = page.getByPlaceholder(/reason/i).first();
    if (await reason.isVisible().catch(() => false)) await reason.fill("Family function in Kanpur");
    const submit = page.getByRole("button", { name: /^(Apply for Leave|Submit)/i }).last();
    await submit.click();
    await page.waitForTimeout(2500);
    const body = await page.locator("body").innerText();
    leaveApplied = /Leave request submitted|Request submitted|submitted for approval/i.test(body) || /applied/i.test(body);
    record("apply for leave", leaveApplied, leaveApplied ? "request created" : body.slice(0, 120));
    if (!leaveApplied) await page.screenshot({ path: `${SHOTS}leave-apply.png` });
  } else {
    record("apply for leave", false, "no date inputs in the form");
    await page.screenshot({ path: `${SHOTS}leave-apply.png` });
  }
  await ctx.close();
}
{
  const { ctx, page } = await signIn("vikas.dwivedi@chataksingh.in");
  await page.goto(`${BASE}/dashboard/admin/leave-requests`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const row = page.locator("tr", { hasText: "Nusrat Ali" }).filter({ hasText: /pending/i }).first();
  if (await row.isVisible().catch(() => false)) {
    await row.locator("button").first().click();
    await page.waitForTimeout(2500);
    record("approve leave", await seen(page, "Leave approved"), "approved as direct manager");
  } else {
    record("approve leave", false, "no pending Nusrat row in the queue");
    await page.screenshot({ path: `${SHOTS}leave-approve.png` });
  }
  await ctx.close();
}

// ── Holidays: add, then remove ──────────────────────────────────────
console.log("\nHolidays — Rishabh (admin)");
{
  const { ctx, page } = await signIn("rishabhkhanna.93@gmail.com");
  await page.goto(`${BASE}/dashboard/holidays`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const name = `Kanpur Founders Day ${Date.now().toString().slice(-5)}`;
  await page.getByRole("button", { name: "Add Holiday" }).first().click();
  await page.waitForTimeout(600);
  await page.getByPlaceholder("Holiday name", { exact: true }).fill(name);
  // One holiday per calendar date per org, so pick a date the 2026 set
  // doesn't already use.
  const hDate = new Date(Date.UTC(2027, 0, 1) + (Date.now() % 300) * 86400000).toISOString().slice(0, 10);
  await page.locator('input[type="date"]').first().fill(hDate);
  await page.getByRole("button", { name: "Add Holiday", exact: true }).click();
  await page.waitForTimeout(2000);
  const added = await seen(page, "Holiday added");
  record("add holiday", added);
  if (added) {
    const search = page.getByPlaceholder(/Search holiday name/i).first();
    if (await search.isVisible().catch(() => false)) {
      await search.fill(name);
      await page.waitForTimeout(1000);
    }
    page.once("dialog", (d) => d.accept());
    await page.locator("tr", { hasText: name }).getByRole("button", { name: "Remove" }).click();
    await page.waitForTimeout(2000);
    record("remove holiday", await seen(page, "Holiday removed"));
  }
  await ctx.close();
}

// ── Attendance correction: request, then approve ─────────────────────
console.log("\nAttendance correction — Nusrat requests, Vikas approves");
{
  const { ctx, page } = await signIn("nusrat.ali@chataksingh.in");
  const d = new Date(); d.setDate(d.getDate() - 3);
  const res = await ctx.request.post(`${BASE}/api/attendance-corrections`, {
    data: { date: d.toISOString().slice(0, 10), checkIn: "09:30", checkOut: "18:30", reason: "Forgot to clock out — was at the Lucknow depot" },
  });
  record("request attendance correction", res.ok(), `HTTP ${res.status()}`);
  await ctx.close();
}
{
  const { ctx, page } = await signIn("vikas.dwivedi@chataksingh.in");
  await page.goto(`${BASE}/dashboard/admin/attendance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const tab = page.getByRole("button", { name: /Correction Requests/i }).first();
  if (await tab.isVisible().catch(() => false)) await tab.click();
  await page.waitForTimeout(1500);
  const row = page.locator("tr", { hasText: "Nusrat Ali" }).first();
  if (await row.isVisible().catch(() => false)) {
    await row.getByRole("button").first().click();
    await page.waitForTimeout(2500);
    const body = await page.locator("body").innerText();
    record("approve attendance correction", /approved/i.test(body));
  } else {
    record("approve attendance correction", false, "no Nusrat row in correction queue");
    await page.screenshot({ path: `${SHOTS}correction.png` });
  }
  await ctx.close();
}

// ── Documents: upload one ───────────────────────────────────────────
console.log("\nDocuments — Nusrat uploads");
{
  const { ctx, page } = await signIn("nusrat.ali@chataksingh.in");
  await page.goto(`${BASE}/dashboard/documents`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const file = page.locator('input[type="file"]').first();
  if (await file.count()) {
    await file.setInputFiles(new URL("../tests/e2e/fixtures/test-document.png", import.meta.url).pathname);
    await page.getByRole("button", { name: /^Upload/i }).first().click();
    await page.waitForTimeout(3500);
    const body = await page.locator("body").innerText();
    record("upload document", /test-document\.png/i.test(body), "appears in the list");
  } else {
    record("upload document", false, "no file input on the page");
    await page.screenshot({ path: `${SHOTS}documents.png` });
  }
  await ctx.close();
}

// ── HR letter: generate a PDF ───────────────────────────────────────
console.log("\nHR letters — Rishabh generates");
{
  const { ctx, page } = await signIn("rishabhkhanna.93@gmail.com");
  await page.goto(`${BASE}/dashboard/admin/hr-letters`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Offer Letter", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  // Positional rather than by-label: the labels aren't associated to
  // their inputs, and a loose text match resolves ahead of the field it
  // names, silently writing into the wrong box. Offer Letter's form is
  // Name / Designation / Department / Joining Date / Annual CTC.
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: /Generate PDF/i }) }).first();
  const fields = form.locator("input");
  const values = ["Priyanka Nigam", "Dispatch Executive", "Dispatch", "2026-09-01", "360000"];
  for (let i = 0; i < Math.min(await fields.count(), values.length); i++) {
    await fields.nth(i).fill(values[i]).catch(() => {});
  }
  await page.waitForTimeout(400);

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }).catch(() => null),
    page.getByRole("button", { name: /Generate/i }).first().click().catch(() => {}),
  ]);
  if (download) {
    const path = `${SHOTS}hr-letter.pdf`;
    await download.saveAs(path);
    record("generate HR letter", true, `saved ${download.suggestedFilename()}`);
  } else {
    const body = await page.locator("body").innerText();
    record("generate HR letter", /generated|success/i.test(body), body.slice(0, 120));
    await page.screenshot({ path: `${SHOTS}hr-letter.png` });
  }
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${"═".repeat(58)}\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("FAILED:");
  failed.forEach((f) => console.log(`  ${f.name} — ${f.detail ?? ""}`));
  writeFileSync(`${SHOTS}failures.json`, JSON.stringify(failed, null, 2));
}
