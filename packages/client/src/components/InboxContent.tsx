import {
  GIT_SOURCE_REVIEW_SUBMISSIONS_CAPABILITY,
  PUBLIC_SHARE_MANAGEMENT_CAPABILITY,
  type ReviewInboxItem,
  serverHasCapability,
} from "@vibeallday/shared";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
import { Button } from "./garden/Button";
import { Card, CardHeader } from "./garden/Card";
import { EmptyState } from "./garden/EmptyState";
import { ErrorState } from "./garden/ErrorState";
import { ChevronRightIcon } from "./garden/icons";
import { LoadingState } from "./garden/LoadingState";
import { Spinner } from "./garden/Spinner";
import styles from "./InboxContent.module.css";
import {
  InboxQueueItem,
  isPendingNewSessionProjectQueueItem,
  type PendingNewSessionProjectQueueItem,
} from "./now/InboxQueueItem";
import { type NowJumpTarget, NowSummary } from "./now/NowSummary";
import { OverviewToolbar } from "./now/OverviewToolbar";
import { ReviewOutcomes } from "./now/ReviewOutcomes";
import { PageIntro } from "./shell/PageIntro";
import { pageWidthClass } from "./shell/pageWidth";
import { SessionListItem } from "./SessionListItem";

const EMPTY_PROJECT_QUEUE_PROJECT_IDS: readonly string[] = [];
const EMPTY_PROJECT_QUEUE_SESSION_IDS: ReadonlySet<string> = new Set();
const EMPTY_ITEMS: InboxItem[] = [];
const CHEVRON_SIZE = 14;
const NOTE_SPINNER_SIZE = 12;

type TierKey = NowJumpTarget | "recentActivity";

/**
 * "Now" tiers in reading order. Empty tiers are not rendered; the two
 * unread windows from the inbox feed share one Unread tier.
 */
interface TierConfig {
  key: TierKey;
  titleKey: MessageKey;
  getBadge?: (
    item: InboxItem,
  ) => { label: MessageKey; className: string } | null;
}

const TIER_CONFIGS: TierConfig[] = [
  {
    key: "needsAttention",
    titleKey: "inboxTierNeedsAttention",
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
  { key: "active", titleKey: "inboxTierActive" },
  { key: "unread", titleKey: "inboxTierUnread" },
  { key: "recentActivity", titleKey: "inboxTierRecentActivity" },
];

/** Id of the tier card a summary jump scrolls to; it holds the count. */
function tierHeadingId(key: TierKey): string {
  return `now-tier-${key}`;
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

function getInboxRowActivity(
  item: InboxItem,
  tierKey: string,
): InboxItem["activity"] {
  if (tierKey === "active" && item.activityInferredFromInboxTier) {
    return undefined;
  }
  return item.activity;
}

function InboxRow({
  item,
  config,
  props,
}: {
  item: InboxItem;
  config: TierConfig;
  props: InboxSectionProps;
}) {
  const { t } = useI18n();
  const badge = config.getBadge?.(item);
  return (
    <SessionListItem
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
      activity={getInboxRowActivity(item, config.key)}
      pendingInputType={item.pendingInputType}
      mode="card"
      openNonHumanUserTurn
      showProjectName={!props.hideProjectName}
      showTimestamp
      showStatusBadge={false}
      showActivityIndicator={config.key === "active"}
      customBadge={badge ? { ...badge, label: t(badge.label) } : null}
      basePath={props.basePath}
      hasDraft={props.drafts.has(item.sessionId)}
      hasProjectQueue={props.projectQueuedSessionIds.has(item.sessionId)}
      publicShareCreationReady={props.publicShareCreationReady}
      publicShareManagementAvailable={props.publicShareManagementAvailable}
    />
  );
}

/** One tier as a flush card: serif title, mono count, dashed rows. */
function InboxSection(props: InboxSectionProps) {
  const { t } = useI18n();
  const { config, items, projectQueueItems = [] } = props;
  const sectionCount = items.length + projectQueueItems.length;
  if (sectionCount === 0) return null;
  const headingId = tierHeadingId(config.key);

  return (
    <Card
      as="section"
      flush
      id={headingId}
      className={styles.section}
      aria-labelledby={`${headingId}-title`}
    >
      <CardHeader
        title={t(config.titleKey)}
        titleId={`${headingId}-title`}
        meta={sectionCount}
      />
      <ul className={`sessions-list ${styles.collection}`}>
        {projectQueueItems.map((item) => (
          <InboxQueueItem
            key={item.id}
            item={item}
            projectName={
              props.projectNameById.get(item.projectId) ??
              t("projectQueueUnknownProject")
            }
            hideProjectName={props.hideProjectName}
            basePath={props.basePath}
          />
        ))}
        {items.map((item) => (
          <InboxRow
            key={item.sessionId}
            item={item}
            config={config}
            props={props}
          />
        ))}
      </ul>
    </Card>
  );
}

type TierProps = Omit<
  InboxSectionProps,
  "config" | "items" | "projectQueueItems"
>;

function tierConfigs(overview: SessionOverviewData | undefined): TierConfig[] {
  return TIER_CONFIGS.filter(
    (config) => !overview || config.key !== "unread",
  ).map((config) =>
    overview && config.key === "recentActivity"
      ? { ...config, titleKey: "sessionOverviewRecent" as const }
      : config,
  );
}

/** Review outcomes, then one card per non-empty tier, then "View all". */
function TierList({
  overview,
  tiers,
  pending,
  reviewItems,
  projectId,
  tierProps,
}: {
  overview?: SessionOverviewData;
  tiers: Record<TierKey, InboxItem[]>;
  pending: PendingNewSessionProjectQueueItem[];
  reviewItems: ReviewInboxItem[];
  projectId?: string;
  tierProps: TierProps;
}) {
  const { t } = useI18n();
  const basePath = tierProps.basePath ?? "";
  const scope = projectId
    ? `?${new URLSearchParams({ project: projectId })}`
    : "";
  return (
    <div className={styles.tiers} {...overview?.handlers}>
      {reviewItems.length > 0 && (
        <ReviewOutcomes
          items={reviewItems}
          basePath={basePath}
          hideProjectName={!!projectId}
        />
      )}
      {tierConfigs(overview).map((config) => (
        <InboxSection
          key={config.key}
          config={config}
          items={tiers[config.key]}
          projectQueueItems={config.key === "active" ? pending : []}
          {...tierProps}
        />
      ))}
      {overview && (
        <Link className={styles.viewAll} to={`${basePath}/sessions${scope}`}>
          {t("sessionOverviewViewAll")}
          <ChevronRightIcon size={CHEVRON_SIZE} />
        </Link>
      )}
    </div>
  );
}

export interface InboxContentProps {
  overview?: SessionOverviewData;
  /** Optional projectId to filter inbox to a single project */
  projectId?: string;
  /** List of projects for the filter dropdown */
  projects?: Project[];
  /** Callback when project filter changes */
  onProjectChange?: (projectId: string | undefined) => void;
  /** Page title drawn by the intro block; defaults to "Overview". */
  title?: string;
  /** Mono context above the title, e.g. the filtered project. */
  eyebrow?: ReactNode[];
  /** One sentence under the title. */
  lede?: string;
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

/** The optional source-review feed; failures keep the last accepted rows. */
function useReviewInbox(supported: boolean) {
  const [items, setItems] = useState<ReviewInboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!supported) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await api.listReviewInbox();
      setItems(result.items);
    } finally {
      setLoading(false);
    }
  }, [supported]);

  useEffect(() => {
    void load().catch(() => {
      // The ordinary Inbox remains usable if the optional feed fails.
    });
    if (!supported) return;
    return activityBus.on("review-response-changed", () => {
      void load().catch(() => {
        // Preserve the last accepted outcome cards on transient failures.
      });
    });
  }, [load, supported]);
  return { items, loading, load };
}

/** Tier rows from the overview model, or the legacy inbox feed. */
function useInboxTiers(
  overview: SessionOverviewData | undefined,
  projectId: string | undefined,
) {
  const inbox = useInboxContext();
  const needsAttention =
    overview?.needsAttention ??
    filterByProject(inbox.needsAttention, projectId);
  const active = overview?.active ?? filterByProject(inbox.active, projectId);
  const recentActivity =
    overview?.recentActivity ??
    filterByProject(inbox.recentActivity, projectId);
  const unread8h = overview
    ? EMPTY_ITEMS
    : filterByProject(inbox.unread8h, projectId);
  const unread24h = overview
    ? EMPTY_ITEMS
    : filterByProject(inbox.unread24h, projectId);
  const all = useMemo(
    () => [
      ...needsAttention,
      ...active,
      ...recentActivity,
      ...unread8h,
      ...unread24h,
    ],
    [needsAttention, active, recentActivity, unread8h, unread24h],
  );
  return {
    tiers: {
      needsAttention,
      active,
      unread: [...unread8h, ...unread24h],
      recentActivity,
    } satisfies Record<TierKey, InboxItem[]>,
    all,
    loading: overview?.loading ?? inbox.loading,
    error: overview?.error ?? (overview ? null : inbox.error),
    refresh: inbox.refresh,
  };
}

function useProjectNames(
  projects: Project[] | undefined,
  items: readonly InboxItem[],
) {
  return useMemo(() => {
    const names = new Map(
      (projects ?? []).map((project) => [project.id, project.name]),
    );
    for (const item of items) {
      if (!names.has(item.projectId)) {
        names.set(item.projectId, item.projectName);
      }
    }
    return names;
  }, [projects, items]);
}

/**
 * Keep the queue feed mounted for known inbox projects. Badge rendering reads
 * from the shared client summary store, while new-session queue items render
 * as pending Running rows because they have no session yet.
 */
function useInboxQueue(
  projectId: string | undefined,
  projects: Project[] | undefined,
  items: readonly InboxItem[],
) {
  const { version } = useVersion();
  const supported = serverSupportsProjectQueue(version);
  const visibleIds = useMemo(
    () => [...new Set(items.map((item) => item.projectId).filter(Boolean))],
    [items],
  );
  const feedIds = useMemo(() => {
    if (projectId) return [projectId];
    if (projects && projects.length > 0) {
      return [...new Set(projects.map((project) => project.id))];
    }
    return visibleIds;
  }, [projectId, projects, visibleIds]);
  const queues = useProjectQueues(
    supported ? feedIds : EMPTY_PROJECT_QUEUE_PROJECT_IDS,
  );
  const queuedIds = useProjectQueuedSessionIds(
    supported ? visibleIds : EMPTY_PROJECT_QUEUE_PROJECT_IDS,
  );
  const pending = useMemo(
    () =>
      supported ? queues.items.filter(isPendingNewSessionProjectQueueItem) : [],
    [queues.items, supported],
  );
  return {
    supported,
    loading: queues.loading,
    queuedCount: supported ? queues.items.length : undefined,
    queuedSessionIds: supported ? queuedIds : EMPTY_PROJECT_QUEUE_SESSION_IDS,
    pending,
  };
}

function usePublicShareFlags() {
  const { settings } = useServerSettings();
  const { version } = useVersion();
  const { status } = usePublicShareStatus({
    poll: settings?.publicSharesEnabled ?? false,
  });
  return {
    creationReady: status?.canCreate ?? false,
    managementAvailable: serverHasCapability(
      version,
      PUBLIC_SHARE_MANAGEMENT_CAPABILITY,
    ),
    reviewInboxSupported:
      serverHasCapability(version, GIT_SOURCE_REVIEW_SUBMISSIONS_CAPABILITY) &&
      (settings?.sourceReviewSubmissionsEnabled ?? false),
  };
}

function jumpToTier(target: NowJumpTarget) {
  const reduceMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  document.getElementById(tierHeadingId(target))?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

function PartialNote({ overview }: { overview?: SessionOverviewData }) {
  const { t } = useI18n();
  if (!overview?.partial) return null;
  return (
    <p className={styles.note} role="status">
      {overview.error ? null : (
        <Spinner size={NOTE_SPINNER_SIZE} tone="muted" />
      )}
      {t(
        overview.error ? "sessionOverviewIncomplete" : "sessionOverviewLoading",
      )}
    </p>
  );
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
  title,
  eyebrow,
  lede,
}: InboxContentProps) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const navigate = useNavigate();
  const share = usePublicShareFlags();
  const review = useReviewInbox(share.reviewInboxSupported);
  const { tiers, all, loading, error, refresh } = useInboxTiers(
    overview,
    projectId,
  );
  const queue = useInboxQueue(projectId, projects, all);
  const projectNameById = useProjectNames(projects, all);
  const drafts = useDraftSessionIds();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refresh(),
        overview?.refresh(),
        review.load().catch(() => {
          // The review feed is optional; retain its last accepted cards.
        }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredReviewInbox = useMemo(
    () =>
      projectId
        ? review.items.filter((item) => item.projectId === projectId)
        : review.items,
    [projectId, review.items],
  );
  const reviewOutcomeCount = filteredReviewInbox.reduce(
    (count, item) => count + item.outcomes.length,
    0,
  );
  const totalItems = all.length + queue.pending.length + reviewOutcomeCount;
  const pageLoading =
    loading ||
    review.loading ||
    (all.length === 0 &&
      queue.pending.length === 0 &&
      queue.supported &&
      queue.loading);
  const isEmpty = totalItems === 0 && !pageLoading && !overview?.partial;

  const startNewSession = () => {
    const query = projectId
      ? `?projectId=${encodeURIComponent(projectId)}`
      : "";
    navigate(`${basePath}/new-session${query}`);
  };

  const tierProps: TierProps = {
    projectNameById,
    hideProjectName: !!projectId,
    basePath,
    drafts,
    projectQueuedSessionIds: queue.queuedSessionIds,
    publicShareCreationReady: share.creationReady,
    publicShareManagementAvailable: share.managementAvailable,
  };

  return (
    <main className="page-scroll-container">
      <div className={`page-content-inner ${pageWidthClass("wide")}`}>
        <PageIntro
          eyebrow={eyebrow}
          title={title ?? t("sessionOverview")}
          lede={lede}
          filters={
            <OverviewToolbar
              projects={projects}
              projectId={projectId}
              onProjectChange={onProjectChange}
              basePath={basePath}
              refreshing={refreshing}
              refreshDisabled={refreshing || loading}
              onRefresh={() => void handleRefresh()}
            />
          }
        />

        {pageLoading && (
          <div className={styles.tiers}>
            <LoadingState label={t("inboxLoading")} variant="cards" />
            <LoadingState label={t("inboxLoading")} variant="list" />
          </div>
        )}

        {error && (
          <ErrorState
            tag={t("errorTag")}
            message={t("inboxError", { message: error.message })}
            onRetry={() => void handleRefresh()}
            retryLabel={t("retry")}
          />
        )}

        {!pageLoading && !error && (
          <>
            <NowSummary
              counts={{
                needsYou:
                  overview?.counts.needsYou ?? tiers.needsAttention.length,
                running:
                  (overview?.counts.running ?? tiers.active.length) +
                  queue.pending.length,
                unread: overview?.counts.unread ?? tiers.unread.length,
                queued: queue.queuedCount,
              }}
              partial={overview?.partial ?? false}
              projectId={projectId}
              unreadOnPage={!overview}
              onJump={jumpToTier}
            />
            <PartialNote overview={overview} />
          </>
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
          <TierList
            overview={overview}
            tiers={tiers}
            pending={queue.pending}
            reviewItems={filteredReviewInbox}
            projectId={projectId}
            tierProps={tierProps}
          />
        )}
      </div>
    </main>
  );
}
