import type { ProviderChildSessionSummary } from "@vibeallday/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n";
import { RECENT_SHORTCUT_LIMIT } from "../../lib/sessionOverview";
import { getSessionDisplayTitle } from "../../utils";
import { CompactResumeButton } from "../CompactResumeButton";
import { SessionListItem, type SessionNavigationIntent } from "../SessionListItem";
import sidebarStyles from "../Sidebar.module.css";
import {
  CATEGORY_SECTION_PREFIX,
  CREATOR_SECTION_PREFIX,
  type SidebarSectionExpansion,
  SidebarSectionHeader,
  type SidebarSectionKey,
} from "./SidebarSectionHeader";
import {
  getSidebarRowActivity,
  type SidebarPendingProjectQueueItem,
  type SidebarSessionItem,
} from "./sidebarSessionModel";

interface SidebarSessionSectionsProps {
  basePath: string;
  currentSessionId?: string;
  supportsProjectQueue: boolean;
  pendingProjectQueueItems: readonly SidebarPendingProjectQueueItem[];
  projectQueueDispatchPaused: boolean;
  resumingPendingQueueItemIds: ReadonlySet<string>;
  onPendingProjectQueueClick: (
    event: React.MouseEvent<HTMLAnchorElement>,
    item: SidebarPendingProjectQueueItem,
  ) => void;
  onResumePendingQueueItem: (item: SidebarPendingProjectQueueItem) => void;
  sectionExpansion: SidebarSectionExpansion;
  onSetSectionExpanded: (
    section: SidebarSectionKey,
    update: boolean | ((current: boolean) => boolean),
  ) => void;
  onToggleGroupExpanded: (groupKey: string) => void;
  displayedByKey: Record<string, readonly SidebarSessionItem[]>;
  starredSessions: readonly SidebarSessionItem[];
  recentSessions: readonly SidebarSessionItem[];
  hiddenRecentSessions: readonly SidebarSessionItem[];
  visibleRecentCount: number;
  hasMoreGlobalSessions: boolean;
  hasMoreStarredSessions: boolean;
  hasMoreCategorizedSessions: boolean;
  sessionsLoading: boolean;
  sidebarCategoriesSupported: boolean;
  sidebarCategoryNames: readonly string[];
  projectNameById: ReadonlyMap<string, string>;
  projectQueuedSessionIds: ReadonlySet<string>;
  draftSessionIds: ReadonlySet<string>;
  providerChildrenBySessionId: ReadonlyMap<
    string,
    ProviderChildSessionSummary[] | undefined
  >;
  publicShareCreationReady: boolean;
  publicShareManagementAvailable: boolean;
  onNavigate: () => void;
  onSessionNavigate?: (intent: SessionNavigationIntent) => void;
}

export function SidebarSessionSections({
  basePath,
  currentSessionId,
  supportsProjectQueue,
  pendingProjectQueueItems,
  projectQueueDispatchPaused,
  resumingPendingQueueItemIds,
  onPendingProjectQueueClick,
  onResumePendingQueueItem,
  sectionExpansion,
  onSetSectionExpanded,
  onToggleGroupExpanded,
  displayedByKey,
  starredSessions,
  recentSessions,
  hiddenRecentSessions,
  visibleRecentCount,
  hasMoreGlobalSessions,
  hasMoreStarredSessions,
  hasMoreCategorizedSessions,
  sessionsLoading,
  sidebarCategoriesSupported,
  sidebarCategoryNames,
  projectNameById,
  projectQueuedSessionIds,
  draftSessionIds,
  providerChildrenBySessionId,
  publicShareCreationReady,
  publicShareManagementAvailable,
  onNavigate,
  onSessionNavigate,
}: SidebarSessionSectionsProps) {
  const { t } = useI18n();
  const [showHiddenRecent, setShowHiddenRecent] = useState(false);

  const displayedGroupKeys = (prefix: string) =>
    Object.keys(displayedByKey).filter(
      (key) => key.startsWith(prefix) && (displayedByKey[key]?.length ?? 0) > 0,
    );

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
          sidebarCategoriesSupported ? [...sidebarCategoryNames] : undefined
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
        hasDraft={draftSessionIds.has(session.id)}
        hasProjectQueue={hasProjectQueue}
        publicShareCreationReady={publicShareCreationReady}
        publicShareManagementAvailable={publicShareManagementAvailable}
      />
    );
  };

  const renderGroupSection = (key: string, name: string, isPerson: boolean) => {
    const rows = displayedByKey[key] ?? [];
    const expanded = !sectionExpansion.collapsedGroups?.includes(key);
    const listId = `sidebar-group-${encodeURIComponent(key)}`;
    return (
      <div className={`sidebar-section ${sidebarStyles.section}`} key={key}>
        <SidebarSectionHeader
          title={name}
          expanded={expanded}
          onToggle={() => onToggleGroupExpanded(key)}
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

  const categoryKeys = displayedGroupKeys(CATEGORY_SECTION_PREFIX);
  const creatorKeys = displayedGroupKeys(CREATOR_SECTION_PREFIX);

  return (
    <>
      {supportsProjectQueue && pendingProjectQueueItems.length > 0 && (
        <div className={`sidebar-section ${sidebarStyles.section}`}>
          <SidebarSectionHeader
            title={t("sidebarSectionPendingSessions")}
            expanded={sectionExpansion.projectQueue}
            onToggle={() =>
              onSetSectionExpanded("projectQueue", (prev) => !prev)
            }
            controlsId="sidebar-project-queue-list"
            expandLabel={t("sidebarSectionExpand")}
            collapseLabel={t("sidebarSectionCollapse")}
          />
          {sectionExpansion.projectQueue && (
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
                  <li key={item.id} className={sidebarStyles.pendingQueueRow}>
                    <Link
                      to={`${basePath}/projects?queueItem=${encodeURIComponent(
                        item.id,
                      )}`}
                      className={`sidebar-project-queue-item sidebar-project-queue-item--${item.status} ${sidebarStyles.pendingQueueLink}`}
                      onClick={(event) =>
                        onPendingProjectQueueClick(event, item)
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
                    {item.status === "queued" && projectQueueDispatchPaused && (
                      <CompactResumeButton
                        label={t("sidebarSessionResume")}
                        title={t("sidebarPendingSessionResumeTitle")}
                        pending={resumingPendingQueueItemIds.has(item.id)}
                        onResume={() => onResumePendingQueueItem(item)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {starredSessions.length > 0 && (
        <div className={`sidebar-section ${sidebarStyles.section}`}>
          <SidebarSectionHeader
            title={t("sidebarSectionStarred")}
            expanded={sectionExpansion.starred}
            onToggle={() => onSetSectionExpanded("starred", (prev) => !prev)}
            controlsId="sidebar-starred-list"
            expandLabel={t("sidebarSectionExpand")}
            collapseLabel={t("sidebarSectionCollapse")}
            count={starredSessions.length}
            countIsPartial={hasMoreStarredSessions}
          />
          {sectionExpansion.starred && (
            <ul
              id="sidebar-starred-list"
              className={`sidebar-session-list ${sidebarStyles.sessionList}`}
            >
              {starredSessions.map(renderCompactSession)}
            </ul>
          )}
        </div>
      )}

      {categoryKeys.map((key) =>
        renderGroupSection(
          key,
          key.slice(CATEGORY_SECTION_PREFIX.length),
          false,
        ),
      )}

      {recentSessions.length > 0 && (
        <div className={`sidebar-section ${sidebarStyles.section}`}>
          <SidebarSectionHeader
            title={t("sessionRecentSessions")}
            expanded={sectionExpansion.recentDay}
            onToggle={() => onSetSectionExpanded("recentDay", (prev) => !prev)}
            controlsId="sidebar-last-24-hours-list"
            expandLabel={t("sidebarSectionExpand")}
            collapseLabel={t("sidebarSectionCollapse")}
            count={recentSessions.length + hiddenRecentSessions.length}
            countIsPartial={
              hasMoreGlobalSessions ||
              visibleRecentCount > RECENT_SHORTCUT_LIMIT
            }
          />
          {sectionExpansion.recentDay && (
            <ul
              id="sidebar-last-24-hours-list"
              className={`sidebar-session-list ${sidebarStyles.sessionList}`}
            >
              {recentSessions.map(renderCompactSession)}
              {hiddenRecentSessions.length > 0 && (
                <li className="sidebar-hidden-dups">
                  <button
                    type="button"
                    className={`sidebar-hidden-dups-toggle ${sidebarStyles.hiddenDupsToggle}`}
                    onClick={() => setShowHiddenRecent((v) => !v)}
                    aria-expanded={showHiddenRecent}
                  >
                    {showHiddenRecent ? "−" : "+"}{" "}
                    {t("sidebarHiddenDuplicateSessions", {
                      count: hiddenRecentSessions.length,
                    })}
                  </button>
                  {showHiddenRecent && (
                    <ul
                      className={`sidebar-session-list sidebar-hidden-sublist ${sidebarStyles.sessionList}`}
                    >
                      {hiddenRecentSessions.map(renderCompactSession)}
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

      {creatorKeys.map((key) =>
        renderGroupSection(key, key.slice(CREATOR_SECTION_PREFIX.length), true),
      )}

      {starredSessions.length === 0 &&
        pendingProjectQueueItems.length === 0 &&
        recentSessions.length === 0 &&
        categoryKeys.length === 0 &&
        creatorKeys.length === 0 && (
          <p className={`sidebar-empty ${sidebarStyles.empty}`}>
            {sessionsLoading
              ? t("sidebarLoadingSessions")
              : t("sidebarNoSessions")}
          </p>
        )}
    </>
  );
}
