import { expect, test } from "./fixtures";
import { recordUiCapture } from "./support/ui-capture.js";

test("browser Settings ignores retired shell metadata", async ({
  page,
  baseURL,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__VIBEALLDAY_DESKTOP_RUNTIME__", {
      value: { desktopVersion: "0.2.2", nativeUpdateCheck: true },
    });
  });
  for (const viewport of [
    { width: 1000, height: 600 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseURL}/settings/about`);
    await expect(page.getByText(/^Server: /)).toBeVisible();
    await expect(page.getByText(/^Client: /)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Check for Updates", exact: true }),
    ).toHaveCount(0);
    await recordUiCapture(page, `web-about-version-${viewport.width}`);
  }
});
