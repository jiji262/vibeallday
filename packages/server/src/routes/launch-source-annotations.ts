import type { LaunchSource } from "@vibeallday/shared";
import type { RetainedSessionCollections } from "../services/RetainedSessionCollections.js";
import type { SessionCatalogRow } from "../sessions/catalog-types.js";

type CatalogRows = ReadonlyArray<Readonly<SessionCatalogRow>>;

/**
 * The catalog's rows, or undefined until it has published once. Callers only
 * annotate with launch sources, so a cold catalog must not hold their
 * response hostage to its first full scan.
 */
export async function readInitializedCatalogRows(
  collections:
    | Pick<RetainedSessionCollections, "getVersion" | "read">
    | undefined,
): Promise<CatalogRows | undefined> {
  if (!collections?.getVersion()) return undefined;
  try {
    return (await collections.read()).rows;
  } catch {
    return undefined;
  }
}

/** Session ids are provider UUIDs, so the id alone names the row. */
export function launchSourcesBySession(
  rows: CatalogRows,
): Map<string, LaunchSource> {
  const sources = new Map<string, LaunchSource>();
  for (const row of rows) {
    if (row.launchSource) sources.set(row.sessionId, row.launchSource);
  }
  return sources;
}

/** Copies, never mutates: walked items may be shared by a retained walk. */
export function withLaunchSources<
  T extends { id: string; launchSource?: LaunchSource },
>(sessions: readonly T[], sources: ReadonlyMap<string, LaunchSource>): T[] {
  return sessions.map((session) => {
    const launchSource = session.launchSource ?? sources.get(session.id);
    return launchSource && launchSource !== session.launchSource
      ? { ...session, launchSource }
      : session;
  });
}

export interface ProjectLaunchSourceStats {
  sessionCountsBySource: Partial<Record<LaunchSource, number>>;
  lastActivityBySource: Partial<Record<LaunchSource, string>>;
}

/** Keyed by `projectIdentityKey`, the catalog's project membership key. */
export function projectLaunchSourceStats(
  rows: CatalogRows,
): Map<string, ProjectLaunchSourceStats> {
  const stats = new Map<string, ProjectLaunchSourceStats>();
  for (const row of rows) {
    const source = row.launchSource;
    if (!source) continue;
    let project = stats.get(row.projectIdentityKey);
    if (!project) {
      project = { sessionCountsBySource: {}, lastActivityBySource: {} };
      stats.set(row.projectIdentityKey, project);
    }
    project.sessionCountsBySource[source] =
      (project.sessionCountsBySource[source] ?? 0) + 1;
    const latest = project.lastActivityBySource[source];
    if (!latest || Date.parse(row.updatedAt) > Date.parse(latest)) {
      project.lastActivityBySource[source] = row.updatedAt;
    }
  }
  return stats;
}
