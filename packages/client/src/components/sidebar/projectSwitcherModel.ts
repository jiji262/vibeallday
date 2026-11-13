import type { Project } from "../../types";

/** Projects listed in the switcher menu. */
export const RECENT_PROJECT_LIMIT = 8;
const PATH_TAIL_SEGMENTS = 2;

/** Route path without the relay host prefix. */
export function stripBasePath(pathname: string, basePath: string): string {
  if (basePath && pathname.startsWith(basePath)) {
    return pathname.slice(basePath.length) || "/";
  }
  return pathname;
}

function isSessionListPath(path: string): boolean {
  return path === "/inbox" || path === "/sessions";
}

/**
 * Where picking a project goes: the current page when it can be scoped to a
 * project, otherwise that project's sessions. Navigational only; nothing is
 * remembered as a global filter.
 */
export function projectScopedPath(path: string, projectId: string): string {
  const id = encodeURIComponent(projectId);
  if (path === "/git-status") return `/git-status?projectId=${id}`;
  if (path === "/inbox") return `/inbox?project=${id}`;
  return `/sessions?project=${id}&source=projects`;
}

/** "All projects" clears a session list's project scope, else opens Projects. */
export function allProjectsPath(path: string, search: string): string {
  if (!isSessionListPath(path)) return "/projects";
  const params = new URLSearchParams(search);
  params.delete("project");
  params.delete("source");
  const rest = params.toString();
  return rest ? `${path}?${rest}` : path;
}

function activityMs(project: Pick<Project, "lastActivity">): number {
  const ms = project.lastActivity ? Date.parse(project.lastActivity) : 0;
  return Number.isFinite(ms) ? ms : 0;
}

/** Most recently active first, capped for a scannable menu. */
export function recentProjects<T extends Project>(
  projects: readonly T[],
  limit = RECENT_PROJECT_LIMIT,
): T[] {
  return [...projects]
    .sort((a, b) => activityMs(b) - activityMs(a))
    .slice(0, limit);
}

/** Last directories of a path, e.g. "codes/vibeallday". */
export function pathTail(path: string | undefined): string {
  if (!path) return "";
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.slice(-PATH_TAIL_SEGMENTS).join("/");
}

export function isProjectActive(
  project: Pick<Project, "activeOwnedCount" | "activeExternalCount">,
): boolean {
  return project.activeOwnedCount + project.activeExternalCount > 0;
}
