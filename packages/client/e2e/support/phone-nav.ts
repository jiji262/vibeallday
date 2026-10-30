import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { e2ePaths, expect } from "../fixtures.js";

/**
 * Phone navigation after the VAD redesign. Phones (< 768px) and touch
 * devices below 1100px navigate by a bottom tab bar (Sessions, New,
 * Projects, More) that shows only on the root pages /inbox, /sessions,
 * /projects and /more. Session details have no tab bar and no drawer
 * launcher; their header carries a "Back to sessions" link. Other deep pages
 * show the drawer launcher. Agents, Issues, Bang commands, Source control,
 * Devices and Switch host live on the More page there.
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

/** Mirrors NavigationLayout's TAB_BAR_MEDIA_QUERY below DESKTOP_BREAKPOINT. */
const PHONE_SHELL_QUERY = "(width < 768px), (pointer: coarse)";
const DESKTOP_BREAKPOINT = 1100;
const SESSION_DETAIL_PATH = /\/projects\/[^/]+\/sessions\/[^/]+/;

function isPhoneShell(page: Page): Promise<boolean> {
  return page.evaluate(
    ({ query, breakpoint }) =>
      window.matchMedia(query).matches && window.innerWidth < breakpoint,
    { query: PHONE_SHELL_QUERY, breakpoint: DESKTOP_BREAKPOINT },
  );
}

function isSessionDetail(page: Page): boolean {
  return SESSION_DETAIL_PATH.test(new URL(page.url()).pathname);
}

/** How long a project's session list may take to show the target row. */
const SAME_PROJECT_LIST_WAIT_MS = 3000;

/** Switch through phone navigation or the desktop sidebar. */
export async function openSession(
  page: Page,
  sessionPath: string,
): Promise<void> {
  const navigation = tabBar(page);
  const back = page
    .locator("header.session-header")
    .filter({ visible: true })
    .getByRole("link", { name: "Back to sessions", exact: true })
    .first();
  const listLink = page
    .locator("main.page-scroll-container")
    .locator(`a.session-list-item__link[href="${sessionPath}"]`)
    .first();
  // A phone session detail has neither the tab bar nor a launcher: return to
  // its project's session list, a root page, and pick the target there.
  // Decide from the route, not the bar: the bar of the list just left can
  // still be leaving the DOM right after a navigation.
  if ((await isPhoneShell(page)) && isSessionDetail(page)) {
    await back.click();
    await expect(page).toHaveURL(/\/sessions\?/);
    await expect(navigation).toBeVisible();
    const listed = await listLink
      .waitFor({ state: "visible", timeout: SAME_PROJECT_LIST_WAIT_MS })
      .then(() => true)
      .catch(() => false);
    if (listed) {
      await listLink.click();
      return;
    }
  }
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
  await listLink.click();
}
