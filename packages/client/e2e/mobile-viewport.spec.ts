import { join } from "node:path";
import { e2ePaths, expect, test } from "./fixtures.js";
import { recordUiCapture } from "./support/ui-capture.js";

/** Resolved bottom safe-area inset of an edge-to-edge Android browser. */
const SAFE_AREA_BOTTOM = 24;

for (const degraded of [false, true]) {
  test(`mobile shell stays anchored with safe-area spacing (degraded host: ${degraded})`, async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route("**/api/version", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        json: { ...(await response.json()), providerHostDegraded: degraded },
      });
    });
    const projectId = Buffer.from(
      join(e2ePaths.tempDir, "mockproject"),
    ).toString("base64url");
    for (const path of [
      `/projects/${projectId}/sessions/mock-session-001`,
      "/inbox",
    ]) {
      await page.goto(path);
      const header = page.locator(".session-header").filter({ visible: true });
      await expect(header).toBeVisible();
      if (path !== "/inbox") {
        await expect(
          page.getByRole("main").getByText("Previous message", { exact: true }),
        ).toBeVisible();
      }
      const banner = page.locator('[data-provider-host-degraded="true"]');
      if (degraded) await expect(banner).toBeVisible();

      // Desktop Chromium has zero native safe-area insets. Supply the same
      // resolved safe-area spacing as an edge-to-edge Android browser. The
      // tab bar is root-only: on /inbox it owns that inset; on a session
      // detail there is no tab bar, so the composer sits directly on the
      // inset. Neither may make the outer document scroll.
      await page.addStyleTag({
        content: `body, .session-page { padding-bottom: ${SAFE_AREA_BOTTOM}px; }
          nav[aria-label="Main navigation"] {
            padding-bottom: ${SAFE_AREA_BOTTOM}px;
            height: calc(var(--tabbar-height) + ${SAFE_AREA_BOTTOM}px);
          }`,
      });
      for (const height of [812, 480, 812]) {
        await page.setViewportSize({ width: 375, height });
        await page.evaluate(() => window.scrollTo(0, 100));
        await expect
          .poll(() =>
            page.evaluate(() => ({
              scroll: window.scrollY,
              overflow:
                (document.scrollingElement?.scrollHeight ?? 0) -
                window.innerHeight,
            })),
          )
          .toEqual({ scroll: 0, overflow: 0 });
        const headerBox = await header.boundingBox();
        expect(headerBox!.y).toBeGreaterThanOrEqual(0);
        if (degraded) {
          const bannerBox = await banner.boundingBox();
          expect(headerBox!.y).toBeGreaterThanOrEqual(
            bannerBox!.y + bannerBox!.height,
          );
        }
        if (path !== "/inbox") {
          const composer = page.locator("footer.session-input");
          await expect(composer).toBeVisible();
          await expect(
            page.getByRole("navigation", { name: "Main navigation" }),
          ).toHaveCount(0);
          await expect
            .poll(async () => {
              const box = await composer.boundingBox();
              return box
                ? Math.round(height - SAFE_AREA_BOTTOM - box.y - box.height)
                : null;
            })
            .toBe(0);
        } else {
          await expect(
            page.getByRole("navigation", { name: "Main navigation" }),
          ).toBeVisible();
        }
      }
      await recordUiCapture(
        page,
        `mobile-viewport-${path === "/inbox" ? "inbox" : "session"}-${degraded ? "degraded" : "healthy"}`,
      );
    }
  });
}
