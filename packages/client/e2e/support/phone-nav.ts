import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { e2ePaths, expect } from "../fixtures.js";

/**
 * Phone navigation after the Garden redesign. Phones (< 768px) and touch
 * devices below 1100px navigate by a bottom tab bar (Sessions, New,
 * Projects, More); the page headers of tab-bar routes have no drawer
 * launcher. Session details keep the bar and use a back link in the header.
 * Agents, Issues, Bang commands, Source control, Devices and Switch host live
 * on the More page there.
 */
export function tabBar(page: Page): Locator {
  return page.getByRole("navigation", { name: "Main navigation" });
}

export function moreTab(page: Page): Locator {
  return tabBar(page).getByRole("link", { name: "More", exact: true });
}

/** Opens the More page from the tab bar (phones and touch tablets only). */
export async function openMore(page: Page): Promise<void> {
  await moreTab(page).click();
  await expect(moreTab(page)).toHaveAttribute("aria-current", "page");
}

function mockSessionPath(sessionId = "mock-session-001"): string {
  const projectId = Buffer.from(join(e2ePaths.tempDir, "mockproject")).toString(
    "base64url",
  );
  return `/projects/${projectId}/sessions/${sessionId}`;
}

/** Opens the overlay drawer in a constrained, fine-pointer desktop window. */
export async function openNarrowDrawerFromSession(
  page: Page,
  baseURL: string | undefined,
  sessionId?: string,
): Promise<void> {
  await page.setViewportSize({ width: 900, height: 812 });
  await page.goto(`${baseURL}${mockSessionPath(sessionId)}`);
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await expect(page.locator(".sidebar")).toBeVisible();
}

/** Switch through phone navigation or the desktop sidebar. */
export async function openSession(
  page: Page,
  sessionPath: string,
): Promise<void> {
  const navigation = tabBar(page);
  if (await navigation.isVisible()) {
    await navigation.locator('[data-tab="sessions"]').click();
    await page
      .getByRole("navigation", { name: "Session views" })
      .getByRole("link", { name: "All", exact: true })
      .click();
  } else {
    const sidebar = page.locator(".sidebar");
    if (!(await sidebar.isVisible())) {
      await page
        .getByRole("button", { name: "Open sidebar", exact: true })
        .click();
      await expect(sidebar).toBeVisible();
    }
    const link = sidebar.locator(`a[href="${sessionPath}"]`).first();
    if (await link.isVisible()) {
      await link.click();
      return;
    }
    await sidebar
      .getByRole("link", { name: "View all sessions", exact: true })
      .click();
  }
  await page
    .locator("main.page-scroll-container")
    .locator(`a.session-list-item__link[href="${sessionPath}"]`)
    .first()
    .click();
}
