import type { ProjectQueueItemSummary } from "@vibeallday/shared";
import type { SessionCollectionRecord } from "./clientSummaryCollections";
import { isHiddenAutomation } from "./launchSource";

export const RECENT_SHORTCUT_LIMIT = 8;
export const OVERVIEW_RECENT_LIMIT = 20;

export function activeQueueSessionIds(
  items: readonly Pick<ProjectQueueItemSummary, "target" | "status">[],
): ReadonlySet<string> {
  return new Set(
    items.flatMap((item) =>
      item.target.type === "existing-session" && item.status !== "failed"
        ? [item.target.sessionId]
        : [],
    ),
  );
}

export function sessionUserTimestamp(
  record: SessionCollectionRecord,
  interactions: ReadonlyMap<string, number>,
): number {
  return Math.max(
    interactions.get(record.id) ?? 0,
    Date.parse(record.lastHumanTurnAt ?? "") || 0,
    Date.parse(record.createdAt ?? "") || 0,
  );
}

export interface OverviewOptions {
  records: readonly SessionCollectionRecord[];
  projectId?: string;
  queuedIds?: ReadonlySet<string>;
  interactions?: ReadonlyMap<string, number>;
  hideAutomation?: boolean;
}

/** State takes priority over chronology; unread is an independent property. */
export function buildSessionOverview({
  records,
  projectId,
  queuedIds = new Set(),
  interactions = new Map(),
  hideAutomation = false,
}: OverviewOptions) {
  const needsAttention: SessionCollectionRecord[] = [];
  const active: SessionCollectionRecord[] = [];
  const recent: SessionCollectionRecord[] = [];
  let unreadCount = 0;
  const ordered = [...records].sort(
    (a, b) =>
      sessionUserTimestamp(b, interactions) -
        sessionUserTimestamp(a, interactions) || a.id.localeCompare(b.id),
  );
  for (const record of ordered) {
    if (record.isArchived || (projectId && record.projectId !== projectId))
      continue;
    if (record.hasUnread) unreadCount += 1;
    if (
      record.pendingInputType ||
      record.nonHumanUserTurn ||
      record.activity === "waiting-input"
    ) {
      needsAttention.push(record);
    } else if (!isHiddenAutomation(record, hideAutomation)) {
      if (record.activity === "in-turn" || queuedIds.has(record.id))
        active.push(record);
      else recent.push(record);
    }
  }
  return { needsAttention, active, recent, unreadCount };
}

/** The current ordinary session stays reachable even when it is very old. */
export function recentSessionShortcuts<T extends { id: string }>(
  ordered: readonly T[],
  currentId?: string,
): readonly T[] {
  const recent = ordered.slice(0, RECENT_SHORTCUT_LIMIT);
  if (!currentId || recent.some((row) => row.id === currentId)) return recent;
  const current = ordered.find((row) => row.id === currentId);
  return current
    ? [...recent.slice(0, RECENT_SHORTCUT_LIMIT - 1), current]
    : recent;
}
