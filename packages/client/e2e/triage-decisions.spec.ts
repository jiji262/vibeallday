import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures.js";

test.use({ serviceWorkers: "block" });

const PROJECT_ID = Buffer.from("/tmp/triage-e2e/app").toString("base64url");
const NEEDS_YOU = 30;

function needsYouRecords() {
  const now = Date.now();
  return Array.from({ length: NEEDS_YOU }, (_, index) => ({
    id: `triage-${index}`,
    projectId: PROJECT_ID,
    projectName: "app",
    title: `Approval ${index + 1}`,
    provider: "claude",
    ownership: { owner: "self", processId: `proc-${index}` },
    activity: "waiting-input",
    pendingInputType: "tool-approval",
    messageCount: 4,
    createdAt: new Date(now - 3_600_000).toISOString(),
    lastHumanTurnAt: new Date(now - 600_000).toISOString(),
    updatedAt: new Date(now - (index + 1) * 60_000).toISOString(),
  }));
}

function bashRequest(sessionId: string) {
  return {
    id: `req-${sessionId}`,
    sessionId,
    type: "tool-approval",
    prompt: "Allow Bash?",
    toolName: "Bash",
    toolInput: { command: "pnpm test", description: "Run the tests" },
    timestamp: new Date().toISOString(),
  };
}

async function mockTriage(page: Page) {
  const records = needsYouRecords();
  const responses: unknown[] = [];
  await page.route(/\/api\/sessions(?:\?|$)/, (route) =>
    route.fulfill({
      json: { sessions: records, hasMore: false, total: records.length },
    }),
  );
  await page.route(/\/api\/inbox(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        needsAttention: [],
        active: [],
        recentActivity: [],
        unread8h: [],
        unread24h: [],
      },
    }),
  );
  await page.route(/\/api\/sessions\/[^/]+\/pending-input$/, (route) => {
    const parts = new URL(route.request().url()).pathname.split("/");
    const sessionId = decodeURIComponent(parts.at(-2) ?? "");
    return route.fulfill({ json: { request: bashRequest(sessionId) } });
  });
  await page.route(/\/api\/sessions\/[^/]+\/input$/, (route) => {
    responses.push(route.request().postDataJSON());
    return route.fulfill({
      json: { accepted: true, pendingInputRequest: null },
    });
  });
  return responses;
}

interface TypingSample {
  latency: number;
  expected: string;
  actual: string;
}

test("triage deny reason keeps every typed key, including shortcut letters", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1000, height: 600 });
  const responses = await mockTriage(page);
  await page.goto(`${baseURL}/triage`);
  const card = page.locator("section[aria-labelledby^='triage-card-']");
  await expect(card.getByText("pnpm test")).toBeVisible();
  const labelledBy = await card.getAttribute("aria-labelledby");
  const sessionId = labelledBy?.replace("triage-card-", "");
  await expect(
    card.getByRole("button", { name: /Deny with reason/ }),
  ).toBeEnabled();

  await page.keyboard.press("d");
  const reason = card.getByRole("textbox");
  await expect(reason).toBeFocused();
  await reason.evaluate((node) => {
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
  // A, D and S are triage shortcuts outside the field; here they are text.
  const text = "skip docs and add a test first";
  await reason.pressSequentially(text, { delay: 10 });
  await expect(reason).toHaveValue(text);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const samples = await page.evaluate(
    () =>
      (window as unknown as { typingSamples: TypingSample[] }).typingSamples,
  );
  expect(samples).toHaveLength(text.length);
  expect(samples.every((s) => s.actual.startsWith(s.expected))).toBe(true);
  expect(Math.max(...samples.map((s) => s.latency))).toBeLessThanOrEqual(100);
  expect(responses).toEqual([]);

  await reason.press("ControlOrMeta+Enter");
  await expect
    .poll(() => responses)
    .toEqual([
      {
        requestId: `req-${sessionId}`,
        response: "deny",
        feedback: text,
      },
    ]);
});
