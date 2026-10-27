import {
  GIT_SOURCE_REVIEW_SUBMISSIONS_CAPABILITY,
  PUBLIC_SHARE_MANAGEMENT_CAPABILITY,
  type ProjectQueueItemStatus,
  type ProjectQueueItemSummary,
  type ReviewInboxItem,
  serverHasCapability,
} from "@vibeallday/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { type InboxItem, useInboxContext } from "../contexts/InboxContext";
import { useProjectQueues } from "../hooks/useProjectQueues";
import { usePublicShareStatus } from "../hooks/usePublicShareStatus";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useServerSettings } from "../hooks/useServerSettings";
import { useVersion } from "../hooks/useVersion";
import type { SessionOverviewData } from "../hooks/useSessionOverview";
import { type MessageKey, useI18n } from "../i18n";
import {
  useDraftSessionIds,
  useProjectQueuedSessionIds,
} from "../lib/clientSummaryStore";
import { activityBus } from "../lib/activityBus";
import { serverSupportsProjectQueue } from "../lib/projectQueueVisibility";
import type { Project } from "../types";
import { getSessionDisplayTitle } from "../utils";
import { FilterDropdown, type FilterOption } from "./FilterDropdown";
import { Button, IconButton } from "./garden/Button";
import { EmptyState } from "./garden/EmptyState";
import { LoadingState } from "./garden/LoadingState";
import { SectionHeader, type SectionTone } from "./garden/SectionHeader";
import styles from "./InboxContent.module.css";
import { type NowJumpTarget, NowSummary } from "./now/NowSummary";
import { SessionListItem } from "./SessionListItem";
import { SessionAsyncQuestionsButton } from "./SessionAsyncQuestionsButton";

const EMPTY_PROJECT_QUEUE_PROJECT_IDS: readonly string[] = [];
const EMPTY_PROJECT_QUEUE_SESSION_IDS: ReadonlySet<string> = new Set();

type TierKey = NowJumpTarget | "recentActivity";

/**
 * "Now" tiers in reading order. Empty tiers are not rendered; the two
 * unread windows from the inbox feed share one Unread tier.
 */
interface TierConfig {
  key: TierKey;
  titleKey: MessageKey;
  tone: SectionTone;
  getBadge?: (
    item: InboxItem,
  ) => { label: MessageKey; className: string } | null;
}

const TIER_CONFIGS: TierConfig[] = [
  {
    key: "needsAttention",
    titleKey: "inboxTierNeedsAttention",
    tone: "rose",
    getBadge: (item) => {
      if (item.pendingInputType === "tool-approval") {
        return {
          label: "inboxBadgeApproval",
          className: styles.badgeApproval ?? "",
        };
      }
      if (item.pendingInputType === "user-question") {
        return {
          label: "inboxBadgeQuestion",
          className: styles.badgeQuestion ?? "",
        };
      }
      return null;
    },
  },
  // Active items show a pulsing dot instead of a text badge.
  { key: "active", titleKey: "inboxTierActive", tone: "mint" },
  { key: "unread", titleKey: "inboxTierUnread", tone: "sand" },
  {
    key: "recentActivity",
    titleKey: "inboxTierRecentActivity",
    tone: "default",
  },
];

/** Session rows carry their tier's state color on the card accent rule. */
const TIER_ACCENT_CLASS: Record<SectionTone, string> = {
  default: "",
  rose: styles.accentRose ?? "",
  mint: styles.accentMint ?? "",
  sand: styles.accentSand ?? "",
};

/** Heading id a summary jump scrolls to. */
function tierHeadingId(key: TierKey): string {
  return `now-tier-${key}`;
}

/**
 * Explicit module classes for the closed Project Queue status union.
 * Only the statuses with a rule get a class; `queued` styles the base
 * item and status pill alone, matching the legacy stylesheet.
 */
const QUEUE_ITEM_STATUS_CLASSES: Record<ProjectQueueItemStatus, string> = {
  queued: "",
  dispatching: "",
  failed: styles.queueItemFailed ?? "",
};

const QUEUE_STATUS_CLASSES: Record<ProjectQueueItemStatus, string> = {
  queued: "",
  dispatching: styles.queueItemStatusDispatching ?? "",
  failed: styles.queueItemStatusFailed ?? "",
};

type Translate = ReturnType<typeof useI18n>["t"];

type PendingNewSessionProjectQueueItem = ProjectQueueItemSummary & {
  target: Extract<ProjectQueueItemSummary["target"], { type: "new-session" }>;
};

function isPendingNewSessionProjectQueueItem(
  item: ProjectQueueItemSummary,
): item is PendingNewSessionProjectQueueItem {
  return (
    item.target.type === "new-session" &&
    (item.status === "queued" ||
      item.status === "dispatching" ||
      item.status === "failed")
  );
}

function projectQueueStatusLabel(
  status: ProjectQueueItemSummary["status"],
  t: Translate,
): string {
  switch (status) {
    case "dispatching":
      return t("projectQueueStatusDispatching");
    case "failed":
      return t("projectQueueStatusFailed");
    case "queued":
      return t("projectQueueStatusQueued");
  }
}

function formatProjectQueueAge(timestamp: string, t: Translate): string {
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Math.max(0, Date.now() - then);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("projectQueueAgeJustNow");
  if (diffMins < 60) return t("projectQueueAgeMinutes", { count: diffMins });
  if (diffHours < 24) return t("projectQueueAgeHours", { count: diffHours });
  if (diffDays < 7) return t("projectQueueAgeDays", { count: diffDays });
  return new Date(timestamp).toLocaleDateString();
}

interface InboxSectionProps {
  config: TierConfig;
  items: InboxItem[];
  projectQueueItems?: PendingNewSessionProjectQueueItem[];
  projectNameById: ReadonlyMap<string, string>;
  /** When true, hides project name (for single-project inbox) */
  hideProjectName?: boolean;
  /** Base path prefix for relay mode (e.g., "/remote/my-server") */
  basePath?: string;
  /** Set of session IDs that have unsent drafts */
  drafts: ReadonlySet<string>;
  /** Set of session IDs targeted by Project Queue items */
  projectQueuedSessionIds: ReadonlySet<string>;
  /** Whether public share creation controls should be exposed. */
  publicShareCreationReady: boolean;
  /** Whether direct public-share management is supported. */
  publicShareManagementAvailable: boolean;
}

interface InboxProjectQueueItemProps {
  item: PendingNewSessionProjectQueueItem;
  projectName: string;
  basePath?: string;
  hideProjectName?: boolean;
}

function InboxProjectQueueItem({
  item,
  projectName,
  basePath = "",
  hideProjectName = false,
}: InboxProjectQueueItemProps) {
  const { t } = useI18n();
  const prompt = item.messagePreview.trim() || t("projectQueueAttachmentOnly");
  const targetTitle = item.target.title?.trim();
  const title = targetTitle || prompt;
  const showPromptPreview = !!targetTitle && targetTitle !== prompt;
  const age = formatProjectQueueAge(item.createdAt, t);
  const href = `${basePath}/projects?queueItem=${encodeURIComponent(item.id)}`;

  return (
    <li
      className={`${styles.queueItem} ${QUEUE_ITEM_STATUS_CLASSES[item.status]}`}
      data-inbox-project-queue-item-id={item.id}
    >
      <Link className={styles.queueItemLink} to={href}>
        <span className={styles.queueItemTitleRow}>
          <strong className={styles.queueItemTitle}>{title}</strong>
          <span className={styles.queueItemTargetBadge}>
            {t("projectQueueTargetNewSession")}
          </span>
          <span
            className="session-project-queue-badge"
            title={t("projectQueueSidebarBadge")}
          >
            Q
          </span>
        </span>
        {showPromptPreview && (
          <span className={styles.queueItemPreview}>{prompt}</span>
        )}
        <span className={styles.queueItemMeta}>
          {!hideProjectName && (
            <span className={styles.queueItemProject}>{projectName}</span>
          )}
          {age && <span>{age}</span>}
          <span
            className={`${styles.queueItemStatus} ${QUEUE_STATUS_CLASSES[item.status]}`}
          >
            {projectQueueStatusLabel(item.status, t)}
          </span>
        </span>
      </Link>
    </li>
  );
}

function getInboxRowActivity(
  item: InboxItem,
  tierKey: string,
): InboxItem["activity"] {
  if (tierKey === "active" && item.activityInferredFromInboxTier) {
    return undefined;
  }
  return item.activity;
}

function InboxSection({
  config,
  items,
  projectQueueItems = [],
  projectNameById,
  hideProjectName,
  basePath = "",
  drafts,
  projectQueuedSessionIds,
  publicShareCreationReady,
  publicShareManagementAvailable,
}: InboxSectionProps) {
  const { t } = useI18n();
  const sectionCount = items.length + projectQueueItems.length;
  if (sectionCount === 0) return null;
  const headingId = tierHeadingId(config.key);

  return (
    <section
      className={`${styles.section} ${TIER_ACCENT_CLASS[config.tone]}`}
      aria-labelledby={headingId}
    >
      <SectionHeader
        id={headingId}
        title={t(config.titleKey)}
        count={sectionCount}
        tone={config.tone}
      />
      <ul className={`sessions-list ${styles.collection}`}>
        {projectQueueItems.map((item) => (
          <InboxProjectQueueItem
            key={item.id}
            item={item}
            projectName={
              projectNameById.get(item.projectId) ??
              t("projectQueueUnknownProject")
            }
            hideProjectName={hideProjectName}
            basePath={basePath}
          />
        ))}
        {items.map((item) => {
          const badge = config.getBadge?.(item);
          const activity = getInboxRowActivity(item, config.key);
          return (
            <SessionListItem
              key={item.sessionId}
              sessionId={item.sessionId}
              projectId={item.projectId}
              title={getSessionDisplayTitle({
                customTitle: item.customTitle,
                title: item.sessionTitle,
              })}
              hasCustomTitle={!!item.customTitle}
              projectName={item.projectName}
              updatedAt={item.updatedAt}
              hasUnread={item.hasUnread}
              isStarred={item.isStarred}
              activity={activity}
              pendingInputType={item.pendingInputType}
              mode="card"
              openNonHumanUserTurn
              showProjectName={!hideProjectName}
              showTimestamp
              showStatusBadge={false}
              showActivityIndicator={config.key === "active"}
              customBadge={badge ? { ...badge, label: t(badge.label) } : null}
              basePath={basePath}
              hasDraft={drafts.has(item.sessionId)}
              hasProjectQueue={projectQueuedSessionIds.has(item.sessionId)}
              publicShareCreationReady={publicShareCreationReady}
              publicShareManagementAvailable={publicShareManagementAvailable}
            />
          );
        })}
      </ul>
    </section>
  );
}

function ReviewOutcomeSection({
  items,
  basePath,
  hideProjectName,
}: {
  items: ReviewInboxItem[];
  basePath: string;
  hideProjectName: boolean;
}) {
  const { t } = useI18n();
  const outcomes = items.flatMap((item) =>
    item.outcomes.map((outcome) => ({ item, outcome })),
  );
  return (
    <section className={styles.section}>
      <SectionHeader
        title={t("inboxTierReviewOutcomes")}
        count={outcomes.length}
      />
      <ul className={styles.reviewOutcomeList}>
        {outcomes.map(({ item, outcome }) => {
          const reviewParams = new URLSearchParams({
            projectId: item.projectId,
            tab: "reviews",
            submission: item.submissionId,
          });
          return (
            <li
              key={`${item.submissionId}\0${outcome.siteId}\0${outcome.entryId}`}
              className={styles.reviewOutcomeCard}
            >
              <div className={styles.reviewOutcomeHead}>
                <Link to={`${basePath}/git-status?${reviewParams}`}>
                  {item.name ?? t("sourceReviewUnreadSubmission")}
                </Link>
                <span>{reviewDispositionLabel(outcome.disposition, t)}</span>
              </div>
              <div className={styles.reviewOutcomeText}>{outcome.text}</div>
              <div className={styles.reviewOutcomeMeta}>
                {!hideProjectName && <span>{item.projectName}</span>}
                <span>{outcome.path}</span>
                {outcome.sessionId && (
                  <Link
                    to={`${basePath}/projects/${encodeURIComponent(
                      item.projectId,
                    )}/sessions/${encodeURIComponent(outcome.sessionId)}`}
                  >
                    {t("sourceReviewOutcomeSession")}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function reviewDispositionLabel(
  disposition: ReviewInboxItem["outcomes"][number]["disposition"],
  t: Translate,
): string {
  if (disposition === "wont_fix") return t("sourceReviewOutcomeNoChange");
  if (disposition === "question") return t("sourceReviewOutcomeQuestion");
  return t("sourceReviewOutcomeDone");
}

export interface InboxContentProps {
  overview?: SessionOverviewData;
  /** Optional projectId to filter inbox to a single project */
  projectId?: string;
  /** List of projects for the filter dropdown */
  projects?: Project[];
  /** Callback when project filter changes */
  onProjectChange?: (projectId: string | undefined) => void;
}

/**
 * Filter inbox items by project ID.
 */
function filterByProject(
  items: InboxItem[],
  projectId: string | undefined,
): InboxItem[] {
  if (!projectId) return items;
  return items.filter((item) => item.projectId === projectId);
}

/**
 * Shared inbox content component.
 * Displays inbox tiers, refresh button, and empty/loading/error states.
 * Uses InboxContext for data - filtering is done client-side.
 */
export function InboxContent({
  projectId,
  projects,
  onProjectChange,
  overview,
}: InboxContentProps) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const navigate = useNavigate();
  const { settings: serverSettings } = useServerSettings();
  const { version } = useVersion();
  const supportsProjectQueue = serverSupportsProjectQueue(version);
  const publicShareManagementAvailable = serverHasCapability(
    version,
    PUBLIC_SHARE_MANAGEMENT_CAPABILITY,
  );
  const supportsSourceReviewInbox =
    serverHasCapability(version, GIT_SOURCE_REVIEW_SUBMISSIONS_CAPABILITY) &&
    (serverSettings?.sourceReviewSubmissionsEnabled ?? false);
  const [reviewInbox, setReviewInbox] = useState<ReviewInboxItem[]>([]);
  const [reviewInboxLoading, setReviewInboxLoading] = useState(false);
  const publicSharesEnabled = serverSettings?.publicSharesEnabled ?? false;
  const { status: publicShareStatus } = usePublicShareStatus({
    poll: publicSharesEnabled,
  });
  const publicShareCreationReady = publicShareStatus?.canCreate ?? false;
  const {
    needsAttention: allNeedsAttention,
    active: allActive,
    recentActivity: allRecentActivity,
    unread8h: allUnread8h,
    unread24h: allUnread24h,
    loading: inboxLoading,
    error: inboxError,
    refresh,
  } = useInboxContext();
  const loading = overview?.loading ?? inboxLoading;
  const error = overview?.error ?? (overview ? null : inboxError);

  // Filter by project if specified
  const needsAttention =
    overview?.needsAttention ?? filterByProject(allNeedsAttention, projectId);
  const active = overview?.active ?? filterByProject(allActive, projectId);
  const recentActivity =
    overview?.recentActivity ?? filterByProject(allRecentActivity, projectId);
  const unread8h = overview ? [] : filterByProject(allUnread8h, projectId);
  const unread24h = overview ? [] : filterByProject(allUnread24h, projectId);
  const unread = [...unread8h, ...unread24h];

  const totalSessionItems =
    needsAttention.length +
    active.length +
    recentActivity.length +
    unread8h.length +
    unread24h.length;

  const [refreshing, setRefreshing] = useState(false);

  const loadReviewInbox = useCallback(async () => {
    if (!supportsSourceReviewInbox) {
      setReviewInbox([]);
      setReviewInboxLoading(false);
      return;
    }
    setReviewInboxLoading(true);
    try {
      const result = await api.listReviewInbox();
      setReviewInbox(result.items);
    } finally {
      setReviewInboxLoading(false);
    }
  }, [supportsSourceReviewInbox]);

  useEffect(() => {
    void loadReviewInbox().catch(() => {
      // The ordinary Inbox remains usable if the optional feed fails.
    });
    if (!supportsSourceReviewInbox) return;
    return activityBus.on("review-response-changed", () => {
      void loadReviewInbox().catch(() => {
        // Preserve the last accepted outcome cards on transient failures.
      });
    });
  }, [loadReviewInbox, supportsSourceReviewInbox]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refresh(),
        overview?.refresh(),
        loadReviewInbox().catch(() => {
          // The review feed is optional; retain its last accepted cards.
        }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const jumpToTier = (target: NowJumpTarget) => {
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.getElementById(tierHeadingId(target))?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const tierData: Record<TierKey, InboxItem[]> = {
    needsAttention,
    active,
    unread,
    recentActivity,
  };

  const visibleSessionProjectIds = useMemo(
    () => [
      ...new Set(
        [
          ...needsAttention,
          ...active,
          ...recentActivity,
          ...unread8h,
          ...unread24h,
        ]
          .map((item) => item.projectId)
          .filter(Boolean),
      ),
    ],
    [needsAttention, active, recentActivity, unread8h, unread24h],
  );
  const queueFeedProjectIds = useMemo(() => {
    if (projectId) return [projectId];
    if (projects && projects.length > 0) {
      return [...new Set(projects.map((project) => project.id))];
    }
    return visibleSessionProjectIds;
  }, [projectId, projects, visibleSessionProjectIds]);
  const projectNameById = useMemo(() => {
    const names = new Map(
      (projects ?? []).map((project) => [project.id, project.name]),
    );
    for (const item of [
      ...needsAttention,
      ...active,
      ...recentActivity,
      ...unread8h,
      ...unread24h,
    ]) {
      if (!names.has(item.projectId)) {
        names.set(item.projectId, item.projectName);
      }
    }
    return names;
  }, [projects, needsAttention, active, recentActivity, unread8h, unread24h]);
  // Keep the queue feed mounted for known inbox projects. Badge rendering
  // reads from the shared client summary store selector below, while new-session
  // queue items render as pending Active rows because they have no session yet.
  const projectQueues = useProjectQueues(
    supportsProjectQueue
      ? queueFeedProjectIds
      : EMPTY_PROJECT_QUEUE_PROJECT_IDS,
  );
  const rawProjectQueuedSessionIds = useProjectQueuedSessionIds(
    supportsProjectQueue
      ? visibleSessionProjectIds
      : EMPTY_PROJECT_QUEUE_PROJECT_IDS,
  );
  const projectQueuedSessionIds = supportsProjectQueue
    ? rawProjectQueuedSessionIds
    : EMPTY_PROJECT_QUEUE_SESSION_IDS;
  const pendingNewSessionQueueItems = useMemo(
    () =>
      supportsProjectQueue
        ? projectQueues.items.filter(isPendingNewSessionProjectQueueItem)
        : [],
    [projectQueues.items, supportsProjectQueue],
  );
  const filteredReviewInbox = useMemo(
    () =>
      projectId
        ? reviewInbox.filter((item) => item.projectId === projectId)
        : reviewInbox,
    [projectId, reviewInbox],
  );
  const reviewOutcomeCount = filteredReviewInbox.reduce(
    (count, item) => count + item.outcomes.length,
    0,
  );
  const totalItems =
    totalSessionItems + pendingNewSessionQueueItems.length + reviewOutcomeCount;

  const pageLoading =
    loading ||
    reviewInboxLoading ||
    (totalSessionItems === 0 &&
      pendingNewSessionQueueItems.length === 0 &&
      supportsProjectQueue &&
      projectQueues.loading);
  const isEmpty = totalItems === 0 && !pageLoading && !overview?.partial;

  const drafts = useDraftSessionIds();

  // Build project options for FilterDropdown
  const projectOptions: FilterOption<string>[] = projects
    ? [
        { value: "", label: t("inboxAllProjects") },
        ...projects.map((p) => ({ value: p.id, label: p.name })),
      ]
    : [];

  const handleProjectSelect = (selected: string[]) => {
    const value = selected[0] ?? "";
    onProjectChange?.(value === "" ? undefined : value);
  };

  const startNewSession = () => {
    const query = projectId
      ? `?projectId=${encodeURIComponent(projectId)}`
      : "";
    navigate(`${basePath}/new-session${query}`);
  };

  return (
    <main className="page-scroll-container">
      <div className={`page-content-inner ${styles.root}`}>
        <NowSummary
          overview={overview}
          projectId={projectId}
          counts={{
            needsYou: overview?.counts.needsYou ?? needsAttention.length,
            running:
              (overview?.counts.running ?? active.length) +
              pendingNewSessionQueueItems.length,
            unread: overview?.counts.unread ?? unread.length,
          }}
          showGlance={!pageLoading && !error && !isEmpty}
          onJump={jumpToTier}
          action={
            <IconButton
              label={refreshing ? t("inboxRefreshing") : t("inboxRefresh")}
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              <svg
                className={refreshing ? styles.refreshSpinner : ""}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </IconButton>
          }
          filters={
            <>
              {projects && projects.length > 0 && (
                <FilterDropdown
                  label={t("inboxFilterProject")}
                  options={projectOptions}
                  selected={projectId ? [projectId] : []}
                  onChange={handleProjectSelect}
                  multiSelect={false}
                  placeholder={t("inboxAllProjects")}
                />
              )}
              <SessionAsyncQuestionsButton
                projectId={projectId}
                basePath={basePath}
              />
            </>
          }
        />

        {pageLoading && <LoadingState label={t("inboxLoading")} />}

        {error && (
          <p className="error">{t("inboxError", { message: error.message })}</p>
        )}

        {!pageLoading && !error && isEmpty && (
          <EmptyState
            title={t("inboxEmptyTitle")}
            hint={
              projectId
                ? t("inboxEmptyDescriptionProject")
                : t("inboxEmptyDescription")
            }
            action={
              <Button variant="primary" onClick={startNewSession}>
                {t("nowStartSession")}
              </Button>
            }
          />
        )}

        {!pageLoading && !error && !isEmpty && (
          <div className={styles.tiers} {...overview?.handlers}>
            {filteredReviewInbox.length > 0 && (
              <ReviewOutcomeSection
                items={filteredReviewInbox}
                basePath={basePath}
                hideProjectName={!!projectId}
              />
            )}
            {TIER_CONFIGS.filter(
              (config) => !overview || config.key !== "unread",
            ).map((originalConfig) => {
              const config =
                overview && originalConfig.key === "recentActivity"
                  ? {
                      ...originalConfig,
                      titleKey: "sessionOverviewRecent" as const,
                    }
                  : originalConfig;
              return (
                <InboxSection
                  key={config.key}
                  config={config}
                  items={tierData[config.key]}
                  projectQueueItems={
                    config.key === "active" ? pendingNewSessionQueueItems : []
                  }
                  projectNameById={projectNameById}
                  hideProjectName={!!projectId}
                  basePath={basePath}
                  drafts={drafts}
                  projectQueuedSessionIds={projectQueuedSessionIds}
                  publicShareCreationReady={publicShareCreationReady}
                  publicShareManagementAvailable={
                    publicShareManagementAvailable
                  }
                />
              );
            })}
            {overview && (
              <Link
                to={`${basePath}/sessions${projectId ? `?${new URLSearchParams({ project: projectId })}` : ""}`}
              >
                {t("sessionOverviewViewAll")}
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
