import { join } from "node:path";
import type { Page } from "@playwright/test";
import { e2ePaths, expect, test } from "./fixtures.js";

// Sessions of one prompt and one reply per turn, first read as their last
// three turns. Only the longer one renders through the row window once its
// history has landed.
const sessions = [
  { label: "a", project: "mockproject", turns: 90 },
  { label: "long", project: "long-history-project", turns: 120 },
] as const;
// Inside the near-bottom band at both widths, so geometry alone reads a
// reader at the top of the tail as being at the bottom.
const tailRangePx = 150;

test.use({ serviceWorkers: "block" });

function viewport(page: Page) {
  return page.locator(".session-messages");
}

function scrollGeometry(page: Page) {
  return viewport(page).evaluate((element) => ({
    clientHeight: element.clientHeight,
    range: element.scrollHeight - element.clientHeight,
    top: element.scrollTop,
  }));
}

// Grow the window until the tail overflows it by exactly `range`.
async function fitTailRange(page: Page, width: number, range: number) {
  const before = await scrollGeometry(page);
  const height = page.viewportSize()?.height ?? 0;
  await page.setViewportSize({
    width,
    height: height + before.range - range,
  });
  await expect
    .poll(() => scrollGeometry(page))
    .toMatchObject({
      range,
      top: range,
    });
}

async function rowOffset(page: Page, renderId: string) {
  return viewport(page).evaluate((element, id) => {
    const row = element.querySelector(`[data-render-id="${id}"]`);
    if (!row) throw new Error(`Row ${id} is not rendered`);
    return (
      row.getBoundingClientRect().top - element.getBoundingClientRect().top
    );
  }, renderId);
}

for (const { label, project, turns } of sessions) {
  for (const width of [1200, 375]) {
    test(`a reader at the top of a short tail keeps their place as ${turns} turns of history land at ${width}px`, async ({
      page,
      baseURL,
    }) => {
      // Room for the 30s landing budget below plus the rest of the case; the
      // suite default of 15s cannot hold it.
      test.setTimeout(60_000);
      const projectId = Buffer.from(join(e2ePaths.tempDir, project)).toString(
        "base64url",
      );
      const tailTop = `switch-${label}-user-${turns - 2}`;
      // Short enough that the tail overflows and its history boundary stays
      // out of view until the reader scrolls up.
      await page.setViewportSize({ width, height: 420 });
      await page.goto(
        `${baseURL}/projects/${projectId}/sessions/switch-scroll-${label}`,
      );
      const list = viewport(page).locator(".message-list");
      await expect(
        list.getByText(`Switch ${label} reply ${turns}.`).first(),
      ).toBeVisible();
      await expect(list).not.toHaveAttribute("aria-busy", "true");
      await fitTailRange(page, width, tailRangePx);
      await expect(list).toHaveAttribute("data-transcript-render-weight", "6");

      const offsetBefore = await viewport(page).evaluate((element, id) => {
        element.dispatchEvent(
          new WheelEvent("wheel", { bubbles: true, deltaY: -120 }),
        );
        element.scrollTop = 0;
        // Capture the baseline before the scroll event can request history.
        const row = element.querySelector(`[data-render-id="${id}"]`);
        if (!row) throw new Error(`Row ${id} is not rendered`);
        const offset =
          row.getBoundingClientRect().top - element.getBoundingClientRect().top;
        element.dispatchEvent(new Event("scroll"));
        return offset;
      }, tailTop);
      const follow = page.getByRole("button", {
        name: "Follow latest session output",
      });
      await expect(follow).toBeVisible();

      // The landing mounts the whole history in chunks, so its cost scales
      // with `turns` and with how much CPU the machine has left. Locally each
      // variant finishes in under 4s, but on a contended two-worker CI shard
      // the default 5s expect budget expired at weight 38 of 180 and the case
      // failed as a wrong value rather than as the slow landing it was. The
      // subject here is whether the reader keeps their place once the history
      // lands; how fast it lands belongs to the perf suite, so this waits for
      // the condition with a budget sized for the work.
      await expect(list).toHaveAttribute(
        "data-transcript-render-weight",
        String(turns * 2),
        { timeout: 30_000 },
      );
      // Rows mounted by the landing are measured over the following frames;
      // a scroll event from that work must not hand the reader back to Follow.
      await page.waitForTimeout(500);
      await expect(follow).toBeVisible();
      // The anchor restore writes a fractional scrollTop that Chromium snaps
      // to a device pixel.
      const shift = (await rowOffset(page, tailTop)) - offsetBefore;
      expect(Math.abs(shift)).toBeLessThanOrEqual(1);
      expect((await scrollGeometry(page)).range).toBeGreaterThan(5000);
    });
  }
}
