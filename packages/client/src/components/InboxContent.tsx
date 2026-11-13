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
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { type InboxItem, useInboxContext } from "../contexts/InboxContext";
import { useProjectQueues } from "../hooks/useProjectQueues";
import { usePublicShareStatus } from "../hooks/usePublicShareStatus";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useServerSettings } from "../hooks/useServerSettings";
import { useVersion } from "../hooks/useVersion";
import type { SessionOverviewData } from "../hooks/useSessionOverview";
import { useI18n } from "../i18n";
import {
  useDraftSessionIds,
  useProjectQueuedSessionIds,
} from "../lib/clientSummaryStore";
import { activityBus } from "../lib/activityBus";
import { serverSupportsProjectQueue } from "../lib/projectQueueVisibility";
import type { Project } from "../types";
import { Button } from "./garden/Button";
import { EmptyState } from "./garden/EmptyState";
import { ErrorState } from "./garden/ErrorState";
import { LoadingState } from "./garden/LoadingState";
import { Spinner } from "./garden/Spinner";
import styles from "./InboxContent.module.css";
import { InboxSection, type InboxRowContext } from "./now/InboxSection";
import { isPendingNewSessionProjectQueueItem } from "./now/InboxQueueItem";
import {
  buildInboxSections,
  type InboxFilter,
  type InboxTiers,
  needsBreakdown,
} from "./now/inboxSections";
import { NowSummary } from "./now/NowSummary";
import { OverviewToolbar } from "./now/OverviewToolbar";
import { QuickStart } from "./now/QuickStart";
import { ReviewOutcomes } from "./now/ReviewOutcomes";
import { TriageBanner, TriageEntryButton } from "./now/TriageEntry";
import { PageIntro } from "./shell/PageIntro";
import { pageWidthClass } from "./shell/pageWidth";

const EMPTY_PROJECT_QUEUE_PROJECT_IDS: readonly string[] = [];
const EMPTY_PROJECT_QUEUE_SESSION_IDS: ReadonlySet<string> = new Set();
const EMPTY_ITEMS: InboxItem[] = [];
const NOTE_SPINNER_SIZE = 12;

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
    } satisfies InboxTiers,
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

/** Everything the page shows, gathered from the feeds it reads. */
function useInboxModel({ overview, projectId, projects }: InboxContentProps) {
  const basePath = useRemoteBasePath();
  const share = usePublicShareFlags();
  const review = useReviewInbox(share.reviewInboxSupported);
  const tierState = useInboxTiers(overview, projectId);
  const queue = useInboxQueue(projectId, projects, tierState.all);
  const projectNameById = useProjectNames(projects, tierState.all);
  const drafts = useDraftSessionIds();
  const reviewItems = useMemo(
    () =>
      projectId
        ? review.items.filter((item) => item.projectId === projectId)
        : review.items,
    [projectId, review.items],
  );
  const rowContext: InboxRowContext = {
    projectNameById,
    hideProjectName: !!projectId,
    basePath,
    projectId,
    drafts,
    projectQueuedSessionIds: queue.queuedSessionIds,
    publicShareCreationReady: share.creationReady,
    publicShareManagementAvailable: share.managementAvailable,
  };
  return { basePath, review, reviewItems, tierState, queue, rowContext };
}

type InboxModel = ReturnType<typeof useInboxModel>;

function inboxCounts(model: InboxModel, overview?: SessionOverviewData) {
  const { tiers } = model.tierState;
  return {
    needsYou: overview?.counts.needsYou ?? tiers.needsAttention.length,
    running:
      (overview?.counts.running ?? tiers.active.length) +
      model.queue.pending.length,
    unread: overview?.counts.unread ?? tiers.unread.length,
    queued: model.queue.queuedCount,
  };
}

function pageState(model: InboxModel, overview?: SessionOverviewData) {
  const { tierState, queue, review, reviewItems } = model;
  const reviewOutcomeCount = reviewItems.reduce(
    (count, item) => count + item.outcomes.length,
    0,
  );
  const totalItems =
    tierState.all.length + queue.pending.length + reviewOutcomeCount;
  const loading =
    tierState.loading ||
    review.loading ||
    (tierState.all.length === 0 &&
      queue.pending.length === 0 &&
      queue.supported &&
      queue.loading);
  return {
    loading,
    empty: totalItems === 0 && !loading && !overview?.partial,
  };
}

/** Sections in the main column; review outcomes and quick start beside. */
function InboxColumns({
  model,
  overview,
  projects,
  filter,
}: {
  model: InboxModel;
  overview?: SessionOverviewData;
  projects?: Project[];
  filter: InboxFilter | null;
}) {
  const { t } = useI18n();
  const { rowContext, reviewItems, tierState, queue } = model;
  const sections = buildInboxSections(
    {
      tiers: tierState.tiers,
      pending: queue.pending,
      queuedSessionIds: queue.queuedSessionIds,
      overview: !!overview,
    },
    filter,
  ).filter(
    (section) =>
      filter !== null || section.items.length + section.queueItems.length > 0,
  );
  const showAside = reviewItems.length > 0 || (projects?.length ?? 0) > 0;
  return (
    <div className={styles.columns} {...overview?.handlers}>
      <div className={styles.main}>
        {sections.map((section) => (
          <InboxSection
            key={section.key}
            model={section}
            context={rowContext}
          />
        ))}
      </div>
      {showAside && (
        <aside className={styles.aside} aria-label={t("inboxAsideLabel")}>
          {reviewItems.length > 0 && (
            <ReviewOutcomes
              items={reviewItems}
              basePath={rowContext.basePath}
              hideProjectName={rowContext.hideProjectName}
            />
          )}
          {!rowContext.projectId && projects && (
            <QuickStart projects={projects} basePath={rowContext.basePath} />
          )}
        </aside>
      )}
    </div>
  );
}

function useInboxRefresh(model: InboxModel, overview?: SessionOverviewData) {
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        model.tierState.refresh(),
        overview?.refresh(),
        model.review.load().catch(() => {
          // The review feed is optional; retain its last accepted cards.
        }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  return { refreshing, refresh: () => void refresh() };
}

function InboxEmpty({ projectId }: { projectId?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const basePath = useRemoteBasePath();
  const startNewSession = () => {
    const query = projectId
      ? `?projectId=${encodeURIComponent(projectId)}`
      : "";
    navigate(`${basePath}/new-session${query}`);
  };
  return (
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
  );
}

interface InboxBodyProps {
  model: InboxModel;
  props: InboxContentProps;
  onRetry: () => void;
}

/** Loading, error, status blocks and sections under the intro. */
function InboxBody({ model, props, onRetry }: InboxBodyProps) {
  const { t } = useI18n();
  const { overview, projectId, projects } = props;
  const [filter, setFilter] = useState<InboxFilter | null>(null);
  const { tierState } = model;
  const state = pageState(model, overview);
  const counts = inboxCounts(model, overview);
  if (state.loading) {
    return (
      <div className={styles.loading}>
        <LoadingState label={t("inboxLoading")} variant="cards" />
        <LoadingState label={t("inboxLoading")} variant="list" />
      </div>
    );
  }
  if (tierState.error) {
    return (
      <ErrorState
        tag={t("errorTag")}
        message={t("inboxError", { message: tierState.error.message })}
        onRetry={onRetry}
        retryLabel={t("retry")}
      />
    );
  }
  return (
    <>
      <NowSummary
        counts={counts}
        needs={needsBreakdown(tierState.tiers.needsAttention)}
        partial={overview?.partial ?? false}
        filter={filter}
        onFilterChange={setFilter}
      />
      <TriageBanner
        count={counts.needsYou}
        basePath={model.basePath}
        projectId={projectId}
      />
      <PartialNote overview={overview} />
      {state.empty ? (
        <InboxEmpty projectId={projectId} />
      ) : (
        <InboxColumns
          model={model}
          overview={overview}
          projects={projects}
          filter={filter}
        />
      )}
    </>
  );
}

/**
 * The Inbox: status blocks that filter the page, then needs-you, running and
 * recent sections, with review outcomes and quick start in an aside. Data
 * comes from the overview model, or the legacy inbox feed when absent.
 */
export function InboxContent(props: InboxContentProps) {
  const { projectId, projects, onProjectChange, overview } = props;
  const { t } = useI18n();
  const model = useInboxModel(props);
  const { basePath, tierState } = model;
  const { refreshing, refresh } = useInboxRefresh(model, overview);
  const needsYou =
    overview?.counts.needsYou ?? tierState.tiers.needsAttention.length;
  const showTriage = !tierState.loading && !tierState.error;
  return (
    <main className="page-scroll-container">
      <div className={`page-content-inner ${pageWidthClass("wide")}`}>
        <PageIntro
          eyebrow={props.eyebrow}
          title={props.title ?? t("shellNavInbox")}
          lede={props.lede}
          actions={
            showTriage ? (
              <TriageEntryButton
                count={needsYou}
                basePath={basePath}
                projectId={projectId}
              />
            ) : undefined
          }
          filters={
            <OverviewToolbar
              projects={projects}
              projectId={projectId}
              onProjectChange={onProjectChange}
              basePath={basePath}
              refreshing={refreshing}
              refreshDisabled={refreshing || tierState.loading}
              onRefresh={refresh}
            />
          }
        />
        <InboxBody model={model} props={props} onRetry={refresh} />
      </div>
    </main>
  );
}
