import { expect, test } from "./fixtures.js";
import { openMore, tabBar } from "./support/phone-nav.js";
import { recordUiCapture } from "./support/ui-capture.js";

for (const viewport of [
  { width: 1000, height: 600 },
  { width: 375, height: 812 },
]) {
  test(`degraded provider host keeps navigation reachable at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/version", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        json: { ...(await response.json()), providerHostDegraded: true },
      });
    });
    await page.goto("/");
    const banner = page.locator('[data-provider-host-degraded="true"]');
    await expect(banner).toBeVisible();
    // Wide viewports open the drawer from the page header; phones navigate by
    // the bottom tab bar (More leads to Settings). Either way the banner must
    // not cover it.
    const phone = viewport.width < 768;
    const navigation = phone
      ? tabBar(page)
      : page.getByRole("button", { name: "Open sidebar", exact: true });
    await expect(navigation).toBeVisible();
    const bannerBox = await banner.boundingBox();
    const navigationBox = await navigation.boundingBox();
    const bannerBottom = bannerBox!.y + bannerBox!.height;
    expect(navigationBox!.y).toBeGreaterThanOrEqual(bannerBottom);
    await recordUiCapture(
      page,
      `provider-host-degraded-${viewport.width}`,
      viewport,
    );
    if (phone) {
      await openMore(page);
      await page.getByRole("link", { name: /^Settings/ }).click();
    } else {
      await navigation.click();
      await page
        .getByRole("link", { name: "Settings", exact: true })
        .first()
        .click();
    }
    await expect(page).toHaveURL(/settings/);
  });
}
