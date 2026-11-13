import { describe, expect, it } from "vitest";
import type { SessionCollectionRecord } from "../clientSummaryCollections";
import {
  buildSessionOverview,
  sessionUserTimestamp,
  recentSessionShortcuts,
  activeQueueSessionIds,
} from "../sessionOverview";

const OLD = "2026-01-01T00:00:00Z";
const NEW = "2026-10-26T00:00:00Z";
const row = (
  id: string,
  changes: Partial<SessionCollectionRecord> = {},
): SessionCollectionRecord => ({
  id,
  projectId: "project",
  createdAt: OLD,
  updatedAt: NEW,
  observedAt: 0,
  ...changes,
});

describe("session workbench", () => {
  it("keeps failed queue targets available without counting them as running", () => {
    expect([
      ...activeQueueSessionIds([
        {
          status: "queued",
          target: { type: "existing-session", sessionId: "queued" },
        },
        {
          status: "dispatching",
          target: { type: "existing-session", sessionId: "dispatching" },
        },
        {
          status: "failed",
          target: { type: "existing-session", sessionId: "failed" },
        },
      ]),
    ]).toEqual(["queued", "dispatching"]);
  });
  it("keeps old asks and queues above recent work, without a twenty-row cutoff", () => {
    const pending = Array.from({ length: 25 }, (_, index) =>
      row(`ask-${index}`, { pendingInputType: "tool-approval" }),
    );
    const result = buildSessionOverview({
      records: [
        ...pending,
        row("queued"),
        row("running", { activity: "in-turn" }),
        row("idle"),
      ],
      queuedIds: new Set(["queued", "ask-0"]),
    });
    expect(result.needsAttention).toHaveLength(25);
    expect(result.active.map((item) => item.id)).toEqual(["queued", "running"]);
    expect(result.recent.map((item) => item.id)).toEqual(["idle"]);
  });

  it("counts unread across ages and hidden automation, but excludes archives and other projects", () => {
    const result = buildSessionOverview({
      records: [
        row("old-unread", { hasUnread: true }),
        row("automation", { hasUnread: true, launchSource: "codex-exec" }),
        row("archived", { hasUnread: true, isArchived: true }),
        row("other", { hasUnread: true, projectId: "elsewhere" }),
      ],
      projectId: "project",
      hideAutomation: true,
    });
    expect(result.unreadCount).toBe(2);
    expect(result.recent.map((item) => item.id)).toEqual(["old-unread"]);
  });

  it("never hides an automated session asking for human attention", () => {
    const result = buildSessionOverview({
      records: [
        row("question", {
          pendingInputType: "user-question",
          launchSource: "codex-exec",
        }),
        row("waiting", {
          activity: "waiting-input",
          launchSource: "codex-exec",
        }),
      ],
      hideAutomation: true,
    });
    expect(result.needsAttention.map((item) => item.id)).toEqual([
      "question",
      "waiting",
    ]);
  });

  it("orders recent work by human turns and local submissions, ignoring agent output", () => {
    const records = [
      row("background", { updatedAt: NEW }),
      row("human", { lastHumanTurnAt: NEW }),
      row("local"),
    ];
    const interactions = new Map([["local", Date.parse(NEW) + 1]]);
    const result = buildSessionOverview({ records, interactions });
    expect(result.recent.map((item) => item.id)).toEqual([
      "local",
      "human",
      "background",
    ]);
    expect(
      sessionUserTimestamp(
        row("missing", { createdAt: undefined }),
        interactions,
      ),
    ).toBe(0);
  });

  it("bounds ordinary shortcuts while retaining the current old session", () => {
    const records = Array.from({ length: 12 }, (_, index) =>
      row(`session-${index}`),
    );
    const result = recentSessionShortcuts(records, "session-11");
    expect(result).toHaveLength(8);
    expect(result.at(-1)?.id).toBe("session-11");
    expect(new Set(result.map((item) => item.id)).size).toBe(8);
    expect(recentSessionShortcuts(records, "session-0")).toEqual(
      records.slice(0, 8),
    );
  });
});
