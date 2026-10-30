import { expect, test } from "./fixtures.js";

test.use({ serviceWorkers: "block" });

/** Several sessions' worth of history: the server keeps 100 per session. */
const HISTORY_SIZE = 400;
const FAILURE_EVERY = 4;
const MAX_KEY_LATENCY_MS = 100;
const MINUTE_MS = 60_000;

interface TypingSample {
  latency: number;
  expected: string;
  actual: string;
}

function historyEntries() {
  const now = Date.now();
  return Array.from({ length: HISTORY_SIZE }, (_, index) => {
    const failed = index % FAILURE_EVERY === 0;
    return {
      sessionId: `session-${index % 7}`,
      projectId: "project",
      object: {
        id: `bang-${index}`,
        kind: "bang-command",
        createdAt: new Date(now - index * MINUTE_MS).toISOString(),
        placementAfterMessageId: "message",
        command: `pnpm --filter client test case-${index}`,
        cwd: `/code/project-${index % 5}`,
        status: "done",
        exitCode: failed ? 1 : 0,
        durationMs: 800,
        stdoutPreview: failed ? `FAIL case-${index}` : `PASS case-${index}`,
      },
    };
  });
}

test("history search keeps every key while 400 commands filter", async ({
  page,
  baseURL,
}) => {
  const entries = historyEntries();
  await page.route("**/api/bang-commands", (route) =>
    route.fulfill({ json: { entries } }),
  );
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(`${baseURL}/bang-commands`);
  const search = page.getByRole("searchbox", { name: "Search commands" });
  const count = page.getByText(/^\d+ \/ 400 commands$/);
  await expect(count).toHaveText("400 / 400 commands");

  await search.evaluate((node) => {
    const samples: TypingSample[] = [];
    let expected = "";
    Object.assign(window, { typingSamples: samples });
    node.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key.length !== 1) return;
      expected += key;
      const prefix = expected;
      const start = event.timeStamp;
      requestAnimationFrame(() =>
        samples.push({
          latency: performance.now() - start,
          expected: prefix,
          actual: (node as HTMLInputElement).value,
        }),
      );
    });
  });
  const text = "case-12";
  await search.click();
  await search.pressSequentially(text, { delay: 10 });
  await expect(search).toHaveValue(text);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const samples = await page.evaluate(
    () =>
      (window as unknown as { typingSamples: TypingSample[] }).typingSamples,
  );
  expect(samples).toHaveLength(text.length);
  expect(samples.every((s) => s.actual.startsWith(s.expected))).toBe(true);
  expect(Math.max(...samples.map((s) => s.latency))).toBeLessThanOrEqual(
    MAX_KEY_LATENCY_MS,
  );
  // case-12 and case-120 … case-129.
  await expect(count).toHaveText("11 / 400 commands");

  const failedOnly = page.getByRole("button", { name: /Failed only 100/ });
  await failedOnly.click();
  await expect(failedOnly).toHaveAttribute("aria-pressed", "true");
  // Of those, 12, 120, 124 and 128 failed.
  await expect(count).toHaveText("4 / 400 commands");
  await search.fill("no such command");
  await expect(page.getByText("No commands match these filters.")).toBeVisible();
});
