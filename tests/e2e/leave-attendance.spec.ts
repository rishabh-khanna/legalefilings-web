import { test, expect } from "@playwright/test";

// Leave: staff submits via the real form, admin approves/rejects via the
// real buttons — admin can act on anyone in the org (canApproveFor allows
// account_type === "admin" regardless of reporting chain), so no need to
// fuss with the rater's actual manager for these.

test.describe("Leave requests", () => {
  test("staff submits a leave request and admin approves it via the real UI", async ({ browser }) => {
    const tag = `Playwright e2e — approve path ${Date.now()}`;
    const staffCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
    const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
    const staffPage = await staffCtx.newPage();
    const adminPage = await adminCtx.newPage();

    await staffPage.goto("/dashboard/leave");
    await expect(staffPage.getByRole("heading", { name: "Leave" })).toBeVisible();
    await staffPage.getByRole("button", { name: "Apply for Leave" }).click();

    // Offset derived from Date.now(), not a fixed day count — a fixed
    // "+30 days" collides with a still-pending request from an earlier
    // run today the moment this suite runs more than once in a day.
    const start = new Date();
    start.setDate(start.getDate() + 30 + (Date.now() % 500));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    // Leave type is a DetailPickerModal now, not a plain <select> — but
    // its default value ("") already matches "Unpaid Leave", which needs
    // no org-specific leave-type balance to exist, so there's nothing to
    // pick here; submitting with the picker untouched exercises the same
    // submit/approve/reject flow this test is actually about. The form
    // itself is a modal overlay now, not inline content.
    await staffPage.locator('input[type="date"]').first().fill(startStr);
    await staffPage.locator('input[type="date"]').nth(1).fill(endStr);
    await staffPage.locator("textarea").fill(tag);
    await staffPage.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(staffPage.getByText("Leave request submitted.")).toBeVisible({ timeout: 10000 });

    // Request list is a real <table> now — one <tr> per request.
    const staffRow = staffPage.locator("tr", { hasText: tag });
    await expect(staffRow.getByText("pending", { exact: true })).toBeVisible();

    await adminPage.goto("/dashboard/admin/leave-requests");
    await expect(adminPage.getByRole("heading", { name: "Leave Requests" })).toBeVisible();
    // DataTable paginates and groups by staff now — search narrows
    // straight to this request instead of assuming it's on page 1.
    await adminPage.getByPlaceholder("Search staff, leave type, reason…").fill(tag);
    const adminRow = adminPage.locator("tr", { hasText: tag });
    await expect(adminRow).toBeVisible({ timeout: 10000 });
    await adminRow.getByRole("button", { name: "Approve" }).click();
    await expect(adminRow.getByText("approved", { exact: true })).toBeVisible({ timeout: 10000 });

    await staffPage.reload();
    const staffRowAfter = staffPage.locator("tr", { hasText: tag });
    await expect(staffRowAfter.getByText("approved", { exact: true })).toBeVisible({ timeout: 10000 });

    await staffCtx.close();
    await adminCtx.close();
  });

  test("admin rejects a leave request with a reason, visible back to the requester", async ({ browser }) => {
    const tag = `Playwright e2e — reject path ${Date.now()}`;
    const staffCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
    const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
    const staffPage = await staffCtx.newPage();
    const adminPage = await adminCtx.newPage();

    await staffPage.goto("/dashboard/leave");
    await staffPage.getByRole("button", { name: "Apply for Leave" }).click();

    // Same reasoning as the approve-path test above — a randomized offset
    // avoids colliding with a still-pending request from an earlier run
    // today.
    const start = new Date();
    start.setDate(start.getDate() + 540 + (Date.now() % 500));
    const startStr = start.toISOString().slice(0, 10);

    await staffPage.locator('input[type="date"]').first().fill(startStr);
    await staffPage.locator('input[type="date"]').nth(1).fill(startStr);
    await staffPage.locator("textarea").fill(tag);
    await staffPage.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(staffPage.getByText("Leave request submitted.")).toBeVisible({ timeout: 10000 });

    await adminPage.goto("/dashboard/admin/leave-requests");
    // DataTable paginates and groups by staff now — search narrows
    // straight to this request instead of assuming it's on page 1.
    await adminPage.getByPlaceholder("Search staff, leave type, reason…").fill(tag);
    const adminRow = adminPage.locator("tr", { hasText: tag });
    await expect(adminRow).toBeVisible({ timeout: 10000 });
    await adminRow.getByRole("button", { name: "Reject", exact: true }).click();
    await adminRow.getByPlaceholder("Reason").fill("Team is short-staffed that week");
    await adminRow.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(adminRow.getByText("rejected", { exact: true })).toBeVisible({ timeout: 10000 });

    await staffPage.reload();
    const staffRowAfter = staffPage.locator("tr", { hasText: tag });
    await expect(staffRowAfter.getByText("rejected", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(staffRowAfter.getByText("Team is short-staffed that week")).toBeVisible();

    await staffCtx.close();
    await adminCtx.close();
  });

  test("even an admin cannot approve their own leave request", async ({ browser }) => {
    const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
    const api = adminCtx.request;

    // canApproveFor's first rule is "never the requester themselves, at
    // any level, including admin acting on their own request" — this
    // covers that guard specifically, distinct from the direct-manager
    // rule the UI tests above exercise.
    // leaveTypeId: null — explicit Unpaid Leave, which needs no balance
    // lookup and isn't what's under test here; the self-approval guard
    // applies regardless of leave type.
    // Randomized far-future date, not a fixed one — a fixed date collides
    // with a still-pending request from an earlier run of this same test.
    const guardStart = new Date();
    guardStart.setDate(guardStart.getDate() + 1080 + (Date.now() % 500));
    const guardEnd = new Date(guardStart);
    guardEnd.setDate(guardEnd.getDate() + 1);
    const submitRes = await api.post("/api/leave-requests", {
      data: { leaveTypeId: null, startDate: guardStart.toISOString().slice(0, 10), endDate: guardEnd.toISOString().slice(0, 10), reason: "self-approve guard" },
    });
    expect(submitRes.ok(), await submitRes.text()).toBeTruthy();
    const { requests: created } = await submitRes.json();

    const approveRes = await api.patch(`/api/leave-requests/${created[0].id}`, { data: { decision: "approve" } });
    expect(approveRes.status()).toBe(403);

    await adminCtx.close();
  });
});

test.describe("Attendance", () => {
  test.use({ storageState: "tests/e2e/.auth/rater.json" });

  test("staff can clock in and out, and the history/elapsed timer reflect it", async ({ page, request }) => {
    // Reset to a known "not clocked in" state regardless of what earlier
    // runs/seed data left behind, since /api/attendance's guard is
    // strictly sequential (can't check in twice in a row).
    const existing = await request.get("/api/attendance");
    const { events } = await existing.json();
    const today = new Date().toISOString().slice(0, 10);
    const todays = (events as { event_type: string; occurred_at: string }[]).filter((e: { occurred_at: string }) => e.occurred_at.slice(0, 10) === today);
    const last = todays[todays.length - 1];
    if (last?.event_type === "check_in") {
      await request.post("/api/attendance", { data: { type: "check_out" } });
    }

    await page.goto("/dashboard/attendance");
    // exact:true — the page also has an "Attendance Log" section
    // heading, which substring-matches "Attendance" too.
    await expect(page.getByRole("heading", { name: "Attendance", exact: true })).toBeVisible();
    await expect(page.getByText("Not clocked in", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Clock In" }).click();
    // handleClock() waits on navigator.geolocation (5s timeout in this
    // headless context before resolving null) before its POST + refetch
    // even starts — generous timeout to avoid a pure timing flake.
    await expect(page.getByText("Elapsed")).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: "Clock In" })).toBeDisabled();

    await page.getByRole("button", { name: "Clock Out" }).click();
    await expect(page.getByRole("button", { name: "Clock Out" })).toBeDisabled({ timeout: 10000 });

    const todayRow = page.locator(`tr:has-text("${today}")`);
    await expect(todayRow).toBeVisible();
    await expect(todayRow.locator("td").nth(3)).not.toHaveText("—");
  });

  test("clocking in twice in a row is rejected, not silently duplicated", async ({ request }) => {
    const existing = await request.get("/api/attendance");
    const { events } = await existing.json();
    const today = new Date().toISOString().slice(0, 10);
    const todays = (events as { event_type: string; occurred_at: string }[]).filter((e: { occurred_at: string }) => e.occurred_at.slice(0, 10) === today);
    if (todays[todays.length - 1]?.event_type !== "check_in") {
      await request.post("/api/attendance", { data: { type: "check_in" } });
    }
    const dupe = await request.post("/api/attendance", { data: { type: "check_in" } });
    expect(dupe.status()).toBe(409);
    // leave state clean for other tests
    await request.post("/api/attendance", { data: { type: "check_out" } });
  });

  test("staff can request an attendance correction and admin can approve it, adding a real event", async ({ page, request, browser }) => {
    const tag = `Playwright e2e correction — forgot to clock in ${Date.now()}`;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const dateStr = pastDate.toISOString().slice(0, 10);

    // Split out from /dashboard/attendance onto its own page/nav item —
    // see src/app/dashboard/attendance/corrections/page.tsx.
    await page.goto("/dashboard/attendance/corrections");
    await page.getByRole("button", { name: "Request a Correction" }).click();
    await page.locator('form input[type="date"]').fill(dateStr);
    await page.locator('input[type="time"]').first().fill("09:15");
    await page.locator('input[type="time"]').nth(1).fill("18:30");
    await page.locator("textarea").fill(tag);
    await page.getByRole("button", { name: "Submit Request" }).click();
    await expect(page.getByText("Correction request submitted.")).toBeVisible({ timeout: 10000 });

    // Request list is a real <table> now — one <tr> per request.
    const ownRow = page.locator("tr", { hasText: tag });
    await expect(ownRow).toBeVisible({ timeout: 10000 });
    await expect(ownRow.getByText("pending", { exact: true })).toBeVisible();

    const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
    const adminPage = await adminCtx.newPage();
    await adminPage.goto("/dashboard/admin/attendance");
    await expect(adminPage.getByRole("heading", { name: "Team Attendance" })).toBeVisible();
    // Attendance Log is the default tab — Correction Requests is a
    // separate tab and its table isn't in the DOM until selected.
    await adminPage.getByRole("button", { name: "Correction Requests", exact: false }).click();

    // Corrections review is also a real <table> now, not stacked cards.
    const correctionRow = adminPage.locator("tr", { hasText: tag });
    await expect(correctionRow).toBeVisible({ timeout: 10000 });
    await correctionRow.getByRole("button", { name: "Approve" }).click();
    // The row itself never disappears (approved/rejected corrections stay
    // listed for the record) — only its status badge and Approve/Reject
    // buttons change. Assert on that durable outcome, not the
    // 4s-auto-dismissing toast, which can come and go before this
    // assertion's next poll under full-suite load.
    await expect(correctionRow.getByText("approved", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(correctionRow.getByRole("button", { name: "Approve" })).toHaveCount(0);

    const check = await request.get(`/api/attendance?month=${dateStr.slice(0, 7)}`);
    const { events } = await check.json();
    const onThatDay = (events as { occurred_at: string }[]).filter((e: { occurred_at: string }) => e.occurred_at.slice(0, 10) === dateStr);
    expect(onThatDay.length).toBeGreaterThanOrEqual(2);

    await adminCtx.close();
  });

  test("admin can reject a correction request with a reason via the native prompt", async ({ page, browser }) => {
    const tag = `Playwright e2e correction — reject path ${Date.now()}`;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 11);
    const dateStr = pastDate.toISOString().slice(0, 10);

    await page.goto("/dashboard/attendance/corrections");
    await page.getByRole("button", { name: "Request a Correction" }).click();
    await page.locator('form input[type="date"]').fill(dateStr);
    await page.locator('input[type="time"]').first().fill("09:00");
    await page.locator("textarea").fill(tag);
    await page.getByRole("button", { name: "Submit Request" }).click();
    await expect(page.getByText("Correction request submitted.")).toBeVisible({ timeout: 10000 });

    const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
    const adminPage = await adminCtx.newPage();
    adminPage.on("dialog", (dialog) => dialog.accept("Not enough detail provided"));
    await adminPage.goto("/dashboard/admin/attendance");
    await adminPage.getByRole("button", { name: "Correction Requests", exact: false }).click();

    const correctionRow = adminPage.locator("tr", { hasText: tag });
    await expect(correctionRow).toBeVisible({ timeout: 10000 });
    await correctionRow.getByRole("button", { name: "Reject" }).click();
    // Same as the approve case above — the row stays, just with its
    // status/actions updated.
    await expect(correctionRow.getByText("rejected", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(correctionRow.getByRole("button", { name: "Reject" })).toHaveCount(0);

    await adminCtx.close();
  });
});
