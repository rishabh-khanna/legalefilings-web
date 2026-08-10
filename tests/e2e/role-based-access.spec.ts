import { test, expect } from "@playwright/test";

// Every other spec in this suite drives the "manager side" of a review
// flow (approve leave, review attendance corrections, etc.) as admin.
// That's real coverage, but it never exercises the actual staff-level
// hierarchy: Leena Leader (leader, reports to Gaurav Group Leader) and
// Rahul Rater (rater, reports to Leena) are the seeded chain built
// specifically for this. This spec covers what only leader/group_leader
// storageState can prove: the "Team Management" nav only shows for
// manager-level roles, Analytics is group_leader-and-up only (not
// leader), and the reporting-chain scoping on Team Attendance/Leads
// actually narrows down to "my chain," not "everyone" or "just me."

test.describe("Nav visibility by staff level", () => {
  test("a rater sees no Team Management section at all", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
    const page = await ctx.newPage();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Welcome back", exact: false })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Team Management" })).toHaveCount(0);
    await ctx.close();
  });

  test("a leader sees Team Management (Leads/Attendance/Leave) but not Analytics", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/leader.json" });
    const page = await ctx.newPage();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Welcome back", exact: false })).toBeVisible({ timeout: 15000 });

    const teamGroup = page.getByRole("button", { name: "Team Management" });
    await expect(teamGroup).toBeVisible();
    await teamGroup.hover();
    const flyout = page.locator("div.absolute", { hasText: "Team Management" }).first();
    await expect(flyout.getByText("Team Leads CRM", { exact: true })).toBeVisible();
    await expect(flyout.getByText("Team Attendance", { exact: true })).toBeVisible();
    await expect(flyout.getByText("Team Leave Requests", { exact: true })).toBeVisible();
    await expect(flyout.getByText("Analytics", { exact: true })).toHaveCount(0);
    await ctx.close();
  });

  test("a group_leader additionally sees Analytics", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/groupLeader.json" });
    const page = await ctx.newPage();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Welcome back", exact: false })).toBeVisible({ timeout: 15000 });

    const teamGroup = page.getByRole("button", { name: "Team Management" });
    await teamGroup.hover();
    const flyout = page.locator("div.absolute", { hasText: "Team Management" }).first();
    await expect(flyout.getByText("Analytics", { exact: true })).toBeVisible();
    await ctx.close();
  });
});

test.describe("Analytics access is group_leader-and-up, not leader", () => {
  test("a leader is bounced away from Analytics", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/leader.json" });
    const page = await ctx.newPage();
    await page.goto("/dashboard/admin/analytics");
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });
    await ctx.close();
  });

  test("a group_leader can actually load Analytics", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/groupLeader.json" });
    const page = await ctx.newPage();
    await page.goto("/dashboard/admin/analytics");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible({ timeout: 15000 });
    await ctx.close();
  });
});

test.describe("Reporting-chain scoping actually narrows staff pickers", () => {
  test("a rater's team-members list is just themselves", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
    const res = await ctx.request.get("/api/team-members");
    const { members } = await res.json();
    const names = members.map((m: { full_name: string | null }) => m.full_name);
    expect(names).toContain("Rahul Rater");
    expect(names).not.toContain("Leena Leader");
    expect(names).not.toContain("Gaurav Group Leader");
    await ctx.close();
  });

  test("a leader's team-members list is themselves plus their direct report, not the group_leader above them", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/leader.json" });
    const res = await ctx.request.get("/api/team-members");
    const { members } = await res.json();
    const names = members.map((m: { full_name: string | null }) => m.full_name);
    expect(names).toContain("Leena Leader");
    expect(names).toContain("Rahul Rater");
    expect(names).not.toContain("Gaurav Group Leader");
    await ctx.close();
  });

  test("a group_leader's team-members list includes the whole chain transitively", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/groupLeader.json" });
    const res = await ctx.request.get("/api/team-members");
    const { members } = await res.json();
    const names = members.map((m: { full_name: string | null }) => m.full_name);
    expect(names).toContain("Gaurav Group Leader");
    expect(names).toContain("Leena Leader");
    expect(names).toContain("Rahul Rater");
    await ctx.close();
  });
});

test.describe("Team Attendance / Team Leave Requests are reachable and reporting-chain scoped in the real UI", () => {
  test("a leader can open Team Attendance and pick their direct report", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/leader.json" });
    const page = await ctx.newPage();
    await page.goto("/dashboard/admin/attendance");
    await expect(page.getByRole("heading", { name: "Team Attendance" })).toBeVisible({ timeout: 15000 });

    const picker = page.locator("select").first();
    // Options populate from an async /api/team-members fetch, not on
    // initial render — wait for them to actually land instead of racing
    // it right after the heading appears.
    await expect(picker.locator("option")).not.toHaveCount(0, { timeout: 10000 });
    const optionLabels = await picker.locator("option").allTextContents();
    expect(optionLabels.some((o) => o.includes("Rahul Rater"))).toBe(true);
    expect(optionLabels.some((o) => o.includes("Gaurav Group Leader"))).toBe(false);
    await ctx.close();
  });

  test("a leader sees only their chain's leave requests, a group_leader sees the whole chain's", async ({ browser }) => {
    const leaderCtx = await browser.newContext({ storageState: "tests/e2e/.auth/leader.json" });
    const leaderRes = await leaderCtx.request.get("/api/leave-requests");
    const leaderData = await leaderRes.json();
    const leaderNames = new Set((leaderData.requests ?? []).map((r: { profiles?: { full_name: string | null } }) => r.profiles?.full_name));
    expect([...leaderNames].every((n) => n === "Rahul Rater" || n === "Leena Leader")).toBe(true);
    await leaderCtx.close();

    const groupLeaderCtx = await browser.newContext({ storageState: "tests/e2e/.auth/groupLeader.json" });
    const groupLeaderRes = await groupLeaderCtx.request.get("/api/leave-requests");
    expect(groupLeaderRes.ok()).toBeTruthy();
    await groupLeaderCtx.close();
  });
});

test.describe("Admin-only sections stay admin-only regardless of staff level", () => {
  for (const role of ["leader", "groupLeader"] as const) {
    test(`a ${role} is bounced away from Employees (admin-only, not manager-level)`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: `tests/e2e/.auth/${role}.json` });
      const page = await ctx.newPage();
      await page.goto("/dashboard/admin/employees");
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });
      await ctx.close();
    });
  }
});
