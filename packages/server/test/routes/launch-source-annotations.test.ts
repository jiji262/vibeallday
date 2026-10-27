import { describe, expect, it, vi } from "vitest";
import {
  launchSourcesBySession,
  projectLaunchSourceStats,
  readInitializedCatalogRows,
  withLaunchSources,
} from "../../src/routes/launch-source-annotations.js";
import type { SessionCatalogRow } from "../../src/sessions/catalog-types.js";

function row(
  sessionId: string,
  projectIdentityKey: string,
  updatedAt: string,
  launchSource?: SessionCatalogRow["launchSource"],
): SessionCatalogRow {
  return {
    catalogFamily: "claude",
    storeKey: "/store",
    sessionId,
    projectId: projectIdentityKey as SessionCatalogRow["projectId"],
    projectPath: `/p/${projectIdentityKey}`,
    projectIdentityKey,
    updatedAt,
    fidelity: "head",
    sourceVersion: "v",
    location: { kind: "file", path: `/store/${sessionId}.jsonl` },
    ...(launchSource ? { launchSource } : {}),
  };
}

const rows = [
  row("a", "one", "2026-10-01T00:00:00.000Z", "claude-desktop"),
  row("b", "one", "2026-10-03T00:00:00.000Z", "claude-desktop"),
  row("c", "one", "2026-10-02T00:00:00.000Z", "codex-exec"),
  row("d", "two", "2026-10-04T00:00:00.000Z", "codex-exec"),
  row("e", "two", "2026-10-05T00:00:00.000Z"),
];

describe("projectLaunchSourceStats", () => {
  it("counts each project's sessions and latest activity per source", () => {
    const stats = projectLaunchSourceStats(rows);
    expect(stats.get("one")).toEqual({
      sessionCountsBySource: { "claude-desktop": 2, "codex-exec": 1 },
      lastActivityBySource: {
        "claude-desktop": "2026-10-03T00:00:00.000Z",
        "codex-exec": "2026-10-02T00:00:00.000Z",
      },
    });
    // An unlabeled row (a provider not told apart) counts under no source.
    expect(stats.get("two")?.sessionCountsBySource).toEqual({
      "codex-exec": 1,
    });
  });
});

describe("withLaunchSources", () => {
  it("labels walked items from the catalog without mutating them", () => {
    const walked = [
      { id: "a" },
      { id: "e" },
      { id: "x", launchSource: "claude-cli" as const },
    ];
    const labeled = withLaunchSources(walked, launchSourcesBySession(rows));
    expect(labeled.map((item) => item.launchSource)).toEqual([
      "claude-desktop",
      undefined,
      "claude-cli",
    ]);
    expect(walked[0]).toEqual({ id: "a" });
    expect(labeled[1]).toBe(walked[1]);
  });
});

describe("readInitializedCatalogRows", () => {
  it("does not wait on a catalog that has never published", async () => {
    const read = vi.fn();
    expect(
      await readInitializedCatalogRows({ getVersion: () => undefined, read }),
    ).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });

  it("treats a failed read as no annotations", async () => {
    expect(
      await readInitializedCatalogRows({
        getVersion: () => "e:1",
        read: async () => {
          throw new Error("shard unreadable");
        },
      }),
    ).toBeUndefined();
  });
});
