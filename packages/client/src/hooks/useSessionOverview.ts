import { useMemo, useSyncExternalStore } from "react";
import type { InboxItem } from "../api/client";
import type { SessionCollectionRecord } from "../lib/clientSummaryCollections";
import {
  useClientSummarySourceKey,
  useKnownProjectQueueItems,
  useSessionCollectionQueryRecords,
  useSessionCollectionQueryState,
} from "../lib/clientSummaryStore";
import { getSessionInteractionStore } from "../lib/sessionInteractionOrder";
import {
  activeQueueSessionIds,
  buildSessionOverview,
  OVERVIEW_RECENT_LIMIT,
} from "../lib/sessionOverview";
import { useGlobalSessionsFeed } from "./useGlobalSessionsFeed";
import { useHideAutomationSessions } from "./useHideAutomationSessions";
import { useHeldSidebarLists } from "./useSidebarSessionOrder";
import { useCompleteSessionCatalog } from "./useCompleteSessionCatalog";

function inboxItem(record: SessionCollectionRecord): InboxItem {
  return {
    ...record,
    sessionId: record.id,
    projectId: record.projectId ?? "",
    projectName: record.projectName ?? "",
    sessionTitle: record.title,
    updatedAt: record.updatedAt ?? record.createdAt ?? "",
  };
}

function useOverviewCatalog() {
  const feed = useGlobalSessionsFeed({
    includeArchived: false,
    includeStats: false,
    limit: 500,
  });
  const records = useSessionCollectionQueryRecords(feed.query);
  const state = useSessionCollectionQueryState(feed.query);
  useCompleteSessionCatalog(feed, records.length);
  const partial =
    !feed.ready ||
    feed.loading ||
    feed.hasMore ||
    !state ||
    state.catalog?.complete === false;
  return { feed, records, partial };
}

function useOverviewModel(
  records: readonly SessionCollectionRecord[],
  projectId?: string,
) {
  const sourceKey = useClientSummarySourceKey();
  const store = getSessionInteractionStore(sourceKey);
  const raw = useSyncExternalStore(store.subscribe, store.read, store.read);
  const { hideAutomationSessions } = useHideAutomationSessions();
  const queueItems = useKnownProjectQueueItems();
  return useMemo(
    () =>
      buildSessionOverview({
        records,
        projectId,
        queuedIds: activeQueueSessionIds(queueItems),
        interactions: new Map(JSON.parse(raw)),
        hideAutomation: hideAutomationSessions,
      }),
    [records, projectId, queueItems, raw, hideAutomationSessions],
  );
}

export function useSessionOverview(projectId?: string) {
  const { feed, records, partial } = useOverviewCatalog();
  const data = useOverviewModel(records, projectId);
  // Hold the complete identity set before trimming visible rows. Otherwise
  // a row pushed below the limit would disappear under the reader's pointer.
  const { lists, handlers } = useHeldSidebarLists(
    {
      needsAttention: data.needsAttention,
      active: data.active,
      recent: data.recent,
    },
    true,
    projectId,
  );
  return {
    needsAttention: lists.needsAttention.map(inboxItem),
    active: lists.active.map(inboxItem),
    recentActivity: lists.recent.slice(0, OVERVIEW_RECENT_LIMIT).map(inboxItem),
    counts: {
      needsYou: data.needsAttention.length,
      running: data.active.length,
      unread: data.unreadCount,
    },
    partial,
    loading: feed.loading && records.length === 0,
    error: feed.error,
    refresh: feed.refetch,
    handlers,
  };
}

export type SessionOverviewData = ReturnType<typeof useSessionOverview>;
