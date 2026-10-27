import { join } from "node:path";
import type { Page } from "@playwright/test";
import { e2ePaths, expect, test } from "./fixtures.js";
import { recordUiCapture } from "./support/ui-capture.js";

test.use({ serviceWorkers: "block" });

function workbenchRecords(projectId: string) {
  const now = Date.now();
  const records = Array.from({ length: 1030 }, (_, index) => ({
    id: `workbench-${index}`,
    projectId,
    projectName: "Workbench",
    title:
      index < 25 || index === 1027
        ? `Approval ${index + 1}`
        : index === 25
          ? `项目对比：https://github.com/example/${"LongProjectName".repeat(24)}`
          : `Session ${index}`,
    provider: "claude",
    ownership: { owner: "none" },
    activity:
      index < 25 || index === 1027
        ? "waiting-input"
        : index === 25
          ? "in-turn"
          : "idle",
    pendingInputType:
      index < 25 || index === 1027 ? "tool-approval" : undefined,
    hasUnread: index === 1028 || index === 1029,
    launchSource: index === 1029 ? "codex-exec" : "claude-cli",
    messageCount: 2,
    createdAt: new Date(now - (index + 1) * 86_400_000).toISOString(),
    lastHumanTurnAt: new Date(now - (index + 1) * 86_400_000).toISOString(),
    updatedAt: new Date(now - index * 1000).toISOString(),
  }));
  return records;
}

async function mockWorkbench(
  page: Page,
  records: ReturnType<typeof workbenchRecords>,
) {
  await page.route(/\/api\/sessions(?:\?|$)/, (route) => {
    const params = new URL(route.request().url()).searchParams;
    const limit = Number(params.get("limit") ?? 100);
    const eligible =
      params.get("starred") === "true" || params.get("categorized") === "true"
        ? []
        : records;
    const cursor = params.get("after");
    const start = cursor
      ? records.findIndex((row) => row.updatedAt === cursor) + 1
      : 0;
    return route.fulfill({
      json: {
        sessions: eligible.slice(start, start + limit),
        hasMore: start + limit < eligible.length,
        total: eligible.length,
      },
    });
  });
  await page.route(/\/api\/inbox(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        needsAttention: [],
        active: [],
        recentActivity: [],
        unread8h: [],
        unread24h: [],
      },
    }),
  );
}

for (const viewport of [
  { name: "desktop", width: 1000, height: 600 },
  { name: "phone", width: 375, height: 812 },
]) {
  test(`session workbench preserves old asks, full unread and one navigation destination (${viewport.name})`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(60_000);
    const projectId = Buffer.from(
      join(e2ePaths.tempDir, "mockproject"),
    ).toString("base64url");
    const records = workbenchRecords(projectId);
    await mockWorkbench(page, records);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto(`${baseURL}/inbox?project=${projectId}`);
    const views = page.getByRole("navigation", { name: "Session views" });
    await expect(
      views.getByRole("link", { name: "Overview", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#now-tier-needsAttention")).toContainText("26");
    await expect(page.locator("#now-tier-active")).toContainText("1");
    await expect(
      page.getByRole("link", { name: "2 unread", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Loading the session catalog" }),
    ).toHaveCount(0);
    await expect(page.locator("#now-tier-unread")).toHaveCount(0);
    const rightEdge = await page
      .locator("main .session-list-item__link")
      .evaluateAll((links) =>
        Math.max(...links.map((link) => link.getBoundingClientRect().right)),
      );
    expect(rightEdge).toBeLessThanOrEqual(viewport.width);
    if (viewport.name === "phone") {
      const bar = page.getByRole("navigation", { name: "Main navigation" });
      await expect(bar.getByRole("link")).toHaveCount(4);
      await expect(bar.locator('[data-tab="sessions"]')).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(bar.locator('[data-tab="now"]')).toHaveCount(0);
    }
    await recordUiCapture(page, `session-overview-${viewport.name}`);
    await page.getByRole("link", { name: "2 unread", exact: true }).click();
    await expect(
      views.getByRole("link", { name: "All", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator("main .session-list-item--card")).toHaveCount(2);
    await expect(page.locator("main")).toContainText("Session 1028");
    await expect(page.locator("main")).toContainText("Session 1029");
    expect(new URL(page.url()).searchParams.get("project")).toBe(projectId);
    await recordUiCapture(page, `session-unread-${viewport.name}`);
    expect(errors).toEqual([]);
  });
}
