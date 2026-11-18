import {
  PROJECT_CODE_NAMES_CAPABILITY,
  PUBLIC_SHARE_MANAGEMENT_CAPABILITY,
  projectDisplayName,
  serverHasCapability,
} from "@vibeallday/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToastContext } from "../contexts/ToastContext";
import { useActingPrincipal } from "../hooks/useActingPrincipal";
import { useNewSessionDraft } from "../hooks/useDrafts";
import { useHideAutomationSessions } from "../hooks/useHideAutomationSessions";
import { useProcesses } from "../hooks/useProcesses";
import { useProjectCodeNamePreferences } from "../hooks/useProjectCodeNamePreferences";
import { useProjectQueues } from "../hooks/useProjectQueues";
import { useProjects } from "../hooks/useProjects";
import { usePublicShareStatus } from "../hooks/usePublicShareStatus";
import {
  getProjectIdFromLocation,
  resolvePreferredProjectId,
} from "../hooks/useRecentProject";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useServerSettings } from "../hooks/useServerSettings";
import { useSidebarDuplicateHiding } from "../hooks/useSidebarDuplicateHiding";
import { useSidebarSessionFeeds } from "../hooks/useSidebarSessionFeeds";
import {
  useHeldSidebarLists,
  useSidebarSessionOrder,
} from "../hooks/useSidebarSessionOrder";
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "../hooks/useSidebarWidth";
import { useVersion } from "../hooks/useVersion";
import { useI18n } from "../i18n";
import type { SessionCollectionRecord } from "../lib/clientSummaryCollections";
import { useClientSummarySourceKey } from "../lib/clientSummarySourceKey";
import {
  useCategorizedSessionRecords,
  useDraftSessionIds,
  useKnownProjectQueueItems,
  useProjectQueuedSessionIds,
  useProjectQueueSidebarCount,
  useSessionCollectionQueryRecords,
  useStarredSessionRecords,
} from "../lib/clientSummaryStore";
import { isHiddenAutomation } from "../lib/launchSource";
import { writeNewSessionProjectSnapshot } from "../lib/newSessionProjectSnapshot";
import { isNearScrollEnd } from "../lib/predictiveScroll";
import { serverSupportsProjectQueue } from "../lib/projectQueueVisibility";
import {
  RECENT_SHORTCUT_LIMIT,
  recentSessionShortcuts,
} from "../lib/sessionOverview";
import type { SessionNavigationIntent } from "./SessionListItem";
import sidebarStyles from "./Sidebar.module.css";
import { SidebarIcons, SidebarNavItem } from "./SidebarNavItem";
import { SidebarBrand } from "./sidebar/SidebarBrand";
import {
  SidebarFooter,
  SidebarSearchButton,
} from "./sidebar/SidebarChromeControls";
import { SidebarHostCard } from "./sidebar/SidebarHostFooter";
import { SidebarNavGroups } from "./sidebar/SidebarNavGroups";
import {
  CATEGORY_SECTION_PREFIX,
  CREATOR_SECTION_PREFIX,
  loadSidebarSectionExpansion,
  type SidebarSectionKey,
  saveSidebarSectionExpansion,
} from "./sidebar/SidebarSectionHeader";
import { SidebarSessionSections } from "./sidebar/SidebarSessionSections";
import {
  debugLogRepeatedSidebarSessionIds,
  duplicateGroupingKey,
  groupDuplicateSidebarSessions,
  isSidebarPendingProjectQueueItem,
  type SidebarPendingProjectQueueItem,
  type SidebarSessionItem,
  sessionCollectionRecordsToSidebarSessionItems,
} from "./sidebar/sidebarSessionModel";
import { useSidebarInteractions } from "./sidebar/useSidebarInteractions";

export { SidebarToggleIcon } from "./SidebarLauncher";

const EMPTY_PROJECT_QUEUE_PROJECT_IDS: readonly string[] = [];
const EMPTY_PROJECT_QUEUE_PROJECTS: readonly {
  id: string;
  projectQueueCount?: number;
  snapshotObservedAt?: number;
}[] = [];
const EMPTY_PROJECT_QUEUE_SESSION_IDS: ReadonlySet<string> = new Set();
const EMPTY_RECORDS: readonly SessionCollectionRecord[] = [];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: () => void;
  onSessionNavigate?: (intent: SessionNavigationIntent) => void;
  currentSessionId?: string;
  isDesktop?: boolean;
  isCollapsed?: boolean;
  onToggleExpanded?: () => void;
  onMinimize?: () => void;
  sidebarWidth?: number;
  onResizeStart?: () => void;
  onResize?: (width: number) => void;
  onResizeEnd?: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  onNavigate,
  onSessionNavigate,
  currentSessionId,
  isDesktop = false,
  isCollapsed = false,
  onToggleExpanded,
  onMinimize,
  sidebarWidth,
  onResizeStart,
  onResize,
  onResizeEnd,
}: SidebarProps) {
  const { t } = useI18n();
  const { showToast } = useToastContext();
  const basePath = useRemoteBasePath();
  const { sidebarDuplicateHidingEnabled } = useSidebarDuplicateHiding();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings: serverSettings } = useServerSettings();
  const { principal: actingPrincipal, resolved: principalResolved } =
    useActingPrincipal();
  const sourceKey = useClientSummarySourceKey();
  const isLimitedUser = actingPrincipal.username !== null;
  const publicSharesEnabled = serverSettings?.publicSharesEnabled ?? false;
  const { status: publicShareStatus } = usePublicShareStatus({
    poll: publicSharesEnabled,
  });
  const publicShareCreationReady = publicShareStatus?.canCreate ?? false;
  const { processes, terminatedProcesses } = useProcesses();
  const providerChildrenBySessionId = useMemo(
    () =>
      new Map(
        [...processes, ...terminatedProcesses]
          .filter((process) => process.providerChildren?.length)
          .map((process) => [process.sessionId, process.providerChildren]),
      ),
    [processes, terminatedProcesses],
  );

  const {
    globalQuery,
    loading: sessionsLoading,
    hasMoreGlobalSessions,
    loadMoreGlobalSessions,
    hasMoreStarredSessions,
    loadMoreStarredSessions,
    sidebarCategoriesSupported,
    hasMoreCategorizedSessions,
    loadMoreCategorizedSessions,
  } = useSidebarSessionFeeds();

  const allGlobalQueryRecords = useSessionCollectionQueryRecords(globalQuery);
  const { hideAutomationSessions } = useHideAutomationSessions();
  const globalQueryRecords = useMemo(
    () =>
      hideAutomationSessions
        ? allGlobalQueryRecords.filter(
            (record) => !isHiddenAutomation(record, hideAutomationSessions),
          )
        : allGlobalQueryRecords,
    [allGlobalQueryRecords, hideAutomationSessions],
  );
  const starredSessionRecords = useStarredSessionRecords();
  const categorizedSessionRecords = useCategorizedSessionRecords();
  const orderedSessions = useSidebarSessionOrder(
    globalQueryRecords,
    starredSessionRecords,
    sidebarCategoriesSupported ? categorizedSessionRecords : EMPTY_RECORDS,
    sidebarCategoriesSupported && !isLimitedUser,
  );

  const hasNewSessionDraft = useNewSessionDraft();
  const { version: versionInfo } = useVersion();
  const supportsProjectQueue = serverSupportsProjectQueue(versionInfo);
  const supportsProjectCodeNames = serverHasCapability(
    versionInfo,
    PROJECT_CODE_NAMES_CAPABILITY,
  );
  const { projectCodeNamesEnabled } = useProjectCodeNamePreferences();
  const publicShareManagementAvailable = serverHasCapability(
    versionInfo,
    PUBLIC_SHARE_MANAGEMENT_CAPABILITY,
  );
  const {
    projects,
    complete: projectsComplete,
    error: projectsError,
  } = useProjects();
  const sourceControlProjectId = useMemo(
    () =>
      getProjectIdFromLocation(location.pathname, location.search) ??
      resolvePreferredProjectId(projects, undefined, projectsComplete),
    [location.pathname, location.search, projects, projectsComplete],
  );
  useEffect(() => {
    if (!principalResolved || !projectsComplete || projectsError) return;
    writeNewSessionProjectSnapshot(
      sourceKey,
      actingPrincipal,
      projects,
      undefined,
      sourceControlProjectId,
    );
  }, [
    sourceKey,
    actingPrincipal,
    principalResolved,
    projects,
    projectsComplete,
    projectsError,
    sourceControlProjectId,
  ]);
  const sourceControlPath = sourceControlProjectId
    ? `/git-status?projectId=${encodeURIComponent(sourceControlProjectId)}`
    : "/git-status";
  const projectQueueSidebarCount = useProjectQueueSidebarCount(
    supportsProjectQueue ? projects : EMPTY_PROJECT_QUEUE_PROJECTS,
  );

  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarSessionsRef = useRef<HTMLDivElement | null>(null);
  const {
    swipeOffset,
    isResizing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleResizeMouseDown,
  } = useSidebarInteractions({
    isDesktop,
    isCollapsed,
    sidebarWidth,
    onClose,
    onResizeStart,
    onResize,
    onResizeEnd,
  });

  const [sectionExpansion, setSectionExpansion] = useState(
    loadSidebarSectionExpansion,
  );
  const loadingMoreGlobalSessionsRef = useRef(false);
  const loadingMoreStarredSessionsRef = useRef(false);
  const loadingMoreCategorizedSessionsRef = useRef(false);

  const setSidebarSectionExpanded = useCallback(
    (
      section: SidebarSectionKey,
      update: boolean | ((current: boolean) => boolean),
    ) => {
      setSectionExpansion((current) => {
        const nextValue =
          typeof update === "function" ? update(current[section]) : update;
        const next = { ...current, [section]: nextValue };
        saveSidebarSectionExpansion(next);
        return next;
      });
    },
    [],
  );

  const toggleSidebarGroupExpanded = useCallback((groupKey: string) => {
    setSectionExpansion((current) => {
      const collapsed = new Set(current.collapsedGroups);
      if (!collapsed.delete(groupKey)) collapsed.add(groupKey);
      const next = { ...current, collapsedGroups: [...collapsed] };
      saveSidebarSectionExpansion(next);
      return next;
    });
  }, []);

  const maybeLoadMoreGlobalSessions = useCallback(async () => {
    if (
      !hasMoreGlobalSessions ||
      loadingMoreGlobalSessionsRef.current ||
      orderedSessions.recent.length + orderedSessions.older.length >=
        RECENT_SHORTCUT_LIMIT
    ) {
      return;
    }
    loadingMoreGlobalSessionsRef.current = true;
    try {
      await loadMoreGlobalSessions();
    } finally {
      loadingMoreGlobalSessionsRef.current = false;
    }
  }, [
    hasMoreGlobalSessions,
    loadMoreGlobalSessions,
    orderedSessions.recent.length,
    orderedSessions.older.length,
  ]);

  const maybeLoadMoreStarredSessions = useCallback(async () => {
    if (!hasMoreStarredSessions || loadingMoreStarredSessionsRef.current) {
      return;
    }
    loadingMoreStarredSessionsRef.current = true;
    try {
      await loadMoreStarredSessions();
    } finally {
      loadingMoreStarredSessionsRef.current = false;
    }
  }, [hasMoreStarredSessions, loadMoreStarredSessions]);

  const maybeLoadMoreCategorizedSessions = useCallback(async () => {
    if (
      !hasMoreCategorizedSessions ||
      loadingMoreCategorizedSessionsRef.current
    ) {
      return;
    }
    loadingMoreCategorizedSessionsRef.current = true;
    try {
      await loadMoreCategorizedSessions();
    } finally {
      loadingMoreCategorizedSessionsRef.current = false;
    }
  }, [hasMoreCategorizedSessions, loadMoreCategorizedSessions]);

  const maybeLoadMoreSidebarSessions = useCallback(() => {
    const element = sidebarSessionsRef.current;
    if (!element || !isNearScrollEnd(element)) {
      return;
    }
    void maybeLoadMoreGlobalSessions();
    void maybeLoadMoreStarredSessions();
    void maybeLoadMoreCategorizedSessions();
  }, [
    maybeLoadMoreGlobalSessions,
    maybeLoadMoreStarredSessions,
    maybeLoadMoreCategorizedSessions,
  ]);

  const sidebarLoadMoreKey = [
    starredSessionRecords.length,
    categorizedSessionRecords.length,
    sectionExpansion.collapsedGroups?.length ?? 0,
    orderedSessions.recent.length,
    orderedSessions.older.length,
    sectionExpansion.projectQueue,
    sectionExpansion.starred,
    sectionExpansion.recentDay,
  ].join("\0");

  useEffect(() => {
    void sidebarLoadMoreKey;
    maybeLoadMoreSidebarSessions();
  }, [maybeLoadMoreSidebarSessions, sidebarLoadMoreKey]);

  const filteredStarredSessions = useMemo(
    () =>
      sessionCollectionRecordsToSidebarSessionItems(orderedSessions.starred),
    [orderedSessions.starred],
  );
  const recentDaySessions = useMemo(
    () => sessionCollectionRecordsToSidebarSessionItems(orderedSessions.recent),
    [orderedSessions.recent],
  );
  const olderSessions = useMemo(
    () => sessionCollectionRecordsToSidebarSessionItems(orderedSessions.older),
    [orderedSessions.older],
  );

  const groupSessionLists = useMemo(() => {
    const lists: Record<string, SidebarSessionItem[]> = {};
    for (const { name, rows } of orderedSessions.categories) {
      lists[CATEGORY_SECTION_PREFIX + name] =
        sessionCollectionRecordsToSidebarSessionItems(rows);
    }
    for (const { name, rows } of orderedSessions.creators) {
      lists[CREATOR_SECTION_PREFIX + name] =
        sessionCollectionRecordsToSidebarSessionItems(rows);
    }
    return lists;
  }, [orderedSessions.categories, orderedSessions.creators]);

  const sidebarCategoryNames = useMemo(
    () => orderedSessions.categories.map(({ name }) => name),
    [orderedSessions.categories],
  );

  const sidebarProjectIds = useMemo(
    () => [
      ...new Set(
        [
          ...filteredStarredSessions,
          ...recentDaySessions,
          ...olderSessions,
          ...Object.values(groupSessionLists).flat(),
        ]
          .map((session) => session.projectId)
          .filter(Boolean),
      ),
    ],
    [
      filteredStarredSessions,
      recentDaySessions,
      olderSessions,
      groupSessionLists,
    ],
  );
  const projectQueueProjectIds = useMemo(
    () =>
      projects
        .filter((project) => (project.projectQueueCount ?? 0) > 0)
        .map((project) => project.id),
    [projects],
  );
  const sidebarQueueProjectIds = useMemo(
    () => [...new Set([...sidebarProjectIds, ...projectQueueProjectIds])],
    [projectQueueProjectIds, sidebarProjectIds],
  );
  const projectQueues = useProjectQueues(
    supportsProjectQueue
      ? sidebarQueueProjectIds
      : EMPTY_PROJECT_QUEUE_PROJECT_IDS,
  );
  const rawProjectQueuedSessionIds = useProjectQueuedSessionIds(
    supportsProjectQueue ? sidebarProjectIds : EMPTY_PROJECT_QUEUE_PROJECT_IDS,
  );
  const projectQueuedSessionIds = supportsProjectQueue
    ? rawProjectQueuedSessionIds
    : EMPTY_PROJECT_QUEUE_SESSION_IDS;
  const knownProjectQueueItems = useKnownProjectQueueItems();
  const projectNameById = useMemo(
    () =>
      new Map(
        projects.map((project) => [
          project.id,
          supportsProjectCodeNames &&
          projectCodeNamesEnabled &&
          project.codeName
            ? project.codeName
            : projectDisplayName(project),
        ]),
      ),
    [projectCodeNamesEnabled, projects, supportsProjectCodeNames],
  );
  const pendingProjectQueueItems = useMemo(
    () =>
      supportsProjectQueue
        ? knownProjectQueueItems.filter(isSidebarPendingProjectQueueItem)
        : [],
    [knownProjectQueueItems, supportsProjectQueue],
  );

  const handlePendingProjectQueueClick = useCallback(
    async (
      event: React.MouseEvent<HTMLAnchorElement>,
      item: SidebarPendingProjectQueueItem,
    ) => {
      const targetPath = `${basePath}/projects?queueItem=${encodeURIComponent(
        item.id,
      )}`;
      const isPlainLeftClick =
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey;
      if (!isPlainLeftClick || item.status !== "queued") {
        onNavigate();
        return;
      }

      event.preventDefault();
      try {
        const result = await projectQueues.promoteNow(item.projectId, item.id);
        if (result.promoted && result.sessionId) {
          navigate(
            `${basePath}/projects/${encodeURIComponent(
              item.projectId,
            )}/sessions/${encodeURIComponent(result.sessionId)}`,
          );
        } else {
          navigate(targetPath);
        }
      } catch {
        navigate(targetPath);
      }
      onNavigate();
    },
    [basePath, navigate, onNavigate, projectQueues.promoteNow],
  );

  const [resumingPendingQueueItemIds, setResumingPendingQueueItemIds] =
    useState<Set<string>>(() => new Set());
  const handleResumePendingQueueItem = useCallback(
    async (item: SidebarPendingProjectQueueItem) => {
      if (resumingPendingQueueItemIds.has(item.id)) return;
      setResumingPendingQueueItemIds((current) =>
        new Set(current).add(item.id),
      );
      try {
        await projectQueues.moveItemToTop(item.projectId, item.id);
      } catch (error) {
        showToast(
          t("sidebarPendingSessionResumeFailed", {
            message: error instanceof Error ? error.message : String(error),
          }),
          "error",
        );
      } finally {
        setResumingPendingQueueItemIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      }
    },
    [projectQueues.moveItemToTop, resumingPendingQueueItemIds, showToast, t],
  );

  const { visibleRecent, hiddenRecent } = useMemo(() => {
    const combined = [...recentDaySessions, ...olderSessions];
    if (!sidebarDuplicateHidingEnabled) {
      return { visibleRecent: combined, hiddenRecent: [] };
    }
    const { visible, hidden } = groupDuplicateSidebarSessions(
      combined,
      currentSessionId,
      projectQueuedSessionIds,
    );
    return { visibleRecent: visible, hiddenRecent: hidden };
  }, [
    currentSessionId,
    olderSessions,
    projectQueuedSessionIds,
    recentDaySessions,
    sidebarDuplicateHidingEnabled,
  ]);

  const { lists: heldLists, handlers: orderInteractionHandlers } =
    useHeldSidebarLists(
      {
        ...groupSessionLists,
        starred: filteredStarredSessions,
        recent: visibleRecent,
        hiddenRecent,
      },
      isDesktop ? !isCollapsed : isOpen,
    );

  const shortcutRows = recentSessionShortcuts(
    heldLists.recent,
    currentSessionId,
  );
  const representativeKeys = new Set(shortcutRows.map(duplicateGroupingKey));
  const displayed = {
    ...heldLists,
    recent: shortcutRows,
    hiddenRecent: heldLists.hiddenRecent.filter((row) =>
      representativeKeys.has(duplicateGroupingKey(row)),
    ),
  };

  useEffect(() => {
    if (import.meta.env.DEV) {
      debugLogRepeatedSidebarSessionIds(recentDaySessions);
    }
  }, [recentDaySessions]);

  const drafts = useDraftSessionIds();

  if (!isDesktop && !isOpen) return null;

  return (
    <>
      {!isDesktop && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          role="button"
          tabIndex={0}
          aria-label={t("actionCloseSidebar")}
        />
      )}
      <aside
        ref={sidebarRef}
        {...orderInteractionHandlers}
        className={`sidebar ${sidebarStyles.console}`}
        onTouchStart={!isDesktop ? handleTouchStart : undefined}
        onTouchMove={!isDesktop ? handleTouchMove : undefined}
        onTouchEnd={!isDesktop ? handleTouchEnd : undefined}
        style={
          !isDesktop && swipeOffset < 0
            ? { transform: `translateX(${swipeOffset}px)`, transition: "none" }
            : undefined
        }
      >
        <SidebarBrand
          basePath={basePath}
          isDesktop={isDesktop}
          isCollapsed={isCollapsed}
          onToggleExpanded={onToggleExpanded}
          onMinimize={onMinimize}
          onClose={onClose}
          onNavigate={onNavigate}
        />

        <SidebarHostCard basePath={basePath} onNavigate={onNavigate} />

        <div className={`sidebar-actions ${sidebarStyles.actions}`}>
          <SidebarNavItem
            to="/new-session"
            icon={SidebarIcons.newSession}
            label={t("sidebarNewSession")}
            onClick={onNavigate}
            basePath={basePath}
            hasDraft={hasNewSessionDraft && !isCollapsed}
            draftLabel={t("shellNavDraft")}
            className={sidebarStyles.newSession}
          />
          <SidebarSearchButton onNavigate={onNavigate} />
        </div>

        <div
          ref={sidebarSessionsRef}
          className={`sidebar-sessions ${sidebarStyles.sessions}`}
          onScroll={maybeLoadMoreSidebarSessions}
        >
          <SidebarNavGroups
            basePath={basePath}
            onNavigate={onNavigate}
            sourceControlPath={sourceControlPath}
            projectQueueCount={
              supportsProjectQueue ? projectQueueSidebarCount : 0
            }
          />

          <SidebarSessionSections
            basePath={basePath}
            currentSessionId={currentSessionId}
            supportsProjectQueue={supportsProjectQueue}
            pendingProjectQueueItems={pendingProjectQueueItems}
            projectQueueDispatchPaused={
              projectQueues.dispatchState.status === "paused"
            }
            resumingPendingQueueItemIds={resumingPendingQueueItemIds}
            onPendingProjectQueueClick={(event, item) =>
              void handlePendingProjectQueueClick(event, item)
            }
            onResumePendingQueueItem={(item) =>
              void handleResumePendingQueueItem(item)
            }
            sectionExpansion={sectionExpansion}
            onSetSectionExpanded={setSidebarSectionExpanded}
            onToggleGroupExpanded={toggleSidebarGroupExpanded}
            displayedByKey={displayed}
            starredSessions={displayed.starred}
            recentSessions={displayed.recent}
            hiddenRecentSessions={displayed.hiddenRecent}
            visibleRecentCount={visibleRecent.length}
            hasMoreGlobalSessions={hasMoreGlobalSessions}
            hasMoreStarredSessions={hasMoreStarredSessions}
            hasMoreCategorizedSessions={hasMoreCategorizedSessions}
            sessionsLoading={sessionsLoading}
            sidebarCategoriesSupported={sidebarCategoriesSupported}
            sidebarCategoryNames={sidebarCategoryNames}
            projectNameById={projectNameById}
            projectQueuedSessionIds={projectQueuedSessionIds}
            draftSessionIds={drafts}
            providerChildrenBySessionId={providerChildrenBySessionId}
            publicShareCreationReady={publicShareCreationReady}
            publicShareManagementAvailable={publicShareManagementAvailable}
            onNavigate={onNavigate}
            onSessionNavigate={onSessionNavigate}
          />
        </div>

        <SidebarFooter basePath={basePath} onNavigate={onNavigate} />

        {isDesktop && !isCollapsed && (
          <div
            className={`sidebar-resize-handle ${isResizing ? "active" : ""}`}
            onMouseDown={handleResizeMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("actionResizeSidebar")}
            aria-valuemin={SIDEBAR_MIN_WIDTH}
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            aria-valuenow={sidebarWidth ?? SIDEBAR_MIN_WIDTH}
            tabIndex={0}
          />
        )}
      </aside>
    </>
  );
}
