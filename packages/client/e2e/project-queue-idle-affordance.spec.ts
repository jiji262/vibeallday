import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { e2ePaths, expect, test } from "./fixtures.js";

// Seeded before the server starts; specs that write sessions into the shared
// mockproject make it busy for 30 s (e2e/support/default-profile.ts).
const idleProjectPath = join(e2ePaths.tempDir, "idle-queue-project");
const projectId = Buffer.from(idleProjectPath).toString("base64url");
const sessionId = "idle-queue-session";

test.use({ serviceWorkers: "block" });

async function dismissOnboardingIfVisible(page: Page) {
  const dialog = page.getByText("Welcome to VibeAllDay");
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;
  await page.getByRole("button", { name: "Skip all" }).click({ force: true });
  await expect(dialog).not.toBeVisible();
}

async function expectNoIdleProjectQueueAction(page: Page) {
  const action = page.getByRole("button", {
    name: "Queue for Project Queue",
  });
  await expect(action).toHaveCount(0);
}

test("hides the current-session Project Queue action while idle", async ({
  page,
  baseURL,
}) => {
  const captureDir = process.env.VIBEALLDAY_E2E_UI_CAPTURE_DIR;
  if (captureDir) mkdirSync(captureDir, { recursive: true });

  await page.addInitScript(() => {
    localStorage.setItem(
      "vibeallday-session-toolbar-presence",
      JSON.stringify({ projectQueue: "pin" }),
    );
  });

  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto(`${baseURL}/projects/${projectId}/sessions/${sessionId}`);
  await dismissOnboardingIfVisible(page);
  await page
    .locator("[data-composer-input]")
    .fill("Queue this after the project is idle");
  await expectNoIdleProjectQueueAction(page);
  if (captureDir) {
    await page.screenshot({
      animations: "disabled",
      path: join(captureDir, "desktop-1000x600.png"),
    });
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await expectNoIdleProjectQueueAction(page);
  if (captureDir) {
    await page.screenshot({
      animations: "disabled",
      path: join(captureDir, "phone-375x812.png"),
    });
  }
});
