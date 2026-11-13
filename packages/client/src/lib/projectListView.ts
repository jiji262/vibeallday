import { LAUNCH_SOURCES, type LaunchSource } from "@vibeallday/shared";
import type { Project } from "../types";
import { isAutomationLaunchSource } from "./launchSource";

export const PROJECT_SORTS = ["recent", "name", "sessions"] as const;
export type ProjectSort = (typeof PROJECT_SORTS)[number];

export function isProjectSort(value: string): value is ProjectSort {
  return (PROJECT_SORTS as readonly string[]).includes(value);
}

/**
 * The sources a list counts: an explicit pick, else every source but
 * automation when that is hidden, else null for no scoping at all.
 */
export function projectSourceScope(
  selected: readonly LaunchSource[],
  hideAutomation: boolean,
): ReadonlySet<LaunchSource> | null {
  if (selected.length) return new Set(selected);
  if (!hideAutomation) return null;
  return new Set(
    LAUNCH_SOURCES.filter((source) => !isAutomationLaunchSource(source)),
  );
}

function latest(a: string | null, b: string | undefined): string | null {
  if (!b) return a;
  if (!a) return b;
  return Date.parse(b) > Date.parse(a) ? b : a;
}

/**
 * The project as the scope sees it, with its count and last activity taken
 * from the in-scope sources only; null when nothing in scope remains. A
 * project without per-source counts (an older server, a catalog still
 * warming, or no sessions yet) is shown as it is rather than guessed at.
 * Only labeled sessions count: the scanner's total also holds rollouts the
 * catalog skips (empty or duplicate files), so the gap is not a source.
 */
export function scopeProject(
  project: Project,
  scope: ReadonlySet<LaunchSource> | null,
): Project | null {
  const counts = project.sessionCountsBySource;
  if (!scope || !counts) return project;
  let sessionCount = 0;
  let lastActivity: string | null = null;
  for (const source of scope) {
    const count = counts[source] ?? 0;
    if (count === 0) continue;
    sessionCount += count;
    lastActivity = latest(lastActivity, project.lastActivityBySource?.[source]);
  }
  if (sessionCount === 0) return null;
  return { ...project, sessionCount, lastActivity };
}

function activityTime(project: Project): number {
  return project.lastActivity ? Date.parse(project.lastActivity) : 0;
}

const nameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * Recent keeps projects that need attention on top, as the page always did;
 * the other orders are the reader's explicit choice and apply as stated.
 */
export function sortProjects(
  projects: readonly Project[],
  sort: ProjectSort,
  needsAttention: (projectId: string) => number,
): Project[] {
  const byName = (a: Project, b: Project) =>
    nameCollator.compare(a.name, b.name);
  return [...projects].sort((a, b) => {
    if (sort === "name") return byName(a, b);
    if (sort === "sessions")
      return b.sessionCount - a.sessionCount || byName(a, b);
    const aNeeds = needsAttention(a.id) > 0;
    const bNeeds = needsAttention(b.id) > 0;
    if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
    return activityTime(b) - activityTime(a);
  });
}
