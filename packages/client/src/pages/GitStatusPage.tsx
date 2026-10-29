import { EmptyState } from "../components/garden/EmptyState";
import { ErrorState } from "../components/garden/ErrorState";
import { FolderIcon, GitBranchIcon } from "../components/garden/icons";
import { Notice } from "../components/garden/Notice";
import { LoadingState } from "../components/garden/LoadingState";
import type {
  GitFileChange,
  GitIntegrationOptionReason,
  GitIntegrationOptionsResult,
  GitStatusInfo,
  GitUntrackedFileListResult,
  GitWorkingTreeFile,
} from "@vibeallday/shared";
import {
  PROJECT_CODE_NAMES_CAPABILITY,
  GIT_DIRTY_FILE_EDITOR_CAPABILITY,
  GIT_INCLUSIVE_TO_HEAD_CAPABILITY,
  GIT_LIVE_WORKTREE_SETTING_CAPABILITY,
  GIT_INCOMING_COMMITS_CAPABILITY,
  GIT_SOURCE_REVIEW_CAPABILITY,
  GIT_SOURCE_REVIEW_PROJECTIONS_CAPABILITY,
  GIT_SOURCE_REVIEW_SUBMISSIONS_CAPABILITY,
  GIT_STATUS_ENHANCED_CAPABILITY,
  GIT_STATUS_INTEGRATION_OPTIONS_CAPABILITY,
  GIT_STATUS_PULL_CAPABILITY,
  GIT_STATUS_PUSH_CAPABILITY,
  GIT_STATUS_REMOTE_CHECK_CAPABILITY,
  GIT_WORKING_TREE_COMPLETE_SCAN_CAPABILITY,
  GIT_WORKING_TREE_FILES_CAPABILITY,
  GIT_WORKING_TREE_SECTIONS_CAPABILITY,
  serverHasCapability,
} from "@vibeallday/shared";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { GitActionFeedback } from "../components/GitActionFeedback";
import { GlossaryProjectBoundary } from "../contexts/GlossaryContext";
import { SourceReviewDefaultSessionContext } from "../contexts/SourceReviewDefaultSessionContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useDocumentAttention } from "../hooks/useDocumentAttention";
import { type GitActionState, useGitActions } from "../hooks/useGitActions";
import { useGitStatus } from "../hooks/useGitStatus";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useProjectReviewComments } from "../hooks/useProjectReviewComments";
import { useProject, useProjects } from "../hooks/useProjects";
import {
  ProjectWorktreePauseContext,
  useProjectWorktree,
} from "../hooks/useProjectWorktree";
import {
  resolvePreferredProjectId,
  setRecentProjectId,
} from "../hooks/useRecentProject";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useServerSettings } from "../hooks/useServerSettings";
import { useSourceControlCleanLanding } from "../hooks/useSourceControlCleanLanding";
import { useVersion } from "../hooks/useVersion";
import { type TranslationFn, useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import { toBrowserAppHref } from "../lib/appHref";
import {
  type ClientSummarySourceKey,
  useClientSummarySourceKey,
} from "../lib/clientSummaryStore";
import {
  patchRouteRetention,
  type RouteRetentionKeyInput,
  readRouteRetention,
  subscribeRouteRetention,
} from "../lib/routeRetention";
import { parseSourceControlNavigationState } from "../lib/sourceControlNavigationState";
import { BlameBrowser } from "./BlameBrowser";
import { CommitBrowser } from "./CommitBrowser";
import styles from "./GitStatusPage.module.css";
import { ReviewCommentsPanel } from "./ReviewCommentsPanel";
import { ReviewSubmissionsPanel } from "./ReviewSubmissionsPanel";
import { ReviewSubmitModal } from "./ReviewSubmitModal";
import { SourceHeaderControls } from "./SourceActionControls";
import { SourceControlIntro } from "./SourceControlIntro";
import { useReturnToSession } from "./useReturnToSession";
import { useSourceTab } from "./useSourceTab";
import { WorkingTreeBrowser } from "./WorkingTreeBrowser";

interface SourceControlRouteState {
  pageScrollTop?: number;
}

const SOURCE_CONTROL_ROUTE_TTL_MS = 5 * 60 * 1000;

/** URL keys that name a selection inside a mode, cleared when the mode changes. */
const SOURCE_SELECTION_PARAMS = [
  "tab",
  "history",
  "rev",
  "commitFile",
  "blame",
  "worktreeFile",
  "bf",
  "submission",
] as const;

function mergeLiveWorktreeStatus(
  status: GitStatusInfo | null,
  files: readonly GitWorkingTreeFile[],
): GitStatusInfo | null {
  if (!status) return null;
  const lastEditors = new Map(
    status.files.flatMap((file) =>
      file.lastEditor ? [[file.path, file.lastEditor] as const] : [],
    ),
  );
  const changes: GitFileChange[] = [];
  for (const file of files) {
    for (const change of file.worktreeChanges ?? []) {
      const lastEditor = change.lastEditor ?? lastEditors.get(file.path);
      changes.push({
        path: file.path,
        ...change,
        ...(lastEditor ? { lastEditor } : {}),
      });
    }
  }
  return { ...status, files: changes, isClean: changes.length === 0 };
}

/**
 * Navigation from the identity header's branch name to the commit that branch
 * points at. The href is a real standalone URL so middle-click and "open in new
 * tab" work; plain left-click stays in this tab through the router.
 */
function useHeadCommitLink(
  projectId: string | undefined,
  status: GitStatusInfo | null | undefined,
  enabled: boolean,
): { headCommitHref?: string; onOpenHeadCommit?: () => void } {
  const basePath = useRemoteBasePath();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const headSha = status?.recentCommits?.[0]?.hash;
  const active = enabled && headSha !== undefined && projectId !== undefined;
  const headCommitHref = useMemo(() => {
    if (!active) return undefined;
    const params = new URLSearchParams(searchParams);
    params.set("projectId", projectId);
    for (const key of SOURCE_SELECTION_PARAMS) params.delete(key);
    params.set("rev", headSha);
    return toBrowserAppHref(`${basePath}/git-status?${params.toString()}`);
  }, [active, basePath, headSha, projectId, searchParams]);
  const onOpenHeadCommit = useCallback(() => {
    if (!active) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        for (const key of SOURCE_SELECTION_PARAMS) params.delete(key);
        params.set("rev", headSha);
        return params;
      },
      { state: location.state },
    );
  }, [active, headSha, location.state, setSearchParams]);
  if (!active) return {};
  return { headCommitHref, onOpenHeadCommit };
}

function getSourceControlRouteRetentionKey(
  sourceKey: ClientSummarySourceKey,
  projectId: string,
): RouteRetentionKeyInput {
  return {
    sourceKey,
    routeId: "git-status",
    projectId,
    queryParams: { projectId },
  };
}

function updateSourceControlRouteState(
  key: RouteRetentionKeyInput,
  update: (current: SourceControlRouteState) => SourceControlRouteState,
): void {
  patchRouteRetention<SourceControlRouteState>(
    key,
    (current) => update(current ?? {}),
    { ttlMs: SOURCE_CONTROL_ROUTE_TTL_MS },
  );
}

function readSourceControlRouteState(
  key: RouteRetentionKeyInput,
): SourceControlRouteState | null {
  return readRouteRetention<SourceControlRouteState>(key, {
    touch: false,
    recordDiagnostics: false,
  });
}

function useSourceControlRouteState(
  key: RouteRetentionKeyInput | null,
): SourceControlRouteState | null {
  return useSyncExternalStore(
    subscribeRouteRetention,
    () => (key ? readSourceControlRouteState(key) : null),
    () => null,
  );
}

export function GitStatusPage() {
  const { t } = useI18n();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");
  const sourceKey = useClientSummarySourceKey();
  const { openSidebar, isWideScreen } = useNavigationLayout();
  const returnToSession = useReturnToSession();
  const pageScrollRef = useRef<HTMLElement | null>(null);
  const [worktreePaused, setWorktreePaused] = useState(false);
  const documentAttentive = useDocumentAttention();
  const worktreeLeasePaused = worktreePaused || !documentAttentive;

  const {
    projects,
    loading: projectsLoading,
    complete: projectsComplete,
  } = useProjects();
  const effectiveProjectId =
    projectId ||
    resolvePreferredProjectId(projects, undefined, projectsComplete) ||
    undefined;
  const { project } = useProject(effectiveProjectId);
  const {
    version,
    loading: versionLoading,
    error: versionError,
  } = useVersion();
  const { settings: serverSettings } = useServerSettings();
  const reviewsEnabled =
    serverHasCapability(version, GIT_SOURCE_REVIEW_SUBMISSIONS_CAPABILITY) &&
    (serverSettings?.sourceReviewSubmissionsEnabled ?? false);
  const { setTab: setHeaderTab } = useSourceTab(reviewsEnabled);
  const supportsEnhancedGitStatus = serverHasCapability(
    version,
    GIT_STATUS_ENHANCED_CAPABILITY,
  );
  const supportsProjectCodeNames = serverHasCapability(
    version,
    PROJECT_CODE_NAMES_CAPABILITY,
  );
  const supportsLastEditor = serverHasCapability(
    version,
    GIT_DIRTY_FILE_EDITOR_CAPABILITY,
  );
  const supportsSourceReview = serverHasCapability(
    version,
    GIT_SOURCE_REVIEW_CAPABILITY,
  );
  const supportsSourceReviewProjections = serverHasCapability(
    version,
    GIT_SOURCE_REVIEW_PROJECTIONS_CAPABILITY,
  );
  const supportsInclusiveToHead = serverHasCapability(
    version,
    GIT_INCLUSIVE_TO_HEAD_CAPABILITY,
  );
  const supportsWorkingTreeFiles = serverHasCapability(
    version,
    GIT_WORKING_TREE_FILES_CAPABILITY,
  );
  const supportsLiveWorktreeSetting = serverHasCapability(
    version,
    GIT_LIVE_WORKTREE_SETTING_CAPABILITY,
  );
  const supportsWorkingTreeSections =
    supportsLiveWorktreeSetting &&
    serverHasCapability(version, GIT_WORKING_TREE_SECTIONS_CAPABILITY);
  const supportsCompleteFilesystemScan =
    supportsWorkingTreeSections &&
    serverHasCapability(version, GIT_WORKING_TREE_COMPLETE_SCAN_CAPABILITY);
  const supportsIncomingCommits = serverHasCapability(
    version,
    GIT_INCOMING_COMMITS_CAPABILITY,
  );
  const supportsRemoteCheck = serverHasCapability(
    version,
    GIT_STATUS_REMOTE_CHECK_CAPABILITY,
  );
  const supportsPull = serverHasCapability(version, GIT_STATUS_PULL_CAPABILITY);
  const supportsPush = serverHasCapability(version, GIT_STATUS_PUSH_CAPABILITY);
  const supportsIntegrationOptions = serverHasCapability(
    version,
    GIT_STATUS_INTEGRATION_OPTIONS_CAPABILITY,
  );
  const {
    gitStatus: statusMetadata,
    untrackedFiles: legacyUntrackedFiles,
    untrackedLoading,
    untrackedError,
    loading: statusLoading,
    error: statusError,
    refetch,
  } = useGitStatus(supportsEnhancedGitStatus ? effectiveProjectId : undefined, {
    omitUntracked: supportsWorkingTreeSections,
    useUntrackedCache: supportsWorkingTreeFiles && !supportsWorkingTreeSections,
  });
  const liveWorktreeEnabled = Boolean(
    effectiveProjectId &&
      supportsWorkingTreeSections &&
      statusMetadata?.isGitRepo,
  );
  const liveWorktree = useProjectWorktree(
    effectiveProjectId ?? "",
    { tracked: true, untracked: true, ignored: false },
    liveWorktreeEnabled,
    worktreeLeasePaused,
  );
  const gitStatus = useMemo(
    () =>
      supportsWorkingTreeSections && liveWorktree.generation
        ? mergeLiveWorktreeStatus(statusMetadata, liveWorktree.files)
        : statusMetadata,
    [
      liveWorktree.files,
      liveWorktree.generation,
      statusMetadata,
      supportsWorkingTreeSections,
    ],
  );
  const untrackedFiles = supportsWorkingTreeSections
    ? null
    : legacyUntrackedFiles;
  const liveInventoryPending =
    liveWorktreeEnabled && liveWorktree.generation === null;
  const loading = statusLoading;
  const error = statusError;
  const reviewComments = useProjectReviewComments(
    supportsSourceReview ? effectiveProjectId : undefined,
  );
  const headCommitLink = useHeadCommitLink(
    effectiveProjectId,
    gitStatus,
    supportsSourceReview,
  );
  const { defaultSession: routeDefaultSession } = useMemo(
    () => parseSourceControlNavigationState(location.state),
    [location.state],
  );
  const defaultSession =
    routeDefaultSession?.projectId === effectiveProjectId
      ? (routeDefaultSession ?? null)
      : null;
  const [showReviewModal, setShowReviewModal] = useState(false);
  const routeRetentionKey = useMemo(
    () =>
      effectiveProjectId
        ? getSourceControlRouteRetentionKey(sourceKey, effectiveProjectId)
        : null,
    [effectiveProjectId, sourceKey],
  );
  const retainedRouteState = useSourceControlRouteState(routeRetentionKey);
  const gitActions = useGitActions({
    projectId: effectiveProjectId,
    status: gitStatus,
    routeRetentionKey,
    supportsRemoteCheck,
    supportsPull,
    supportsPush,
    supportsIntegrationOptions,
    onRefreshStatus: refetch,
    t,
  });

  useDocumentTitle(
    project?.name,
    supportsProjectCodeNames ? project?.codeName : undefined,
    t("gitStatusTitle"),
  );

  useLayoutEffect(() => {
    void gitStatus?.files.length;
    const scrollTop = retainedRouteState?.pageScrollTop;
    if (typeof scrollTop !== "number" || !pageScrollRef.current) {
      return;
    }
    pageScrollRef.current.scrollTop = scrollTop;
  }, [gitStatus?.files.length, retainedRouteState?.pageScrollTop]);

  useLayoutEffect(() => {
    return () => {
      if (!routeRetentionKey || !pageScrollRef.current) {
        return;
      }
      updateSourceControlRouteState(routeRetentionKey, (current) => ({
        ...current,
        pageScrollTop: pageScrollRef.current?.scrollTop ?? 0,
      }));
    };
  }, [routeRetentionKey]);

  useEffect(() => {
    if (effectiveProjectId && project) {
      setRecentProjectId(effectiveProjectId);
    }
  }, [effectiveProjectId, project]);

  const handleProjectChange = (newProjectId: string) => {
    setRecentProjectId(newProjectId);
    setSearchParams(
      { projectId: newProjectId },
      { replace: true, state: null },
    );
  };

  if (!effectiveProjectId && !projectsLoading && projects.length === 0) {
    return <EmptyState title={t("gitStatusNoProjects")} />;
  }

  const projectName = project?.name ?? t("gitStatusTitle");
  const intro = (
    <SourceControlIntro
      projectId={effectiveProjectId}
      projectName={project?.name}
      codeName={supportsProjectCodeNames ? project?.codeName : undefined}
      status={gitStatus}
      onProjectChange={handleProjectChange}
      supportsIncomingCommits={supportsIncomingCommits}
      onSelectChanges={
        supportsSourceReview ? () => setHeaderTab("changes") : undefined
      }
      {...headCommitLink}
      workbench={
        supportsSourceReview && effectiveProjectId
          ? {
              pendingCount: reviewComments.pending.length,
              reviewsEnabled,
              supportsWorkingTreeFiles,
              gitActions,
              worktreePaused,
              onToggleWorktreePaused: supportsWorkingTreeSections
                ? () => setWorktreePaused((paused) => !paused)
                : undefined,
            }
          : undefined
      }
      t={t}
    />
  );

  return (
    <MainContent
      isWideScreen={isWideScreen}
      innerClassName="source-control-main-content"
    >
      <PageHeader
        title={projectName}
        intro="content"
        breadcrumbs={[{ label: t("gitStatusTitle") }, { label: projectName }]}
        showBack={returnToSession !== undefined}
        onBack={returnToSession}
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />

      <main className="page-scroll-container" ref={pageScrollRef}>
        <div className="page-content-inner">
          {intro}
          {versionLoading || projectsLoading ? (
            <LoadingState label={t("gitStatusLoading")} variant="page" />
          ) : versionError ? (
            <ErrorState
              tag={t("errorTag")}
              message={`${t("gitStatusErrorPrefix")} ${versionError.message}`}
            />
          ) : !supportsEnhancedGitStatus ? (
            <GitStatusUpgradeRequired t={t} />
          ) : loading ? (
            <LoadingState label={t("gitStatusLoading")} variant="page" />
          ) : error ? (
            <ErrorState
              tag={t("errorTag")}
              message={`${t("gitStatusErrorPrefix")} ${error.message}`}
              onRetry={refetch}
              retryLabel={t("retry")}
            />
          ) : gitStatus &&
            !gitStatus.isGitRepo &&
            effectiveProjectId &&
            supportsWorkingTreeSections ? (
            <GlossaryProjectBoundary projectId={effectiveProjectId}>
              <ProjectWorktreePauseContext.Provider value={worktreeLeasePaused}>
                <div className="git-status">
                  <BlameBrowser
                    projectId={effectiveProjectId}
                    isWideScreen={isWideScreen}
                    status={gitStatus}
                    supportsWorkingTreeFiles={supportsWorkingTreeFiles}
                    supportsWorktreeSections
                    supportsCompleteFilesystemScan={
                      supportsCompleteFilesystemScan
                    }
                    t={t}
                  />
                </div>
              </ProjectWorktreePauseContext.Provider>
            </GlossaryProjectBoundary>
          ) : gitStatus && !gitStatus.isGitRepo ? (
            <EmptyState title={t("gitStatusNotRepo")} icon={<FolderIcon />} />
          ) : gitStatus && effectiveProjectId && supportsSourceReview ? (
            <GlossaryProjectBoundary projectId={effectiveProjectId}>
              <ProjectWorktreePauseContext.Provider value={worktreeLeasePaused}>
                <SourceReviewDefaultSessionContext.Provider
                  value={defaultSession}
                >
                  <GitStatusContent
                    key={`${sourceKey}:${effectiveProjectId}`}
                    status={gitStatus}
                    projectId={effectiveProjectId}
                    isWideScreen={isWideScreen}
                    supportsProjections={supportsSourceReviewProjections}
                    supportsInclusiveToHead={supportsInclusiveToHead}
                    supportsWorkingTreeFiles={supportsWorkingTreeFiles}
                    supportsWorkingTreeSections={supportsWorkingTreeSections}
                    supportsCompleteFilesystemScan={
                      supportsCompleteFilesystemScan
                    }
                    untrackedFiles={untrackedFiles}
                    untrackedLoading={untrackedLoading}
                    untrackedError={untrackedError}
                    inventoryPending={liveInventoryPending}
                    inventoryLoading={
                      liveInventoryPending && liveWorktree.loading
                    }
                    inventoryError={
                      liveInventoryPending ? liveWorktree.error : null
                    }
                    supportsLastEditor={supportsLastEditor}
                    gitActions={gitActions}
                    reviewComments={reviewComments}
                    reviewsEnabled={reviewsEnabled}
                    showReviewModal={showReviewModal}
                    onOpenReview={() => setShowReviewModal(true)}
                    onCloseReview={() => setShowReviewModal(false)}
                    t={t}
                  />
                </SourceReviewDefaultSessionContext.Provider>
              </ProjectWorktreePauseContext.Provider>
            </GlossaryProjectBoundary>
          ) : gitStatus && effectiveProjectId ? (
            <GitStatusCompatibilityContent
              key={`${sourceKey}:${effectiveProjectId}:compatibility`}
              gitActions={gitActions}
              t={t}
            />
          ) : null}
        </div>
      </main>
    </MainContent>
  );
}

function GitStatusUpgradeRequired({ t }: { t: TranslationFn }) {
  return (
    <EmptyState
      title={t("gitStatusUpgradeRequiredTitle")}
      hint={t("gitStatusUpgradeRequiredDescription")}
      icon={<GitBranchIcon />}
    />
  );
}

function GitStatusCompatibilityContent({
  gitActions,
  t,
}: {
  gitActions: GitActionState;
  t: TranslationFn;
}) {
  return (
    <div className="git-status git-status-compatibility">
      <div
        className={`source-control-action-row ${styles.compatibilityActions}`}
      >
        <SourceHeaderControls gitActions={gitActions} t={t} />
      </div>
      <GitActionNotices gitActions={gitActions} t={t} />
      <section className={styles.compatibilityNote}>
        <h2>{t("gitStatusCompatibilityTitle")}</h2>
        <Notice tone="warning">{t("gitStatusCompatibilityDescription")}</Notice>
      </section>
    </div>
  );
}

function GitStatusContent({
  status,
  projectId,
  isWideScreen,
  supportsProjections,
  supportsInclusiveToHead,
  supportsWorkingTreeFiles,
  supportsWorkingTreeSections,
  supportsCompleteFilesystemScan,
  untrackedFiles,
  untrackedLoading,
  untrackedError,
  inventoryPending,
  inventoryLoading,
  inventoryError,
  supportsLastEditor,
  gitActions,
  reviewComments,
  reviewsEnabled,
  showReviewModal,
  onOpenReview,
  onCloseReview,
  t,
}: {
  status: GitStatusInfo;
  projectId: string;
  isWideScreen: boolean;
  supportsProjections: boolean;
  supportsInclusiveToHead: boolean;
  supportsWorkingTreeFiles: boolean;
  supportsWorkingTreeSections: boolean;
  supportsCompleteFilesystemScan: boolean;
  untrackedFiles: GitUntrackedFileListResult | null;
  untrackedLoading: boolean;
  untrackedError: Error | null;
  inventoryPending: boolean;
  inventoryLoading: boolean;
  inventoryError: Error | null;
  supportsLastEditor: boolean;
  gitActions: GitActionState;
  reviewComments: ReturnType<typeof useProjectReviewComments>;
  reviewsEnabled: boolean;
  showReviewModal: boolean;
  onOpenReview: () => void;
  onCloseReview: () => void;
  t: TranslationFn;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = useRemoteBasePath();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tab } = useSourceTab(reviewsEnabled);
  const blameFile = searchParams.get("bf") ?? undefined;
  const commitSha = searchParams.get("rev") ?? undefined;
  const commitFile = searchParams.get("commitFile") ?? undefined;
  const commitBlame = searchParams.get("blame") === "1";
  const worktreeFile = searchParams.get("worktreeFile") ?? undefined;
  const { sourceControlCleanLanding } = useSourceControlCleanLanding();
  const historyOpen =
    tab === "changes" &&
    (searchParams.get("history") === "1" ||
      searchParams.get("tab") === "commits" ||
      (commitSha === undefined &&
        status.isClean &&
        worktreeFile === undefined &&
        sourceControlCleanLanding === "latest-commit"));
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [showProjectionNotice, setShowProjectionNotice] = useState(false);
  const [projectionRequestError, setProjectionRequestError] = useState<
    string | null
  >(null);
  const projectionNoticeNeedsPortal = useMediaQuery("(max-width: 600px)");
  const activeIgnoreWhitespace = supportsProjections && ignoreWhitespace;
  useEffect(() => {
    if (!supportsProjections) setIgnoreWhitespace(false);
  }, [supportsProjections]);
  const handleProjectionUnavailable = useCallback(() => {
    setIgnoreWhitespace(false);
    setProjectionRequestError(null);
    setShowProjectionNotice(true);
  }, []);
  const handleProjectionRequestFailure = useCallback(
    (error: unknown) => {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("gitStatusLoadDiffFailed");
      setIgnoreWhitespace(false);
      setShowProjectionNotice(false);
      setProjectionRequestError(
        t("sourceProjectionRequestError", { error: message }),
      );
    },
    [t],
  );
  const handleToggleIgnoreWhitespace = useCallback(() => {
    if (!ignoreWhitespace && !supportsProjections) {
      setProjectionRequestError(null);
      setShowProjectionNotice(true);
      return;
    }
    setIgnoreWhitespace(!ignoreWhitespace);
  }, [ignoreWhitespace, supportsProjections]);
  const projectionNotice = showProjectionNotice ? (
    <div className="source-projection-notice" role="status">
      <span>{t("sourceProjectionUpgradeNotice")}</span>
      <button
        type="button"
        className="source-projection-notice-dismiss"
        aria-label={t("sourceDismissProjectionNotice")}
        onClick={() => setShowProjectionNotice(false)}
      >
        ×
      </button>
    </div>
  ) : projectionRequestError ? (
    <div className="source-projection-notice" role="alert">
      <span>{projectionRequestError}</span>
      <button
        type="button"
        className="source-projection-notice-dismiss"
        aria-label={t("sourceDismissProjectionError")}
        onClick={() => setProjectionRequestError(null)}
      >
        ×
      </button>
    </div>
  ) : null;
  // Bridge a commit file to its blame-at-HEAD view: switch to the files tab
  // with that file seeded open (a real history step, so back returns).
  const handleBlameFile = useCallback(
    (path: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set("tab", "files");
          params.set("bf", path);
          return params;
        },
        { state: location.state },
      );
    },
    [location.state, setSearchParams],
  );
  const handleOpenCommit = useCallback(
    (sha: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.delete("tab");
          params.delete("history");
          params.set("rev", sha);
          return params;
        },
        { state: location.state },
      );
    },
    [location.state, setSearchParams],
  );
  const focusedRevisionHref = useCallback(
    (sha: string | null) => {
      const params = new URLSearchParams(searchParams);
      params.set("projectId", projectId);
      for (const key of SOURCE_SELECTION_PARAMS) params.delete(key);
      if (sha) params.set("rev", sha);
      return toBrowserAppHref(`${basePath}/git-status?${params.toString()}`);
    },
    [basePath, projectId, searchParams],
  );
  const handleSelectRevision = useCallback(
    (sha: string | null) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          for (const key of SOURCE_SELECTION_PARAMS) params.delete(key);
          if (historyOpen) params.set("history", "1");
          if (sha) params.set("rev", sha);
          return params;
        },
        { state: location.state },
      );
    },
    [historyOpen, location.state, setSearchParams],
  );
  const handleBrowseHistory = useCallback(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("tab");
        params.set("history", "1");
        return params;
      },
      { state: location.state },
    );
  }, [location.state, setSearchParams]);
  return (
    <div className="git-status">
      <GitActionNotices gitActions={gitActions} t={t} />
      {projectionNotice &&
        (projectionNoticeNeedsPortal
          ? createPortal(projectionNotice, document.body)
          : projectionNotice)}

      {tab === "changes" && !historyOpen && !commitSha ? (
        <WorkingTreeBrowser
          projectId={projectId}
          status={status}
          isWideScreen={isWideScreen}
          supportsUntrackedCache={
            supportsWorkingTreeFiles && !supportsWorkingTreeSections
          }
          untrackedFiles={untrackedFiles}
          untrackedLoading={untrackedLoading}
          untrackedError={untrackedError}
          inventoryPending={inventoryPending}
          inventoryLoading={inventoryLoading}
          inventoryError={inventoryError}
          initialWorkingTreePath={worktreeFile}
          onBrowseHistory={handleBrowseHistory}
          onBlameFile={handleBlameFile}
          captureReviewProjections={reviewsEnabled}
          supportsLastEditor={supportsLastEditor}
          ignoreWhitespace={activeIgnoreWhitespace}
          onToggleIgnoreWhitespace={handleToggleIgnoreWhitespace}
          onProjectionRequestFailure={handleProjectionRequestFailure}
          t={t}
        />
      ) : tab === "changes" ? (
        <CommitBrowser
          projectId={projectId}
          status={status}
          isWideScreen={isWideScreen}
          supportsUntrackedCache={
            supportsWorkingTreeFiles && !supportsWorkingTreeSections
          }
          untrackedFiles={untrackedFiles}
          untrackedLoading={untrackedLoading}
          untrackedError={untrackedError}
          inventoryPending={inventoryPending}
          inventoryLoading={inventoryLoading}
          inventoryError={inventoryError}
          initialSha={commitSha}
          initialPath={commitFile}
          initialBlame={commitBlame}
          showRevisionPane={historyOpen}
          revisionHref={focusedRevisionHref}
          onSelectRevision={handleSelectRevision}
          onBrowseHistory={handleBrowseHistory}
          onBlameFile={handleBlameFile}
          captureReviewProjections={reviewsEnabled}
          supportsProjections={supportsProjections}
          supportsInclusiveToHead={supportsInclusiveToHead}
          supportsLastEditor={supportsLastEditor}
          ignoreWhitespace={activeIgnoreWhitespace}
          onToggleIgnoreWhitespace={handleToggleIgnoreWhitespace}
          onProjectionUnavailable={handleProjectionUnavailable}
          onProjectionRequestFailure={handleProjectionRequestFailure}
          t={t}
        />
      ) : tab === "comments" ? (
        <ReviewCommentsPanel
          projectId={projectId}
          pending={reviewComments.pending}
          onOpenFile={handleBlameFile}
          onSubmit={onOpenReview}
          t={t}
        />
      ) : tab === "reviews" ? (
        <ReviewSubmissionsPanel
          projectId={projectId}
          initialSubmissionId={searchParams.get("submission") ?? undefined}
          sessionHref={(sessionId) =>
            `${basePath}/projects/${projectId}/sessions/${sessionId}`
          }
          t={t}
        />
      ) : tab === "files" ? (
        <BlameBrowser
          projectId={projectId}
          isWideScreen={isWideScreen}
          initialPath={blameFile}
          status={status}
          supportsWorkingTreeFiles={supportsWorkingTreeFiles}
          supportsWorktreeSections={supportsWorkingTreeSections}
          supportsCompleteFilesystemScan={supportsCompleteFilesystemScan}
          onOpenCommit={handleOpenCommit}
          captureReviewProjections={reviewsEnabled}
          t={t}
        />
      ) : null}

      {showReviewModal && (
        <ReviewSubmitModal
          projectId={projectId}
          recentReviewSessionId={reviewComments.recentReviewSessionId}
          submissionsEnabled={reviewsEnabled}
          onClose={onCloseReview}
          onNavigateSession={(sessionId) =>
            navigate(`${basePath}/projects/${projectId}/sessions/${sessionId}`)
          }
          t={t}
        />
      )}
    </div>
  );
}

function GitActionNotices({
  gitActions,
  t,
}: {
  gitActions: GitActionState;
  t: TranslationFn;
}) {
  const showIntegrationOptions =
    gitActions.divergedActionStatus && gitActions.supportsIntegrationOptions;
  if (!gitActions.actionFeedback && !showIntegrationOptions) {
    return null;
  }

  return (
    <div className="git-status-action-notices">
      {gitActions.actionFeedback && gitActions.actionFeedbackTone && (
        <GitActionFeedback
          message={gitActions.actionFeedback}
          tone={gitActions.actionFeedbackTone}
          failure={gitActions.actionFailure}
        />
      )}
      {showIntegrationOptions && (
        <GitIntegrationOptionsPanel
          options={gitActions.integrationOptions}
          loading={gitActions.isLoadingIntegrationOptions}
          error={gitActions.integrationOptionsError}
          t={t}
        />
      )}
    </div>
  );
}

function GitIntegrationOptionsPanel({
  options,
  loading,
  error,
  t,
}: {
  options: GitIntegrationOptionsResult | null;
  loading: boolean;
  error: string | null;
  t: TranslationFn;
}) {
  if (loading) {
    return (
      <div className="git-integration-options">
        <span>{t("gitStatusAutoOptionsChecking")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="git-integration-options git-integration-options-warning">
        <span>{error}</span>
      </div>
    );
  }

  if (!options) {
    return null;
  }

  if (options.status === "available") {
    return (
      <div className="git-integration-options">
        <span className="git-integration-options-label">
          {t("gitStatusAutoOptionsLabel")}
        </span>
        <span
          className="git-integration-option-pill"
          aria-disabled="true"
          title={t("gitStatusAutoActionNotEnabled")}
        >
          {t("gitStatusAutoRebase")}
        </span>
        <span
          className="git-integration-option-pill"
          aria-disabled="true"
          title={t("gitStatusAutoActionNotEnabled")}
        >
          {t("gitStatusAutoMerge")}
        </span>
        <GitIntegrationOptionsHelp t={t} />
      </div>
    );
  }

  return (
    <div className="git-integration-options git-integration-options-warning">
      <span>
        {t("gitStatusAutoOptionsUnavailable", {
          reason: getIntegrationUnavailableReason(options.reasons, t),
        })}
      </span>
      <GitIntegrationOptionsHelp t={t} />
    </div>
  );
}

function GitIntegrationOptionsHelp({ t }: { t: TranslationFn }) {
  return (
    <details className="git-integration-help">
      <summary
        aria-label={t("gitStatusAutoHelpLabel")}
        title={t("gitStatusAutoHelpLabel")}
      >
        ?
      </summary>
      <div className="git-integration-help-popover">
        {t("gitStatusAutoHelp")}
      </div>
    </details>
  );
}

const INTEGRATION_REASON_PRIORITY: GitIntegrationOptionReason[] = [
  "operation-running",
  "sequencer-in-progress",
  "dirty-worktree",
  "missing-upstream",
  "detached-head",
  "not-diverged",
  "not-a-git-repo",
  "status-unavailable",
];

function getIntegrationUnavailableReason(
  reasons: GitIntegrationOptionReason[],
  t: TranslationFn,
): string {
  const reason =
    INTEGRATION_REASON_PRIORITY.find((candidate) =>
      reasons.includes(candidate),
    ) ?? "status-unavailable";

  switch (reason) {
    case "operation-running":
      return t("gitStatusAutoReasonOperationRunning");
    case "sequencer-in-progress":
      return t("gitStatusAutoReasonSequencer");
    case "dirty-worktree":
      return t("gitStatusAutoReasonDirty");
    case "missing-upstream":
      return t("gitStatusAutoReasonMissingUpstream");
    case "detached-head":
      return t("gitStatusAutoReasonDetached");
    case "not-diverged":
      return t("gitStatusAutoReasonNotDiverged");
    case "not-a-git-repo":
      return t("gitStatusAutoReasonNotRepo");
    case "status-unavailable":
      return t("gitStatusAutoReasonStatusUnavailable");
    default:
      return t("gitStatusAutoReasonStatusUnavailable");
  }
}
