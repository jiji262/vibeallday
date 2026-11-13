import {
  projectDisplayName,
  PROJECT_CODE_NAMES_CAPABILITY,
  PUBLIC_SHARE_MANAGEMENT_CAPABILITY,
  type ProjectQueueItemSummary,
  serverHasCapability,
} from "@vibeallday/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { GlobalSessionItem } from "../api/client";
import { useNewSessionDraft } from "../hooks/useDrafts";
import { useProjectCodeNamePreferences } from "../hooks/useProjectCodeNamePreferences";
import { useProjectQueues } from "../hooks/useProjectQueues";
import { useProjects } from "../hooks/useProjects";
import { useProcesses } from "../hooks/useProcesses";
import {
  getProjectIdFromLocation,
  resolvePreferredProjectId,
} from "../hooks/useRecentProject";
import { usePublicShareStatus } from "../hooks/usePublicShareStatus";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useServerSettings } from "../hooks/useServerSettings";
import { useSidebarDuplicateHiding } from "../hooks/useSidebarDuplicateHiding";
import { useSidebarSessionFeeds } from "../hooks/useSidebarSessionFeeds";
import {
  useHeldSidebarLists,
  useSidebarSessionOrder,
} from "../hooks/useSidebarSessionOrder";
import { useHideAutomationSessions } from "../hooks/useHideAutomationSessions";
import { isHiddenAutomation } from "../lib/launchSource";
import {
  RECENT_SHORTCUT_LIMIT,
  recentSessionShortcuts,
} from "../lib/sessionOverview";
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "../hooks/useSidebarWidth";
import { useVersion } from "../hooks/useVersion";
import { useI18n } from "../i18n";
import { useToastContext } from "../contexts/ToastContext";
import { isNearScrollEnd } from "../lib/predictiveScroll";
import { serverSupportsProjectQueue } from "../lib/projectQueueVisibility";
import { sessionCollectionRecordToGlobalSessionItem } from "../lib/sessionCollectionRecords";
import type { SessionCollectionRecord } from "../lib/clientSummaryCollections";
import {
  useDraftSessionIds,
  useKnownProjectQueueItems,
  useProjectQueuedSessionIds,
  useProjectQueueSidebarCount,
  useCategorizedSessionRecords,
  useSessionCollectionQueryRecords,
  useStarredSessionRecords,
} from "../lib/clientSummaryStore";
import { UI_KEYS } from "../lib/storageKeys";
import { getSessionDisplayTitle } from "../utils";
import { useActingPrincipal } from "../hooks/useActingPrincipal";
import { useClientSummarySourceKey } from "../lib/clientSummarySourceKey";
import { writeNewSessionProjectSnapshot } from "../lib/newSessionProjectSnapshot";
import { CompactResumeButton } from "./CompactResumeButton";
import { SessionListItem } from "./SessionListItem";
import type { SessionNavigationIntent } from "./SessionListItem";
import sidebarStyles from "./Sidebar.module.css";
import sectionHeadingStyles from "./SidebarSectionHeading.module.css";
import { SidebarIcons, SidebarNavItem } from "./SidebarNavItem";
import { SidebarBrand } from "./sidebar/SidebarBrand";
import {
  SidebarFooter,
  SidebarSearchButton,
} from "./sidebar/SidebarChromeControls";
import { SidebarHostCard } from "./sidebar/SidebarHostFooter";
import { SidebarNavGroups } from "./sidebar/SidebarNavGroups";

export { SidebarToggleIcon } from "./SidebarLauncher";

const SWIPE_THRESHOLD = 50; // Minimum distance to trigger close
const SWIPE_ENGAGE_THRESHOLD = 15; // Minimum horizontal distance before swipe engages

const DEFAULT_SECTION_EXPANSION = {
  projectQueue: true,
  starred: true,
  recentDay: true,
  older: true,
};

type SidebarPendingProjectQueueItem = ProjectQueueItemSummary & {
  target: Extract<ProjectQueueItemSummary["target"], { type: "new-session" }>;
};

type SidebarSessionItem = GlobalSessionItem & {
  activityInferredFromInboxTier?: boolean;
};

const EMPTY_PROJECT_QUEUE_PROJECT_IDS: readonly string[] = [];
const EMPTY_PROJECT_QUEUE_PROJECTS: readonly {
  id: string;
  projectQueueCount?: number;
  snapshotObservedAt?: number;
}[] = [];
const EMPTY_PROJECT_QUEUE_SESSION_IDS: ReadonlySet<string> = new Set();
const EMPTY_RECORDS: readonly SessionCollectionRecord[] = [];

/**
 * Live sessions must remain visible even when another row shares their title.
 * Activity affects badges and duplicate protection, never sidebar chronology.
 */
function isActiveSession(session: GlobalSessionItem): boolean {
  return session.activity === "in-turn" || session.activity === "waiting-input";
}

function sessionCollectionRecordsToSidebarSessionItems(
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

function getSidebarRowActivity(
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

function duplicateGroupingKey(session: GlobalSessionItem): string | null {
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

// Named with a `debugLog` prefix so the console-chatter scanner treats its
// console.debug site as dev-gated (topics/console-chatter.md); the call site
// still guards on import.meta.env.DEV so nothing runs in production.
function debugLogRepeatedSidebarSessionIds(
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

function isSidebarPendingProjectQueueItem(
  item: ProjectQueueItemSummary,
): item is SidebarPendingProjectQueueItem {
  return (
    item.target.type === "new-session" &&
    (item.status === "queued" || item.status === "failed")
  );
}

type SidebarSectionKey = keyof typeof DEFAULT_SECTION_EXPANSION;
type SidebarSectionExpansion = Record<SidebarSectionKey, boolean> & {
  /** Named sections (`category:…`, `user:…`) the reader closed; others open. */
  collapsedGroups?: readonly string[];
};

const CATEGORY_SECTION_PREFIX = "category:";
const CREATOR_SECTION_PREFIX = "user:";

function getLocalStorage(): Storage | null {
  return typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : null;
}

function loadSidebarSectionExpansion(): SidebarSectionExpansion {
  const storage = getLocalStorage();
  if (!storage) {
    return DEFAULT_SECTION_EXPANSION;
  }

  try {
    const raw = storage.getItem(UI_KEYS.sidebarSectionExpansion);
    if (!raw) {
      return DEFAULT_SECTION_EXPANSION;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_SECTION_EXPANSION;
    }
    const value = parsed as Partial<
      Record<SidebarSectionKey | "collapsedGroups", unknown>
    >;
    const collapsedGroups = Array.isArray(value.collapsedGroups)
      ? value.collapsedGroups.filter(
          (key): key is string => typeof key === "string",
        )
      : [];
    return {
      collapsedGroups,
      projectQueue:
        typeof value.projectQueue === "boolean"
          ? value.projectQueue
          : DEFAULT_SECTION_EXPANSION.projectQueue,
      starred:
        typeof value.starred === "boolean"
          ? value.starred
          : DEFAULT_SECTION_EXPANSION.starred,
      recentDay:
        typeof value.recentDay === "boolean"
          ? value.recentDay
          : DEFAULT_SECTION_EXPANSION.recentDay,
      older:
        typeof value.older === "boolean"
          ? value.older
          : DEFAULT_SECTION_EXPANSION.older,
    };
  } catch {
    return DEFAULT_SECTION_EXPANSION;
  }
}

function saveSidebarSectionExpansion(expansion: SidebarSectionExpansion): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(UI_KEYS.sidebarSectionExpansion, JSON.stringify(expansion));
  } catch {
    // localStorage is a UI convenience; in-memory state still applies.
  }
}

interface SidebarSectionHeaderProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  controlsId: string;
  expandLabel: string;
  collapseLabel: string;
  /** Rows in the section, shown only while it is collapsed. */
  count?: number;
  /** More rows exist than are loaded, so `count` is a lower bound. */
  countIsPartial?: boolean;
  /** A limited user's section: marked with a person glyph, name as typed. */
  isPerson?: boolean;
}

/**
 * The whole header row toggles its section. A chevron after the name points
 * down while open and right while closed; a closed section shows its count.
 * Rows below are never indented, so every section keeps the same left edge.
 */
function SidebarSectionHeader({
  title,
  expanded,
  onToggle,
  controlsId,
  expandLabel,
  collapseLabel,
  count,
  countIsPartial = false,
  isPerson = false,
}: SidebarSectionHeaderProps) {
  const actionLabel = expanded ? collapseLabel : expandLabel;

  return (
    <h3 className={sectionHeadingStyles.sectionHeading}>
      <button
        type="button"
        className={sectionHeadingStyles.sectionToggle}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={controlsId}
        aria-label={`${actionLabel}: ${title}`}
      >
        <span
          className={
            isPerson ? sectionHeadingStyles.sectionTitleAsTyped : undefined
          }
        >
          {title}
        </span>
        {isPerson && (
          <svg
            className={sectionHeadingStyles.sectionPersonGlyph}
            viewBox="0 0 10 10"
            aria-hidden="true"
          >
            <circle cx="5" cy="3.2" r="2" />
            <path d="M1.2 9.3C1.6 6.8 3.2 6 5 6s3.4.8 3.8 3.3" />
          </svg>
        )}
        <svg
          className={sectionHeadingStyles.sectionChevron}
          data-expanded={expanded}
          viewBox="0 0 8 8"
          aria-hidden="true"
        >
          <path d="M1 2.5 4 5.5 7 2.5" />
        </svg>
        {!expanded && count !== undefined && (
          <span
            className={sectionHeadingStyles.sectionCount}
            aria-hidden="true"
          >
            {count}
            {countIsPartial ? "+" : ""}
          </span>
        )}
      </button>
    </h3>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: () => void;
  onSessionNavigate?: (intent: SessionNavigationIntent) => void;

  /** Current session ID (for highlighting in sidebar) */
  currentSessionId?: string;

  /** Desktop mode: sidebar is always visible, no overlay */
  isDesktop?: boolean;
  /** Desktop mode: sidebar is collapsed (icons only) */
  isCollapsed?: boolean;
  /** Desktop mode: callback to toggle expanded/collapsed state */
  onToggleExpanded?: () => void;
  /** Desktop collapsed mode: remove the rail and leave a floating restore toggle */
  onMinimize?: () => void;
  /** Desktop mode: current sidebar width in pixels */
  sidebarWidth?: number;
  /** Desktop mode: called when resize starts */
  onResizeStart?: () => void;
  /** Desktop mode: called during resize with new width */
  onResize?: (width: number) => void;
  /** Desktop mode: called when resize ends */
  onResizeEnd?: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  onNavigate,
  onSessionNavigate,
  currentSessionId,
  // Desktop mode props
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
  // Get base path for relay mode (e.g., "/remote/my-server")
  const basePath = useRemoteBasePath();
  const { sidebarDuplicateHidingEnabled } = useSidebarDuplicateHiding();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings: serverSettings } = useServerSettings();
  // Limited users (topics/limited-users.md § Delivery v1): the acting
  // principal decides which nav entries are worth showing. Hiding is
  // cosmetic; the server refuses the same operations either way.
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
  // Starred and categorized sessions are the reader's own picks, so only the
  // recency list drops automation.
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
  // A limited user sees only their own sessions; grouping them under their
  // own name would just rename Last 24 Hours.
  const orderedSessions = useSidebarSessionOrder(
    globalQueryRecords,
    starredSessionRecords,
    sidebarCategoriesSupported ? categorizedSessionRecords : EMPTY_RECORDS,
    sidebarCategoriesSupported && !isLimitedUser,
  );

  const hasNewSessionDraft = useNewSessionDraft();

  // Server capabilities for feature gating
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
  const newSessionPath = "/new-session";

  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarSessionsRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeEngaged = useRef<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef<number | null>(null);
  const resizeStartWidth = useRef<number | null>(null);
  const [sectionExpansion, setSectionExpansion] = useState(
    loadSidebarSectionExpansion,
  );
  const projectQueueExpanded = sectionExpansion.projectQueue;
  const starredExpanded = sectionExpansion.starred;
  const recentDayExpanded = sectionExpansion.recentDay;
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
    projectQueueExpanded,
    starredExpanded,
    recentDayExpanded,
  ].join("\0");

  useEffect(() => {
    void sidebarLoadMoreKey;
    maybeLoadMoreSidebarSessions();
  }, [maybeLoadMoreSidebarSessions, sidebarLoadMoreKey]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchStartY.current = e.touches[0]?.clientY ?? null;
    swipeEngaged.current = false;
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const currentX = e.touches[0]?.clientX;
    const currentY = e.touches[0]?.clientY;
    if (currentX === undefined || currentY === undefined) return;

    const diffX = currentX - touchStartX.current;
    const diffY = currentY - touchStartY.current;

    // If not yet engaged, check if we should engage the swipe
    if (!swipeEngaged.current) {
      const absDiffX = Math.abs(diffX);
      const absDiffY = Math.abs(diffY);

      // Engage swipe only if:
      // 1. Horizontal movement exceeds threshold
      // 2. Horizontal movement is greater than vertical (user is swiping, not scrolling)
      // 3. Movement is to the left (closing gesture)
      if (
        absDiffX > SWIPE_ENGAGE_THRESHOLD &&
        absDiffX > absDiffY &&
        diffX < 0
      ) {
        swipeEngaged.current = true;
      } else {
        return; // Not engaged yet, don't track offset
      }
    }

    // Only allow swiping left (negative offset)
    if (diffX < 0) {
      setSwipeOffset(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (swipeEngaged.current && swipeOffset < -SWIPE_THRESHOLD) {
      onClose();
    }
    touchStartX.current = null;
    touchStartY.current = null;
    swipeEngaged.current = false;
    setSwipeOffset(0);
  };

  // Desktop sidebar resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isDesktop || isCollapsed || !sidebarWidth) return;
    e.preventDefault();
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
    setIsResizing(true);
    onResizeStart?.();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizeStartX.current === null || resizeStartWidth.current === null)
        return;
      const diff = e.clientX - resizeStartX.current;
      const newWidth = resizeStartWidth.current + diff;
      onResize?.(newWidth);
    };

    const handleMouseUp = () => {
      resizeStartX.current = null;
      resizeStartWidth.current = null;
      setIsResizing(false);
      onResizeEnd?.();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onResize, onResizeEnd]);

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

  // Named sections, keyed for the layout hold and remembered expansion.
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
  const supportedSidebarQueueProjectIds = supportsProjectQueue
    ? sidebarQueueProjectIds
    : EMPTY_PROJECT_QUEUE_PROJECT_IDS;
  const supportedSidebarProjectIds = supportsProjectQueue
    ? sidebarProjectIds
    : EMPTY_PROJECT_QUEUE_PROJECT_IDS;
  // Keep the queue feed mounted for visible session rows and projects that
  // report queue work. Badge rendering itself uses the shared count selector.
  const projectQueues = useProjectQueues(supportedSidebarQueueProjectIds);
  const rawProjectQueuedSessionIds = useProjectQueuedSessionIds(
    supportedSidebarProjectIds,
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

  // Client-side duplicate-title hiding is deliberately fail-open. It only
  // hides unrelated exact-title idle rows when a user-facing representative is
  // also visible in this section.
  const [showHiddenRecent, setShowHiddenRecent] = useState(false);

  const groupDuplicateSessions = useCallback(
    (sessions: SidebarSessionItem[]) => {
      const groups = new Map<string, SidebarSessionItem[]>();
      for (const s of sessions) {
        const key = duplicateGroupingKey(s);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)?.push(s);
      }

      const visibleIds = new Set<string>();
      const hidden: GlobalSessionItem[] = [];
      for (const s of sessions) {
        const key = duplicateGroupingKey(s);
        const group = key ? groups.get(key) : undefined;
        if (!group || group.length === 1) {
          visibleIds.add(s.id);
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
      return { visible, hidden: sessions.filter((s) => hiddenIds.has(s.id)) };
    },
    [currentSessionId, projectQueuedSessionIds],
  );

  const { visibleRecent, hiddenRecent } = useMemo(() => {
    if (!sidebarDuplicateHidingEnabled) {
      return {
        visibleRecent: [...recentDaySessions, ...olderSessions],
        hiddenRecent: [],
      };
    }
    const { visible, hidden } = groupDuplicateSessions([
      ...recentDaySessions,
      ...olderSessions,
    ]);
    return { visibleRecent: visible, hiddenRecent: hidden };
  }, [
    groupDuplicateSessions,
    recentDaySessions,
    olderSessions,
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
  const displayedByKey: Record<string, readonly SidebarSessionItem[]> =
    displayed;
  const displayedGroupKeys = (prefix: string) =>
    Object.keys(displayedByKey).filter(
      (key) => key.startsWith(prefix) && (displayedByKey[key]?.length ?? 0) > 0,
    );
  const renderGroupSection = (key: string, name: string, isPerson: boolean) => {
    const rows = displayedByKey[key] ?? [];
    const expanded = !sectionExpansion.collapsedGroups?.includes(key);
    const listId = `sidebar-group-${encodeURIComponent(key)}`;
    return (
      <div className={`sidebar-section ${sidebarStyles.section}`} key={key}>
        <SidebarSectionHeader
          title={name}
          expanded={expanded}
          onToggle={() => toggleSidebarGroupExpanded(key)}
          controlsId={listId}
          expandLabel={t("sidebarSectionExpand")}
          collapseLabel={t("sidebarSectionCollapse")}
          count={rows.length}
          countIsPartial={
            isPerson ? hasMoreGlobalSessions : hasMoreCategorizedSessions
          }
          isPerson={isPerson}
        />
        {expanded && (
          <ul
            id={listId}
            className={`sidebar-session-list ${sidebarStyles.sessionList}`}
          >
            {rows.map(renderCompactSession)}
          </ul>
        )}
      </div>
    );
  };

  // Dev-only: flag a true repeated id, which title grouping cannot fix.
  useEffect(() => {
    if (import.meta.env.DEV)
      debugLogRepeatedSidebarSessionIds(recentDaySessions);
  }, [recentDaySessions]);

  const drafts = useDraftSessionIds();

  // Single source of truth for a compact sidebar session row, so the six
  // section render sites (starred / recent / older, each with a hidden-dups
  // sublist) stay identical. `createdAt` + `model` + `lastAgentText` feed the
  // hover card.
  const renderCompactSession = (session: SidebarSessionItem) => {
    const hasProjectQueue = projectQueuedSessionIds.has(session.id);
    return (
      <SessionListItem
        key={session.id}
        sessionId={session.id}
        projectId={session.projectId}
        title={getSessionDisplayTitle(session)}
        fullTitle={session.fullTitle ?? getSessionDisplayTitle(session)}
        initialPrompt={session.initialPrompt}
        hasCustomTitle={!!session.customTitle}
        lastAgentText={session.lastAgentText}
        provider={session.provider}
        model={session.model}
        createdAt={session.createdAt}
        updatedAt={session.updatedAt}
        parentSessionId={session.parentSessionId}
        parentSessionKind={session.parentSessionKind}
        providerChildren={
          providerChildrenBySessionId.get(session.id) ??
          session.providerChildren
        }
        status={session.ownership}
        pendingInputType={session.pendingInputType}
        hasUnread={session.hasUnread}
        isStarred={session.isStarred}
        isArchived={session.isArchived}
        sidebarCategory={session.sidebarCategory}
        sidebarCategoryNames={
          sidebarCategoriesSupported ? sidebarCategoryNames : undefined
        }
        clearloop={session.clearloop}
        mode="compact"
        isCurrent={session.id === currentSessionId}
        activity={getSidebarRowActivity(session)}
        onNavigate={onNavigate}
        onSessionNavigate={onSessionNavigate}
        showProjectName
        projectName={
          projectNameById.get(session.projectId) ?? session.projectName
        }
        basePath={basePath}
        messageCount={session.messageCount}
        hasDraft={drafts.has(session.id)}
        hasProjectQueue={hasProjectQueue}
        publicShareCreationReady={publicShareCreationReady}
        publicShareManagementAvailable={publicShareManagementAvailable}
      />
    );
  };

  // In desktop mode, always render. In mobile mode, only render when open.
  if (!isDesktop && !isOpen) return null;

  return (
    <>
      {/* Only show overlay in non-desktop mode */}
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
          {/* New Session: link to most recent project's new session page */}
          <SidebarNavItem
            to={newSessionPath}
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

          {supportsProjectQueue && pendingProjectQueueItems.length > 0 && (
            <div className={`sidebar-section ${sidebarStyles.section}`}>
              <SidebarSectionHeader
                title={t("sidebarSectionPendingSessions")}
                expanded={projectQueueExpanded}
                onToggle={() =>
                  setSidebarSectionExpanded("projectQueue", (prev) => !prev)
                }
                controlsId="sidebar-project-queue-list"
                expandLabel={t("sidebarSectionExpand")}
                collapseLabel={t("sidebarSectionCollapse")}
              />
              {projectQueueExpanded && (
                <ul
                  id="sidebar-project-queue-list"
                  className="sidebar-project-queue-list"
                >
                  {pendingProjectQueueItems.map((item) => {
                    const itemTitle =
                      item.target.title ||
                      item.messagePreview ||
                      t("projectQueueTargetNewSession");
                    const projectName =
                      projectNameById.get(item.projectId) ??
                      t("projectQueueUnknownProject");
                    return (
                      <li
                        key={item.id}
                        className={sidebarStyles.pendingQueueRow}
                      >
                        <Link
                          to={`${basePath}/projects?queueItem=${encodeURIComponent(
                            item.id,
                          )}`}
                          className={`sidebar-project-queue-item sidebar-project-queue-item--${item.status} ${sidebarStyles.pendingQueueLink}`}
                          onClick={(event) =>
                            void handlePendingProjectQueueClick(event, item)
                          }
                          title={itemTitle}
                        >
                          <span className="sidebar-project-queue-item__main">
                            <span className="sidebar-project-queue-item__title">
                              {itemTitle}
                            </span>
                            <span className="sidebar-project-queue-item__project">
                              {projectName}
                            </span>
                          </span>
                          <span className="sidebar-project-queue-item__status">
                            {item.status === "failed"
                              ? t("projectQueueStatusFailed")
                              : t("projectQueueStatusQueued")}
                          </span>
                        </Link>
                        {item.status === "queued" &&
                          projectQueues.dispatchState.status === "paused" && (
                            <CompactResumeButton
                              label={t("sidebarSessionResume")}
                              title={t("sidebarPendingSessionResumeTitle")}
                              pending={resumingPendingQueueItemIds.has(item.id)}
                              onResume={() =>
                                handleResumePendingQueueItem(item)
                              }
                            />
                          )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Global sessions list */}
          {displayed.starred.length > 0 && (
            <div className={`sidebar-section ${sidebarStyles.section}`}>
              <SidebarSectionHeader
                title={t("sidebarSectionStarred")}
                expanded={starredExpanded}
                onToggle={() =>
                  setSidebarSectionExpanded("starred", (prev) => !prev)
                }
                controlsId="sidebar-starred-list"
                expandLabel={t("sidebarSectionExpand")}
                collapseLabel={t("sidebarSectionCollapse")}
                count={displayed.starred.length}
                countIsPartial={hasMoreStarredSessions}
              />
              {starredExpanded && (
                <ul
                  id="sidebar-starred-list"
                  className={`sidebar-session-list ${sidebarStyles.sessionList}`}
                >
                  {displayed.starred.map(renderCompactSession)}
                </ul>
              )}
            </div>
          )}

          {displayedGroupKeys(CATEGORY_SECTION_PREFIX).map((key) =>
            renderGroupSection(
              key,
              key.slice(CATEGORY_SECTION_PREFIX.length),
              false,
            ),
          )}

          {displayed.recent.length > 0 && (
            <div className={`sidebar-section ${sidebarStyles.section}`}>
              <SidebarSectionHeader
                title={t("sessionRecentSessions")}
                expanded={recentDayExpanded}
                onToggle={() =>
                  setSidebarSectionExpanded("recentDay", (prev) => !prev)
                }
                controlsId="sidebar-last-24-hours-list"
                expandLabel={t("sidebarSectionExpand")}
                collapseLabel={t("sidebarSectionCollapse")}
                count={displayed.recent.length + displayed.hiddenRecent.length}
                countIsPartial={
                  hasMoreGlobalSessions ||
                  visibleRecent.length > RECENT_SHORTCUT_LIMIT
                }
              />
              {recentDayExpanded && (
                <ul
                  id="sidebar-last-24-hours-list"
                  className={`sidebar-session-list ${sidebarStyles.sessionList}`}
                >
                  {displayed.recent.map(renderCompactSession)}
                  {displayed.hiddenRecent.length > 0 && (
                    <li className="sidebar-hidden-dups">
                      <button
                        type="button"
                        className={`sidebar-hidden-dups-toggle ${sidebarStyles.hiddenDupsToggle}`}
                        onClick={() => setShowHiddenRecent((v) => !v)}
                        aria-expanded={showHiddenRecent}
                      >
                        {showHiddenRecent ? "−" : "+"}{" "}
                        {t("sidebarHiddenDuplicateSessions", {
                          count: displayed.hiddenRecent.length,
                        })}
                      </button>
                      {showHiddenRecent && (
                        <ul
                          className={`sidebar-session-list sidebar-hidden-sublist ${sidebarStyles.sessionList}`}
                        >
                          {displayed.hiddenRecent.map(renderCompactSession)}
                        </ul>
                      )}
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          <Link
            className={sidebarStyles.recentMore}
            to={`${basePath}/sessions`}
            onClick={onNavigate}
          >
            {t("sessionOverviewViewAll")}
          </Link>

          {displayedGroupKeys(CREATOR_SECTION_PREFIX).map((key) =>
            renderGroupSection(
              key,
              key.slice(CREATOR_SECTION_PREFIX.length),
              true,
            ),
          )}

          {displayed.starred.length === 0 &&
            pendingProjectQueueItems.length === 0 &&
            displayed.recent.length === 0 &&
            displayedGroupKeys(CATEGORY_SECTION_PREFIX).length === 0 &&
            displayedGroupKeys(CREATOR_SECTION_PREFIX).length === 0 && (
              <p className={`sidebar-empty ${sidebarStyles.empty}`}>
                {sessionsLoading
                  ? t("sidebarLoadingSessions")
                  : t("sidebarNoSessions")}
              </p>
            )}
        </div>

        <SidebarFooter basePath={basePath} onNavigate={onNavigate} />

        {/* Resize handle - desktop only, when expanded */}
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
