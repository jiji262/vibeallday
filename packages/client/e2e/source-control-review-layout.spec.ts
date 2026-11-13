import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { e2ePaths, expect, test } from "./fixtures.js";

const projectPath = join(e2ePaths.tempDir, "source-control-toolbar-project");
const fileName =
  "claude-gateway-process-start-and-output-collector-with-an-intentionally-long-layout-name-that-wraps-at-medium-width.ts";
const relativePath = `src/${fileName}`;
const projectId = Buffer.from(projectPath).toString("base64url");
/** The floating button keeps the board's corner inset (28px / 24px). */
const CORNER_SLACK = 60;

test.use({ serviceWorkers: "block" });

// The same idempotent edit as the toolbar layout spec: one tracked change.
test.beforeAll(({ workerServer }) => {
  void workerServer;
  writeFileSync(
    join(projectPath, relativePath),
    "export const toolbarLayoutFixture = true;\n",
  );
});

/** One pending draft, served to this page only; no shared state is written. */
async function servePendingDraft(page: Page) {
  await page.route("**/api/projects/*/review/comments", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      json: {
        comments: [
          {
            id: "draft-1",
            anchor: {
              path: relativePath,
              revision: { kind: "worktree" },
              side: "new",
              oldLine: null,
              newLine: 1,
              snippet: "export const toolbarLayoutFixture = true;",
            },
            text: "Should this be exported?",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
        ],
        batches: [],
        pendingCount: 1,
      },
    });
  });
}

test("diff layout is a segmented choice that persists on this device", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1400, height: 700 });
  const url = `${baseURL}/git-status?projectId=${projectId}&worktreeFile=${encodeURIComponent(relativePath)}`;
  await page.goto(url);
  const layout = page.getByRole("radiogroup", { name: "Diff layout" });
  await expect(layout.getByRole("radio", { name: "Auto" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.locator(".side-by-side-diff")).toHaveCount(0);

  await layout.getByRole("radio", { name: "Side-by-side" }).click();
  await expect(page.locator(".side-by-side-diff")).toBeVisible();
  await page.reload();
  await expect(
    layout.getByRole("radio", { name: "Side-by-side" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".side-by-side-diff")).toBeVisible();

  await layout.getByRole("radio", { name: "Side-by-side" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(layout.getByRole("radio", { name: "Unified" })).toBeFocused();
  await expect(page.locator(".side-by-side-diff")).toHaveCount(0);
});

test("pending drafts float a submit button outside the review tab", async ({
  page,
  baseURL,
}) => {
  await servePendingDraft(page);
  const viewport = { width: 1200, height: 700 };
  await page.setViewportSize(viewport);
  await page.goto(`${baseURL}/git-status?projectId=${projectId}`);
  const submit = page.getByRole("button", { name: "Submit review 1" });
  await expect(submit).toBeVisible();
  const box = await submit.boundingBox();
  expect(box!.x + box!.width).toBeGreaterThan(viewport.width - CORNER_SLACK);
  expect(box!.y + box!.height).toBeGreaterThan(viewport.height - CORNER_SLACK);

  await submit.click();
  const dialog = page.getByRole("dialog", { name: "Submit review" });
  await expect(dialog).toBeVisible();
  await expect(submit).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(submit).toBeVisible();

  await page.getByRole("tab", { name: /Reviews/ }).click();
  await expect(submit).toHaveCount(0);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${baseURL}/git-status?projectId=${projectId}`);
  const card = page.getByRole("complementary", {
    name: "1 pending review comment(s)",
  });
  await expect(card).toContainText(`${fileName}:1`);
  await card.getByRole("button", { name: "Submit review" }).click();
  await expect(dialog).toBeVisible();
});
