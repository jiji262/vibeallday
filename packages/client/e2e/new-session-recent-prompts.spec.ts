import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures.js";

test.use({ serviceWorkers: "block", draftSessionIds: [] });

/** The history store keeps fifty prompts; the page shows the newest three. */
const HISTORY_SIZE = 50;
const MAX_KEY_LATENCY_MS = 100;

interface TypingSample {
  latency: number;
  expected: string;
  actual: string;
}

/** Seed the local account's composer history before the app reads it. */
async function seedHistory(page: Page) {
  await page.addInitScript((count) => {
    const now = Date.now();
    const prompts = Array.from({ length: count }, (_, index) => ({
      text: `Recent prompt ${index + 1}`,
      at: now - (index + 1) * 60_000,
    }));
    const open = indexedDB.open("vibeallday-composer-history", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("accounts");
    open.onsuccess = () => {
      const tx = open.result.transaction("accounts", "readwrite");
      tx.objectStore("accounts").put(
        { prompts, uploads: [] },
        JSON.stringify(["local", null]),
      );
      tx.oncomplete = () => open.result.close();
    };
  }, HISTORY_SIZE);
}

test("recent prompts fill the composer and typing over them keeps every key", async ({
  page,
  baseURL,
}) => {
  await seedHistory(page);
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(`${baseURL}/new-session`);
  const recent = page.getByRole("region", { name: "Recent prompts" });
  const rows = recent.getByRole("button");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Recent prompt 1");

  const composer = page.locator("textarea.new-session-form-textarea");
  await rows.nth(1).click();
  await expect(composer).toHaveValue("Recent prompt 2");
  await expect(composer).toBeFocused();
  await expect(recent).toHaveCount(0);
  await composer.fill("");
  await expect(rows).toHaveCount(3);

  await composer.evaluate((node) => {
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
          actual: (node as HTMLTextAreaElement).value,
        }),
      );
    });
  });
  // The first key removes the list below the field; no key may be lost.
  const text = "Fix the relay reconnect draft loss";
  await composer.pressSequentially(text, { delay: 10 });
  await expect(composer).toHaveValue(text);
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
});

test("Restore defaults clears the counted advanced options", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(`${baseURL}/new-session`);
  const hints = page.locator('[data-new-session-hint-line="true"]');
  await expect(hints).toContainText("Start");
  await expect(hints).not.toContainText("Advanced:");

  await page
    .getByRole("button", { name: "Advanced options", exact: true })
    .click();
  const reset = page.getByRole("button", { name: "Restore defaults" });
  await expect(reset).toBeDisabled();
  await page
    .getByRole("button", { name: "Filter by Show thinking", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Filter by Show thinking" })
    .getByRole("button", { name: /^On/ })
    .click();
  await expect(hints).toContainText("Advanced: Show thinking: On");
  await expect(reset).toBeEnabled();

  await reset.click();
  await expect(hints).not.toContainText("Advanced:");
  await expect(reset).toBeDisabled();
});
