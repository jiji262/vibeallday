import { describe, expect, it } from "vitest";
import type { Project } from "../types";
import {
  projectSourceScope,
  scopeProject,
  sortProjects,
} from "./projectListView";

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id: id as Project["id"],
    path: `/p/${id}`,
    name: id,
    sessionCount: 0,
    activeOwnedCount: 0,
    activeExternalCount: 0,
    lastActivity: null,
    provider: "claude",
    ...overrides,
  } as Project;
}

const mixed = project("mixed", {
  sessionCount: 6,
  lastActivity: "2026-10-05T00:00:00.000Z",
  sessionCountsBySource: { "claude-desktop": 2, "codex-exec": 3 },
  lastActivityBySource: {
    "claude-desktop": "2026-10-02T00:00:00.000Z",
    "codex-exec": "2026-10-05T00:00:00.000Z",
  },
});
const generated = project("_gen", {
  sessionCount: 4,
  lastActivity: "2026-10-06T00:00:00.000Z",
  sessionCountsBySource: { "codex-exec": 4 },
  lastActivityBySource: { "codex-exec": "2026-10-06T00:00:00.000Z" },
});

describe("projectSourceScope", () => {
  it("prefers an explicit pick, then the automation default", () => {
    expect([...(projectSourceScope(["codex-exec"], true) ?? [])]).toEqual([
      "codex-exec",
    ]);
    const scope = projectSourceScope([], true);
    expect(scope?.has("codex-exec")).toBe(false);
    expect(scope?.has("claude-scheduled")).toBe(false);
    expect(scope?.has("claude-desktop")).toBe(true);
    expect(projectSourceScope([], false)).toBeNull();
  });
});

describe("scopeProject", () => {
  const noAutomation = projectSourceScope([], true);

  it("recounts a project from its in-scope sources", () => {
    // The sixth, unlabeled session is scanner noise and counts nowhere.
    expect(scopeProject(mixed, noAutomation)).toMatchObject({
      sessionCount: 2,
      lastActivity: "2026-10-02T00:00:00.000Z",
    });
  });

  it("drops a project with nothing in scope", () => {
    expect(scopeProject(generated, noAutomation)).toBeNull();
    expect(
      scopeProject(generated, projectSourceScope(["codex-exec"], true)),
    ).toMatchObject({ sessionCount: 4 });
  });

  it("shows a project without per-source counts unchanged", () => {
    const fresh = project("fresh");
    expect(scopeProject(fresh, noAutomation)).toBe(fresh);
    expect(scopeProject(mixed, null)).toBe(mixed);
  });
});

describe("sortProjects", () => {
  const a = project("beta", {
    sessionCount: 1,
    lastActivity: "2026-10-01T00:00:00Z",
  });
  const b = project("Alpha", {
    sessionCount: 5,
    lastActivity: "2026-10-02T00:00:00Z",
  });
  const c = project("item10", {
    sessionCount: 5,
    lastActivity: "2026-09-01T00:00:00Z",
  });
  const d = project("item9", { sessionCount: 2, lastActivity: null });
  const none = () => 0;

  it("orders by recency with projects needing attention first", () => {
    const needs = (id: string) => (id === "item9" ? 1 : 0);
    expect(
      sortProjects([a, b, c, d], "recent", needs).map((p) => p.name),
    ).toEqual(["item9", "Alpha", "beta", "item10"]);
  });

  it("orders by name, case-insensitively and with numeric runs", () => {
    expect(sortProjects([a, b, c, d], "name", none).map((p) => p.name)).toEqual(
      ["Alpha", "beta", "item9", "item10"],
    );
  });

  it("orders by session count, ties by name", () => {
    expect(
      sortProjects([a, b, c, d], "sessions", none).map((p) => p.name),
    ).toEqual(["Alpha", "item10", "item9", "beta"]);
  });
});
