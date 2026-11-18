import type { ProjectQueueItemSummary } from "@vibeallday/shared";
import type { GlobalSessionItem } from "../../api/client";
import type { SessionCollectionRecord } from "../../lib/clientSummaryCollections";
import { sessionCollectionRecordToGlobalSessionItem } from "../../lib/sessionCollectionRecords";

export type SidebarPendingProjectQueueItem = ProjectQueueItemSummary & {
  target: Extract<ProjectQueueItemSummary["target"], { type: "new-session" }>;
};

export type SidebarSessionItem = GlobalSessionItem & {
  activityInferredFromInboxTier?: boolean;
};

/**
 * Live sessions must remain visible even when another row shares their title.
 * Activity affects badges and duplicate protection, never sidebar chronology.
 */
export function isActiveSession(session: GlobalSessionItem): boolean {
  return session.activity === "in-turn" || session.activity === "waiting-input";
}

export function sessionCollectionRecordsToSidebarSessionItems(
  records: readonly SessionCollectionRecord[],
): SidebarSessionItem[] {
  const sessions: SidebarSessionItem[] = [];
  for (const record of records) {
    const session = sessionCollectionRecordToGlobalSessionItem(record);
    if (!session) continue;
    sessions.push({
      ...session,
      activityInferredFromInboxTier: record.activityInferredFromInboxTier,
    });
  }
  return sessions;
}

export function getSidebarRowActivity(
  session: SidebarSessionItem,
): GlobalSessionItem["activity"] {
  if (session.activityInferredFromInboxTier) {
    return undefined;
  }
  return session.activity;
}

function duplicateGroupingTitle(session: GlobalSessionItem): string {
  return (
    session.customTitle ??
    session.fullTitle ??
    session.title ??
    session.initialPrompt ??
    ""
  );
}

export function duplicateGroupingKey(
  session: GlobalSessionItem,
): string | null {
  const title = duplicateGroupingTitle(session).trim();
  if (!title) return null;
  const normalizedTitle = title.replace(/\s+/g, " ").toLowerCase();
  return `${session.provider || "unknown"}|${session.projectId}|${normalizedTitle}`;
}

function updatedAtMs(session: GlobalSessionItem): number {
  return new Date(session.updatedAt).getTime();
}

function duplicateRepresentativeRank(session: GlobalSessionItem): number {
  if (session.isArchived) return 0;
  if (session.isStarred) return 3;
  if (session.ownership?.owner === "external") return 2;
  return 1;
}

function compareDuplicateRepresentative(
  a: GlobalSessionItem,
  b: GlobalSessionItem,
): number {
  const rankDiff =
    duplicateRepresentativeRank(b) - duplicateRepresentativeRank(a);
  if (rankDiff !== 0) return rankDiff;
  const messageCountDiff = (b.messageCount || 0) - (a.messageCount || 0);
  if (messageCountDiff !== 0) return messageCountDiff;
  return updatedAtMs(b) - updatedAtMs(a);
}

/**
 * Client-side duplicate-title hiding is deliberately fail-open. It only
 * hides unrelated exact-title idle rows when a user-facing representative is
 * also visible in the same section.
 */
export function groupDuplicateSidebarSessions(
  sessions: SidebarSessionItem[],
  currentSessionId: string | undefined,
  projectQueuedSessionIds: ReadonlySet<string>,
): { visible: SidebarSessionItem[]; hidden: SidebarSessionItem[] } {
  const groups = new Map<string, SidebarSessionItem[]>();
  for (const session of sessions) {
    const key = duplicateGroupingKey(session);
    if (!key) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(session);
    else groups.set(key, [session]);
  }

  const visibleIds = new Set<string>();
  const hidden: GlobalSessionItem[] = [];
  for (const session of sessions) {
    const key = duplicateGroupingKey(session);
    const group = key ? groups.get(key) : undefined;
    if (!group || group.length === 1) {
      visibleIds.add(session.id);
    }
  }

  for (const arr of groups.values()) {
    if (arr.length <= 1) continue;

    const groupSessionIds = new Set(arr.map((session) => session.id));
    const sourceIdsInGroup = new Set(
      arr.flatMap((session) =>
        [session.parentSessionId, session.forkedFromSessionId].filter(
          (id): id is string =>
            typeof id === "string" && groupSessionIds.has(id),
        ),
      ),
    );
    const protectedRows = arr.filter(
      (session) =>
        session.id === currentSessionId ||
        isActiveSession(session) ||
        projectQueuedSessionIds.has(session.id) ||
        session.ownership?.owner === "self" ||
        Boolean(session.parentSessionId) ||
        Boolean(session.forkedFromSessionId) ||
        sourceIdsInGroup.has(session.id),
    );
    for (const session of protectedRows) {
      visibleIds.add(session.id);
    }

    const hidable = arr.filter((session) => !visibleIds.has(session.id));
    if (hidable.length <= 1) {
      for (const session of hidable) {
        visibleIds.add(session.id);
      }
      continue;
    }

    const sorted = [...hidable].sort(compareDuplicateRepresentative);
    const selected = sorted[0];
    if (!selected) continue;
    visibleIds.add(selected.id);
    hidden.push(...sorted.slice(1));
  }

  const visible = sessions.filter((session) => visibleIds.has(session.id));
  const hiddenIds = new Set(hidden.map((session) => session.id));
  return {
    visible,
    hidden: sessions.filter((session) => hiddenIds.has(session.id)),
  };
}

// Named with a `debugLog` prefix so the console-chatter scanner treats its
// console.debug site as dev-gated (topics/console-chatter.md); the call site
// still guards on import.meta.env.DEV so nothing runs in production.
export function debugLogRepeatedSidebarSessionIds(
  sessions: SidebarSessionItem[],
): void {
  const idCounts = new Map<string, number>();
  for (const session of sessions) {
    idCounts.set(session.id, (idCounts.get(session.id) ?? 0) + 1);
  }
  const repeatedIds = [...idCounts].filter(([, count]) => count > 1);
  if (repeatedIds.length > 0) {
    console.debug("[Sidebar] repeated session ids in recent list", repeatedIds);
  }
}

export function isSidebarPendingProjectQueueItem(
  item: ProjectQueueItemSummary,
): item is SidebarPendingProjectQueueItem {
  return (
    item.target.type === "new-session" &&
    (item.status === "queued" || item.status === "failed")
  );
}
