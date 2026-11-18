import { desktopControlOrigin } from "../desktop/machine-control.js";
import { RETIRED_COMPUTER_CONTROL_ERROR } from "../machine-control/legacy-retirement.js";
import {
  type PromptSuggestionMode,
  type ProviderName,
  type SessionMetadataResponse,
  type SessionOwnership,
  type SessionSandboxLevel,
  type ThinkingOption,
  type UrlProjectId,
  type WorkstreamId,
  buildEffectiveAgentContext,
  isThinkingOption,
  isUrlProjectId,
  isWorkstreamId,
  mainWorkstreamId,
  readQueuedVibeAllDayCommand,
  type SessionRewindReason,
  type SessionRewindRecord,
  type UpdateClearloopRequest,
} from "@vibeallday/shared";
import { isRealUserTurn } from "@vibeallday/shared/transcript/messageProjection";
import { randomUUID } from "node:crypto";
import {
  ClearloopConflictError,
  type ClearloopService,
} from "../services/ClearloopService.js";
import { turnIndexOf } from "../sessions/turn-index.js";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { hostname } from "node:os";
import { performance } from "node:perf_hooks";
import { Hono } from "hono";
import { getLogger } from "../logging/logger.js";
import { nonHumanUserTurnField } from "../metadata/SessionMetadataService.js";
import {
  DETACHED_PROJECT_PATH,
  encodeProjectId,
  limitedDetachedProjectPath,
} from "../projects/paths.js";
import { tryClaimProjectPathIndex } from "../projects/projectPathIndex.js";
import { resolveCanonicalProjectRedirect } from "./session-project-routing.js";
import { ensureRemoteDirectory } from "../sdk/remote-spawn.js";
import { getProjectDirFromCwd, syncSessions } from "../sdk/session-sync.js";
import type { UserMessage } from "../sdk/types.js";
import { getSessionSandboxSettingsError } from "../session-sandbox.js";
import { describeQueuedVibeAllDayCommandProblem } from "../services/ProjectQueueService.js";
import { initializeSessionHeartbeatDefaults } from "../services/sessionHeartbeatDefaults.js";
import { CodexSessionReader } from "../sessions/codex-reader.js";
import { cloneClaudeSession } from "../sessions/fork.js";
import { GrokSessionReader } from "../sessions/grok-reader.js";
import { extractLastAgentExcerpt } from "../sessions/agent-excerpt.js";
import {
  readerForProviderChildren,
  resolveProviderChildSessions,
} from "../sessions/provider-child-sessions.js";
import { lastRewindableClaudeRowId } from "../sessions/claude-messages.js";
import {
  detachSessionMessageProjection,
  getCodexMessageSourceByteCursor,
  normalizeSession,
} from "../sessions/normalization.js";
import {
  applySessionOverlaysToSession,
  applyRecapOverlayToSummary,
  hasUnreadProviderContent,
  getEffectiveProviderUpdatedAt,
  latestRecapMessage,
  mergeSessionOverlayMessages,
  mergeLocalCommandMessages,
} from "../sessions/recap-overlays.js";
import { sessionOwnershipFromProcess } from "../sessions/session-runtime-overlay.js";
import { isAutomaticSessionResumeAllowed } from "../sessions/resume-exemption.js";
import {
  type PaginationInfo,
  sliceAfterMessageIdWithMatch,
  sliceAtCompactAndUserTurnBoundaries,
  sliceAtCompactBoundaries,
  sliceAtUserTurnBoundary,
} from "../sessions/pagination.js";
import {
  augmentTaskListSnapshots,
  projectTaskListSnapshots,
  pruneTaskListSnapshotsToLatest,
} from "../augments/task-list-augments.js";
import {
  type PersistedAugmentDiagnostics,
  augmentEditToolUses,
  augmentPersistedSessionMessages,
} from "../sessions/persisted-augments.js";
import {
  findSessionListSummaryAcrossProviders,
  findSessionSummaryAcrossProviders,
  getSessionSources,
} from "../sessions/provider-resolution.js";
import type { GetSessionOptions, LoadedSession } from "../sessions/types.js";
import {
  type ProviderForkBoundary,
  resolveInheritedForkModel,
} from "../sdk/providers/types.js";
import type { Process } from "../supervisor/Process.js";
import type {
  ModelSettings,
  SessionReactivationOverrides,
  Supervisor,
} from "../supervisor/Supervisor.js";
import {
  ForkSettingsPersistenceError,
  ResumeCompactionError,
  routedSessionUnsupportedMessage,
  RetryableSessionLaunchError,
  SessionConfigurationConflictError,
  SessionMessageRejectedError,
} from "../supervisor/Supervisor.js";
import { RouterUnavailable } from "../services/AgentAuthRouter.js";
import type { Project, Session } from "../supervisor/types.js";
import {
  buildUserMessageMetadata,
  normalizeOptionalServiceTier,
  parseHelperSettings,
  parseOptionalExecutor,
  parseOptionalResumeMode,
} from "./session-request-helpers.js";
import {
  type ClaudeResumeApiErrorBlocker,
  getClaudeResumeBlockerFromReader,
} from "./session-claude-resume-guard.js";
import {
  isClaudeSdkProviderName,
  isCodexProviderName,
  providerResolutionDeps,
} from "./session-provider-resolution.js";
import { sessionQueueSummaries } from "./session-queue-summaries.js";
import { inheritSuccessorLaunchSettings } from "../supervisor/sessionLaunchInheritance.js";
import { buildThinkingOptions } from "./session-thinking-options.js";
import {
  actingUsername,
  applyLimitedLaunchPolicy,
  applyLimitedResumePolicy,
  type LimitedLaunchBody,
} from "../auth/limitedLaunchPolicy.js";
import { resolveExistingSessionIdentity } from "./session-existing-identity.js";
import { registerSessionForkSummaryRoutes } from "./sessions-fork-summary-routes.js";
import { registerSessionRuntimeRoutes } from "./sessions-runtime-routes.js";
import {
  type CreateSessionBody,
  type ResumeLaunchRequest,
  type SessionForkKind,
  type SessionsDeps,
  type StartSessionBody,
  buildRestartHandoff,
  buildRestartTranscript,
  completedPublicShareMessageCount,
  deriveForkTitle,
  deriveRestartTitle,
  effectiveModelSettingsFromMetadata,
  extractContextUsageFromSDKMessages,
  findDurableOverlayCursor,
  forkTitleWithOrdinal,
  getSessionSlashCommands,
  hasSessionMessageContent,
  inheritedSandboxSettings,
  isQueueFullResponse,
  isQueuedResponse,
  isRestartReplacementActivity,
  messageId,
  normalizeRestartTitleCandidate,
  parseCreationProvenance,
  parseOptionalReactivateSessionBody,
  parseOptionalRestartSessionBody,
  parseRestartHandoffText,
  parseSessionSandboxLevel,
  permissionModeError,
  persistedSandboxNetworkFirewall,
  precedingChainTurn,
  resolveCompactModelSettings,
  resolveForkAfterBoundary,
  resolveForkBeforeBoundary,
  resolveSessionReader,
  roundedMs,
  sdkMessagesToClientMessages,
  sliceAfterDurableOverlayCursor,
  tryRestartCompact,
} from "./sessions-restart-fork-helpers.js";

const SESSION_DETAIL_SLOW_LOG_MS = 250;
const DEFAULT_SESSION_DETAIL_TAIL_COMPACTIONS = 2;
const LARGE_FULL_HISTORY_MESSAGE_THRESHOLD = 1000;

export type { SessionsDeps } from "./sessions-restart-fork-helpers.js";

export function createSessionsRoutes(deps: SessionsDeps): Hono {
  const routes = new Hono();
  // Successors of a router-pinned session would launch without its pin and
  // run on the owner's direct provider login; refuse them up front.
  const isRoutedSession = (sessionId: string): boolean =>
    Boolean(
      deps.sessionMetadataService?.getMetadata?.(sessionId)?.routerBinding,
    );
  const recordCreationProvenance = async (
    sessionId: string,
    value: unknown,
  ): Promise<void> => {
    const provenance = parseCreationProvenance(value);
    if (!provenance || !deps.sessionMetadataService) return;
    await deps.sessionMetadataService.recordCreationProvenance(
      sessionId,
      provenance,
    );
    deps.eventBus?.emit({
      type: "session-metadata-changed",
      sessionId,
      creationProvenance: provenance,
      timestamp: new Date().toISOString(),
    });
  };
  const getCodexReader = (projectPath: string): CodexSessionReader | null =>
    deps.codexReaderFactory?.(projectPath) ??
    (deps.codexSessionsDir
      ? new CodexSessionReader({
          sessionsDir: deps.codexSessionsDir,
          projectPath,
        })
      : null);

  let unscopedGrokReader: GrokSessionReader | null | undefined;
  const getUnscopedGrokReader = (): GrokSessionReader | null => {
    if (unscopedGrokReader !== undefined) {
      return unscopedGrokReader;
    }
    unscopedGrokReader = deps.grokSessionsDir
      ? new GrokSessionReader({ sessionsDir: deps.grokSessionsDir })
      : null;
    return unscopedGrokReader;
  };

  const getGrokNativeProjectId = async (
    sessionId: string,
    currentProjectId: UrlProjectId,
  ): Promise<UrlProjectId | null> => {
    const reader = getUnscopedGrokReader();
    if (!reader) {
      return null;
    }
    const projectPath = await reader.getSessionProjectPath(sessionId);
    if (!projectPath) {
      return null;
    }
    const canonicalProjectId = encodeProjectId(projectPath);
    return canonicalProjectId === currentProjectId ? null : canonicalProjectId;
  };

  const buildGrokNativeRedirectPath = (
    canonicalProjectId: UrlProjectId,
    sessionId: string,
    suffix: "" | "/metadata",
    requestUrl: string,
  ): string => {
    const search = new URL(requestUrl).search;
    return `/api/projects/${canonicalProjectId}/sessions/${encodeURIComponent(
      sessionId,
    )}${suffix}${search}`;
  };

  const buildSessionProjectRedirectPath = (
    canonicalProjectId: UrlProjectId,
    sessionId: string,
    suffix: string,
    requestUrl: string,
  ): string => {
    const search = new URL(requestUrl).search;
    return `/api/projects/${canonicalProjectId}/sessions/${encodeURIComponent(
      sessionId,
    )}${suffix}${search}`;
  };

  const resolveSessionProjectRouting = async (
    requestProjectId: UrlProjectId,
    sessionId: string,
  ): Promise<
    | { error: string; status: 404 }
    | {
        redirectProjectId: UrlProjectId;
      }
    | {
        transcriptProject: Project;
        transcriptProjectId: UrlProjectId;
        workingProject: Project;
        workingProjectId: UrlProjectId;
      }
  > => {
    const workingProjectId =
      deps.sessionMetadataService?.getMetadata(sessionId)?.workingProjectId;
    const activeProcess = deps.supervisor.getProcessForSession(sessionId);
    const redirectProjectId = resolveCanonicalProjectRedirect({
      requestProjectId,
      workingProjectId,
      activeProcessProjectId:
        typeof activeProcess?.projectId === "string"
          ? activeProcess.projectId
          : undefined,
    });
    if (redirectProjectId) {
      return { redirectProjectId };
    }

    const workingProject =
      await deps.scanner.getOrCreateProject(requestProjectId);
    if (!workingProject) {
      return { error: "Project not found", status: 404 };
    }

    const metadata = deps.sessionMetadataService?.getMetadata(sessionId);
    const overlayTranscriptProjectId =
      metadata?.workingProjectId === requestProjectId &&
      metadata.transcriptProjectId &&
      metadata.transcriptProjectId !== requestProjectId
        ? metadata.transcriptProjectId
        : undefined;

    // Default: the transcript lives under the working (request) project.
    let transcriptProjectId: UrlProjectId = requestProjectId;
    let transcriptProject: Project = workingProject;

    // Overlay case (session "moved" to a different working project): the
    // transcript may live under a distinct project. Trust the recorded pointer
    // only if the transcript is actually findable there — a stale/wrong pointer
    // must not permanently brick viewing, so fall back to the working project.
    if (overlayTranscriptProjectId) {
      const overlayProject = await deps.scanner.getOrCreateProject(
        overlayTranscriptProjectId,
      );
      const overlayHasTranscript = overlayProject
        ? Boolean(
            await findSessionListSummaryAcrossProviders(
              overlayProject,
              sessionId,
              overlayTranscriptProjectId,
              providerResolutionDeps(deps),
              deps.sessionMetadataService?.getProvider(sessionId) as
                | ProviderName
                | undefined,
            ),
          )
        : false;
      if (overlayProject && overlayHasTranscript) {
        transcriptProjectId = overlayTranscriptProjectId;
        transcriptProject = overlayProject;
      }
    }

    return {
      transcriptProject,
      transcriptProjectId,
      workingProject,
      workingProjectId: requestProjectId,
    };
  };

  const getGlobalInstructions = (): string | undefined =>
    buildEffectiveAgentContext({
      globalInstructions:
        deps.serverSettingsService?.getSetting("globalInstructions"),
      hints: deps.serverSettingsService?.getSetting("agentContextHints"),
    });

  /**
   * The one assembly of an existing session's resume launch: the request's
   * choices over the session's saved model, executor, helper preferences and
   * settled sandbox. The resume route and `/clearloop` iterations both use it.
   */
  const buildResumeLaunch = (input: {
    sessionId: string;
    providerName: ProviderName;
    workingProjectPath: string;
    /** Model the replaced process reported, a compact-window lookup key. */
    previousResolvedModel?: string;
    request: ResumeLaunchRequest;
  }): { projectPath: string; settings: ModelSettings } | { error: string } => {
    const { sessionId, providerName, request } = input;
    const saved = deps.sessionMetadataService;
    const metadata = saved?.getMetadata?.(sessionId);
    const requestedModel = request.model ?? saved?.getRequestedModel(sessionId);
    const model =
      requestedModel && requestedModel !== "default"
        ? requestedModel
        : undefined;
    let executor = request.executor;
    if (!executor) {
      const savedExecutor = parseOptionalExecutor(
        saved?.getExecutor(sessionId),
      );
      if (savedExecutor.error) return { error: savedExecutor.error };
      executor = savedExecutor.executor;
    }
    const recapMode = request.recapMode ?? metadata?.recapMode;
    const sandboxLevel = metadata?.sandboxLevel ?? "none";
    const sandboxError = getSessionSandboxSettingsError(
      sandboxLevel,
      recapMode,
    );
    if (sandboxError) return { error: sandboxError };
    return {
      projectPath:
        sandboxLevel === "project-write"
          ? (metadata?.sandboxProjectPath ?? input.workingProjectPath)
          : input.workingProjectPath,
      settings: {
        model,
        requestedModel,
        serviceTier: request.serviceTier,
        thinking: request.thinking,
        effort: request.effort,
        ultracode: request.ultracode,
        providerName,
        executor,
        sandboxLevel,
        sandboxNetworkFirewall: persistedSandboxNetworkFirewall(metadata),
        sandboxStateKey: metadata?.sandboxStateKey,
        globalInstructions: getGlobalInstructions(),
        permissions: request.permissions,
        recapMode,
        recapAfterSeconds:
          request.recapAfterSeconds ?? saved?.getRecapAfterSeconds?.(sessionId),
        promptSuggestionMode:
          request.promptSuggestionMode ??
          saved?.getPromptSuggestionMode?.(sessionId),
        helperSideModel: request.helperSideModel,
        resumeMode: request.resumeMode,
        resumeSessionAt: request.resumeSessionAt,
        ...resolveCompactModelSettings(deps, {
          provider: providerName,
          vibeAllDayModelId: requestedModel,
          modelCandidates: [requestedModel, model, input.previousResolvedModel],
        }),
      },
    };
  };

  const initializeProjectHeartbeatDefaults = async (
    sessionId: string,
    projectId: UrlProjectId,
  ): Promise<void> =>
    initializeSessionHeartbeatDefaults({
      sessionId,
      projectId,
      sessionMetadataService: deps.sessionMetadataService,
      projectMetadataService: deps.projectMetadataService,
      serverSettingsService: deps.serverSettingsService,
    });

  const resolveLaunchWorkstreamTarget = (
    project: Project,
    rawWorkstreamId: string | undefined,
  ):
    | { projectPath: string; workstreamId?: WorkstreamId }
    | { error: string; status: 400 | 404 | 409 | 503 } => {
    if (rawWorkstreamId === undefined) {
      return { projectPath: project.path };
    }
    if (!isWorkstreamId(rawWorkstreamId)) {
      return { error: "Invalid workstream ID format", status: 400 };
    }
    if (deps.serverSettingsService?.getSetting("workstreamsEnabled") !== true) {
      return { error: "Workstreams are disabled", status: 404 };
    }
    if (!deps.workstreamService) {
      return { error: "Workstreams unavailable", status: 503 };
    }

    const workstreamId = rawWorkstreamId;
    if (workstreamId === mainWorkstreamId(project.id)) {
      return { projectPath: project.path };
    }
    if (!deps.sessionMetadataService) {
      return { error: "Session metadata unavailable", status: 503 };
    }

    const workstream = deps.workstreamService.getWorkstream(
      project.id,
      workstreamId,
    );
    if (workstream?.kind !== "checkout") {
      return { error: "Workstream not found", status: 404 };
    }
    if (workstream.status !== "active") {
      return { error: "Workstream is not active", status: 409 };
    }
    return { projectPath: workstream.path, workstreamId };
  };

  const persistLaunchMetadata = async (
    sessionId: string,
    provider: ProviderName | undefined,
    executor: string | undefined,
    initialPrompt?: string,
    requestedModel?: string,
    promptSuggestionMode?: PromptSuggestionMode,
    recapAfterSeconds?: number,
    workstreamId?: WorkstreamId,
    sandbox?: {
      level: SessionSandboxLevel;
      networkFirewall?: boolean;
      stateKey?: string;
      projectPath: string;
      projectId: UrlProjectId;
    },
  ): Promise<void> => {
    if (!deps.sessionMetadataService) {
      return;
    }
    if (provider) {
      await deps.sessionMetadataService.setProvider(sessionId, provider);
    }
    if (executor) {
      await deps.sessionMetadataService.setExecutor(sessionId, executor);
    }
    if (initialPrompt?.trim()) {
      await deps.sessionMetadataService.setInitialPrompt(
        sessionId,
        initialPrompt,
      );
    }
    // Persist the launch model identity. Normal launches retain the selected VIBEALLDAY
    // alias (including "default"); forks replace "default" with the observed
    // source model so a cold first resume cannot drift to a new default.
    if (requestedModel) {
      await deps.sessionMetadataService.setRequestedModel(
        sessionId,
        requestedModel,
      );
    }
    // Persist the resolved prompt-suggestion mode so a later resume (which may
    // omit it from the request body) recovers the per-session preference
    // instead of falling back to the provider's native default.
    if (promptSuggestionMode !== undefined) {
      await deps.sessionMetadataService.updateMetadata(sessionId, {
        promptSuggestionMode,
      });
    }
    if (recapAfterSeconds !== undefined) {
      await deps.sessionMetadataService.updateMetadata(sessionId, {
        recapAfterSeconds,
      });
    }
    if (workstreamId !== undefined) {
      await deps.sessionMetadataService.setWorkstream(sessionId, workstreamId);
    }
    if (sandbox) {
      await deps.sessionMetadataService.setSessionSandbox?.(sessionId, sandbox);
    }
  };

  /**
   * Everything a new session's launch records once it has an id: heartbeat
   * defaults for a project session, client provenance, the limited user who
   * started it, and the launch metadata, sandbox included. The session-create
   * routes run it as their `onStarted`, so a start that waited for a free
   * worker records exactly what one that started at once does.
   */
  const recordNewSessionLaunch = async (
    process: Process,
    launch: {
      heartbeatProjectId?: UrlProjectId;
      creationProvenance: unknown;
      /** The limited user who started it; absent for the superuser. */
      createdByUser?: string;
      provider: ProviderName | undefined;
      executor: string | undefined;
      initialPrompt?: string;
      requestedModel?: string;
      recapAfterSeconds?: number;
      workstreamId?: WorkstreamId;
      sandbox: { level: SessionSandboxLevel; networkFirewall: boolean };
    },
  ): Promise<void> => {
    const { sessionId } = process;
    if (launch.heartbeatProjectId) {
      await initializeProjectHeartbeatDefaults(
        sessionId,
        launch.heartbeatProjectId,
      );
    }
    await recordCreationProvenance(sessionId, launch.creationProvenance);
    if (launch.createdByUser) {
      // Ownership survives a later grant change: a limited user can always
      // read a session they started (topics/limited-users.md § Delivery v1).
      await deps.sessionMetadataService?.recordSessionCreator(
        sessionId,
        launch.createdByUser,
      );
    }
    await persistLaunchMetadata(
      sessionId,
      launch.provider,
      launch.executor,
      launch.initialPrompt,
      launch.requestedModel,
      process.promptSuggestionMode,
      launch.recapAfterSeconds,
      launch.workstreamId,
      {
        level: launch.sandbox.level,
        networkFirewall: launch.sandbox.networkFirewall,
        stateKey: process.sandboxStateKey,
        projectPath: process.sandboxProjectPath ?? process.projectPath,
        projectId: process.projectId,
      },
    );
  };

  const loadProviderSession = async (
    project: Project,
    sessionId: string,
    projectId: UrlProjectId,
    preferredProvider: ProviderName | undefined,
    afterMessageId?: string,
    options?: GetSessionOptions,
  ): Promise<LoadedSession | null> => {
    for (const source of getSessionSources(
      project,
      providerResolutionDeps(deps),
      preferredProvider,
    )) {
      const summaryHint =
        options?.tailCompactions !== undefined &&
        source.provider === "codex" &&
        deps.sessionIndexService
          ? await deps.sessionIndexService.getCachedSessionSummary(
              source.sessionDir,
              projectId,
              sessionId,
              source.reader,
              // A live Codex rollout grows between index passes, so requiring
              // an exactly-current index meant every mid-turn open of a long
              // session lost the compact-tail window and fell back to reading
              // and normalizing the whole file. The reader takes only
              // head-derived fields from this hint and reads the tail itself.
              { acceptAppendedFile: true },
            )
          : null;
      const loaded = await source.reader.getSession(
        sessionId,
        projectId,
        afterMessageId,
        summaryHint ? { ...options, summaryHint } : options,
      );
      if (loaded) {
        return loaded;
      }
    }

    return null;
  };

  /**
   * Ids of the rewinds a detail response's projection applied, so a client
   * holding a cached transcript can tell whether it predates a rewind
   * (topics/session-rewind.md). Absent when the session has none.
   */
  const rewindRecordIdsFor = (sessionId: string): string[] | undefined => {
    const records = deps.sessionMetadataService?.getRewindRecords?.(sessionId);
    return records?.length ? records.map((record) => record.id) : undefined;
  };

  const loadRestartSourceSession = async (
    project: Project,
    sessionId: string,
    projectId: UrlProjectId,
    preferredProvider?: ProviderName,
    process?: Process,
  ): Promise<Session | null> => {
    const resolved = await findSessionListSummaryAcrossProviders(
      project,
      sessionId,
      projectId,
      providerResolutionDeps(deps),
      preferredProvider,
    );

    if (resolved) {
      const loaded = await resolved.source.reader.getSession(
        sessionId,
        projectId,
        undefined,
        { includeOrphans: false },
      );
      if (loaded) {
        return normalizeSession(loaded, {
          rewindRecords:
            deps.sessionMetadataService?.getRewindRecords?.(sessionId),
        });
      }
    }

    if (process) {
      const messages = sdkMessagesToClientMessages(process.getMessageHistory());
      return {
        id: sessionId,
        projectId,
        title: null,
        fullTitle: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: messages.length,
        ownership: sessionOwnershipFromProcess(process),
        provider: process.provider,
        model: process.resolvedModel ?? process.model,
        messages,
      };
    }

    return null;
  };

  /**
   * The transcript's last row on disk, read once the session's process has
   * stopped: every row up to it belongs to a rewind recorded now, and the
   * resumed continuation is written after it.
   */
  const readRewindBoundRowId = async (
    project: Project,
    sessionId: string,
    projectId: UrlProjectId,
    providerName: ProviderName,
  ): Promise<string | undefined> => {
    const resolved = await findSessionListSummaryAcrossProviders(
      project,
      sessionId,
      projectId,
      providerResolutionDeps(deps),
      providerName,
    );
    const loaded = await resolved?.source.reader.getSession(
      sessionId,
      projectId,
      undefined,
      { includeOrphans: false },
    );
    const data = loaded?.data;
    switch (data?.provider) {
      case "claude":
      case "claude-gateway":
      case "claude-ollama":
        return lastRewindableClaudeRowId(data.session.messages);
      default:
        return undefined;
    }
  };

  const interruptOldProcessForHandoff = async (
    oldProcess: Process | undefined,
  ): Promise<boolean> => {
    if (!oldProcess) {
      return false;
    }
    try {
      const result = await deps.supervisor.interruptProcess(oldProcess.id);
      return result.success;
    } catch (error) {
      console.warn(
        `[restart] Failed to interrupt old process ${oldProcess.id}:`,
        error,
      );
      return false;
    }
  };

  const abortOldProcessAfterReplacementActivity = (
    oldProcess: Process | undefined,
    replacement: Process,
  ): boolean => {
    if (!oldProcess || oldProcess.id === replacement.id) {
      return false;
    }

    let unsubscribe: (() => void) | null = null;
    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      unsubscribe?.();
      unsubscribe = null;
    };

    unsubscribe = replacement.subscribe((event) => {
      if (
        event.type === "message" &&
        isRestartReplacementActivity(event.message)
      ) {
        cleanup();
        void deps.supervisor.abortProcess(oldProcess.id).catch((error) => {
          console.warn(
            `[restart] Failed to abort old process ${oldProcess.id}:`,
            error,
          );
        });
        return;
      }

      if (
        event.type === "terminated" ||
        event.type === "complete" ||
        event.type === "error"
      ) {
        cleanup();
      }
    });

    return true;
  };

  const ensureDetachedProjectPath = async (
    executor?: string,
    username?: string,
  ): Promise<string> => {
    const projectPath = username
      ? limitedDetachedProjectPath(username)
      : DETACHED_PROJECT_PATH;
    await mkdir(projectPath, { recursive: true, mode: 0o700 });
    if (executor) {
      await ensureRemoteDirectory(executor, projectPath);
    }
    return projectPath;
  };

  // GET /api/projects/:projectId/sessions/:sessionId/agents - Get agent mappings
  // Used to find agent sessions for pending Tasks on page reload
  routes.get("/projects/:projectId/sessions/:sessionId/agents", async (c) => {
    const projectId = c.req.param("projectId");

    // Validate projectId format at API boundary
    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }

    const routing = await resolveSessionProjectRouting(
      projectId as UrlProjectId,
      c.req.param("sessionId"),
    );
    if ("redirectProjectId" in routing) {
      return c.redirect(
        buildSessionProjectRedirectPath(
          routing.redirectProjectId,
          c.req.param("sessionId"),
          "",
          c.req.url,
        ),
        307,
      );
    }
    if ("error" in routing) {
      return c.json({ error: routing.error }, routing.status);
    }

    const reader = await resolveSessionReader({
      deps,
      project: routing.transcriptProject,
      sessionId: c.req.param("sessionId"),
      projectId: routing.transcriptProjectId,
    });
    const mappings = await reader.getAgentMappings(c.req.param("sessionId"));

    return c.json({ mappings });
  });

  // GET /api/projects/:projectId/sessions/:sessionId/agents/:agentId - Get agent session content
  // Used for lazy-loading completed Tasks
  routes.get(
    "/projects/:projectId/sessions/:sessionId/agents/:agentId",
    async (c) => {
      const projectId = c.req.param("projectId");
      const agentId = c.req.param("agentId");

      // Validate projectId format at API boundary
      if (!isUrlProjectId(projectId)) {
        return c.json({ error: "Invalid project ID format" }, 400);
      }

      const routing = await resolveSessionProjectRouting(
        projectId as UrlProjectId,
        c.req.param("sessionId"),
      );
      if ("redirectProjectId" in routing) {
        return c.redirect(
          buildSessionProjectRedirectPath(
            routing.redirectProjectId,
            c.req.param("sessionId"),
            "",
            c.req.url,
          ),
          307,
        );
      }
      if ("error" in routing) {
        return c.json({ error: routing.error }, routing.status);
      }

      const reader = await resolveSessionReader({
        deps,
        project: routing.transcriptProject,
        sessionId: c.req.param("sessionId"),
        projectId: routing.transcriptProjectId,
      });
      const agentSession = await reader.getAgentSession(
        agentId,
        c.req.param("sessionId"),
      );

      if (!agentSession) {
        return c.json({ error: "Agent session not found" }, 404);
      }

      // Add server-rendered HTML to text blocks for markdown display
      const pathIndex = await tryClaimProjectPathIndex(
        routing.workingProject.path,
      );
      try {
        await augmentPersistedSessionMessages(agentSession.messages, {
          projectFileLinks: {
            projectId: routing.workingProjectId,
            projectPath: routing.workingProject.path,
            ...(pathIndex ? { index: pathIndex } : {}),
            resolveAbsoluteFilePaths: deps.resolveAbsoluteFilePaths,
          },
        });
      } finally {
        pathIndex?.release();
      }

      return c.json(agentSession);
    },
  );

  // GET /api/projects/:projectId/sessions/:sessionId/metadata - Get session metadata only (no messages)
  // Lightweight endpoint for refreshing title, status, etc. without re-fetching all messages
  routes.get("/projects/:projectId/sessions/:sessionId/metadata", async (c) => {
    const projectId = c.req.param("projectId");
    const sessionId = c.req.param("sessionId");

    // Validate projectId format at API boundary
    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }

    const routing = await resolveSessionProjectRouting(
      projectId as UrlProjectId,
      sessionId,
    );
    if ("redirectProjectId" in routing) {
      return c.redirect(
        buildSessionProjectRedirectPath(
          routing.redirectProjectId,
          sessionId,
          "/metadata",
          c.req.url,
        ),
        307,
      );
    }
    if ("error" in routing) {
      return c.json({ error: routing.error }, routing.status);
    }
    const project = routing.workingProject;
    const transcriptProject = routing.transcriptProject;
    const transcriptProjectId = routing.transcriptProjectId;

    // Check if session is actively owned by a process
    const process = deps.supervisor.getProcessForSession(sessionId);

    // Check if session is being controlled by an external program
    const isExternal = deps.externalTracker?.isExternal(sessionId) ?? false;

    // Determine the session ownership
    const ownership: SessionOwnership = sessionOwnershipFromProcess(process, {
      isExternal,
    });

    // Get session metadata (custom title, archived, starred)
    const metadata = deps.sessionMetadataService?.getMetadata(sessionId);
    // Get notification data (lastSeenAt, hasUnread)
    const lastSeenEntry = deps.notificationService?.getLastSeen(sessionId);
    const lastSeenAt = lastSeenEntry?.timestamp;

    // Get pending input request from active process
    const pendingInputRequest =
      process?.state.type === "waiting-input" ? process.state.request : null;
    const providerRuntimeStatus =
      deps.supervisor.getProviderRuntimeStatusForSession?.(sessionId) ??
      process?.getProviderRuntimeStatus() ??
      null;

    // Read minimal session info from disk (just for title/timestamps, no messages)
    const metadataProvider =
      (metadata?.provider as ProviderName | undefined) ??
      (deps.sessionMetadataService?.getProvider(sessionId) as
        | ProviderName
        | undefined);
    const slashCommands = await getSessionSlashCommands(
      process,
      process?.provider ?? metadataProvider ?? project.provider,
      metadata,
    );
    const deferredMessages = sessionQueueSummaries(deps, sessionId, process);
    const sessionSummaryResult = await findSessionSummaryAcrossProviders(
      transcriptProject,
      sessionId,
      transcriptProjectId,
      providerResolutionDeps(deps),
      metadataProvider ?? process?.provider,
    );
    const rawSessionSummary = sessionSummaryResult?.summary ?? null;
    const providerUpdatedAt = getEffectiveProviderUpdatedAt(
      rawSessionSummary?.updatedAt ?? "",
      process,
    );
    const recapMessages =
      deps.sessionMetadataService?.getRecapMessages?.(sessionId) ?? [];
    const sessionSummary = rawSessionSummary
      ? applyRecapOverlayToSummary(
          { ...rawSessionSummary, updatedAt: providerUpdatedAt },
          recapMessages,
        )
      : null;

    if (!sessionSummary && !process) {
      const canonicalProjectId = await getGrokNativeProjectId(
        sessionId,
        projectId as UrlProjectId,
      );
      if (canonicalProjectId) {
        return c.redirect(
          buildGrokNativeRedirectPath(
            canonicalProjectId,
            sessionId,
            "/metadata",
            c.req.url,
          ),
          307,
        );
      }
      return c.json({ error: "Session not found" }, 404);
    }

    const hasUnread = providerUpdatedAt
      ? hasUnreadProviderContent(
          deps.notificationService,
          sessionId,
          providerUpdatedAt,
        )
      : undefined;

    const providerChildren = await resolveProviderChildSessions(
      readerForProviderChildren(
        transcriptProject,
        providerResolutionDeps(deps),
        metadataProvider ?? process?.provider ?? project.provider,
      ),
      sessionId,
      "fresh",
    );

    const response = {
      session: {
        id: sessionId,
        projectId: routing.workingProjectId,
        title: sessionSummary?.title ?? null,
        fullTitle: sessionSummary?.fullTitle ?? null,
        createdAt: sessionSummary?.createdAt ?? new Date().toISOString(),
        updatedAt:
          sessionSummary?.updatedAt ||
          providerUpdatedAt ||
          new Date().toISOString(),
        messageCount: sessionSummary?.messageCount ?? 0,
        provider:
          metadataProvider ??
          process?.provider ??
          sessionSummary?.provider ??
          project.provider,
        model: sessionSummary?.model,
        originator: sessionSummary?.originator,
        cliVersion: sessionSummary?.cliVersion,
        source: sessionSummary?.source,
        approvalPolicy: sessionSummary?.approvalPolicy,
        sandboxPolicy: sessionSummary?.sandboxPolicy,
        contextUsage: sessionSummary?.contextUsage,
        effectiveModelSettings: effectiveModelSettingsFromMetadata(metadata),
        effectiveLaunchSettings: metadata?.effectiveLaunchSettings,
        nonHumanUserTurn: nonHumanUserTurnField(
          deps.sessionMetadataService,
          sessionId,
        ),
        customTitle: metadata?.customTitle,
        isArchived: metadata?.isArchived,
        isStarred: metadata?.isStarred,
        clearloop: deps.clearloopService?.getBadge(sessionId),
        rewindRecordIds: rewindRecordIdsFor(sessionId),
        parentSessionId:
          metadata?.parentSessionId ?? sessionSummary?.parentSessionId,
        parentSessionKind:
          metadata?.parentSessionKind ?? sessionSummary?.parentSessionKind,
        forkedFromSessionId:
          metadata?.forkedFromSessionId ?? sessionSummary?.forkedFromSessionId,
        creationProvenance: metadata?.creationProvenance,
        routerBinding: metadata?.routerBinding,
        initialPrompt:
          metadata?.initialPrompt ?? sessionSummary?.fullTitle ?? undefined,
        heartbeatTurnsEnabled: metadata?.heartbeatTurnsEnabled,
        wakeTurnsEnabled: metadata?.wakeTurnsEnabled,
        heartbeatTurnsAfterMinutes: metadata?.heartbeatTurnsAfterMinutes,
        heartbeatTurnText: metadata?.heartbeatTurnText,
        heartbeatForceAfterMinutes:
          metadata?.heartbeatForceAfterMinutes ?? undefined,
        promptSuggestionMode: metadata?.promptSuggestionMode,
        recapAfterSeconds: metadata?.recapAfterSeconds,
        workingProjectId: metadata?.workingProjectId,
        transcriptProjectId: metadata?.transcriptProjectId,
        workstreamId: metadata?.workstreamId,
        transcriptDisplayObjects: metadata?.transcriptDisplayObjects,
        lastSeenAt,
        hasUnread,
        ...(providerChildren ? { providerChildren } : {}),
      },
      ownership,
      processState: process?.state.type ?? null,
      providerRuntimeStatus,
      pendingInputRequest,
      slashCommands,
      ...(deferredMessages.length > 0 ? { deferredMessages } : {}),
    } satisfies SessionMetadataResponse;

    return c.json(response);
  });

  // PUT /api/projects/:projectId/sessions/:sessionId/project
  // Reclassify a session under a different VIBEALLDAY project without sending any
  // provider-visible turn. The provider transcript remains under
  // transcriptProjectId; relative file links and UI routing use projectId.
  routes.put("/projects/:projectId/sessions/:sessionId/project", async (c) => {
    const projectId = c.req.param("projectId");
    const sessionId = c.req.param("sessionId");

    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }
    if (!deps.sessionMetadataService) {
      return c.json({ error: "Session metadata service unavailable" }, 503);
    }

    let body: { projectId?: unknown };
    try {
      body = await c.req.json<{ projectId?: unknown }>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const targetProjectId = body.projectId;
    if (
      typeof targetProjectId !== "string" ||
      !isUrlProjectId(targetProjectId)
    ) {
      return c.json({ error: "Invalid target project ID format" }, 400);
    }

    const targetProject =
      await deps.scanner.getOrCreateProject(targetProjectId);
    if (!targetProject) {
      return c.json({ error: "Target project not found" }, 404);
    }

    const metadata = deps.sessionMetadataService.getMetadata(sessionId);
    const identity = await resolveExistingSessionIdentity({
      sessionId,
      requestProjectId: projectId,
      metadata: metadata
        ? { ...metadata, workingProjectId: undefined }
        : undefined,
      scanner: deps.scanner,
      providerDeps: providerResolutionDeps(deps),
    });
    if (!identity) {
      return c.json({ error: "Session not found" }, 404);
    }
    const previousWorkingProjectId =
      metadata?.workingProjectId ?? identity.workingProjectId;
    const transcriptProjectId = identity.transcriptProjectId;

    const storedWorkingProjectId =
      targetProjectId === transcriptProjectId ? undefined : targetProjectId;
    const storedTranscriptProjectId =
      targetProjectId === transcriptProjectId ? undefined : transcriptProjectId;

    await deps.sessionMetadataService.setWorkingProject(
      sessionId,
      storedWorkingProjectId,
      storedTranscriptProjectId,
    );
    deps.projectQueueScheduler?.sessionProjectChanged(
      previousWorkingProjectId,
      targetProjectId,
    );

    deps.eventBus?.emit({
      type: "session-metadata-changed",
      sessionId,
      projectId: targetProjectId,
      transcriptProjectId: storedTranscriptProjectId ?? null,
      timestamp: new Date().toISOString(),
    });

    return c.json({
      updated: true,
      projectId: targetProjectId,
      transcriptProjectId: storedTranscriptProjectId ?? null,
    });
  });

  // POST /api/projects/:projectId/sessions/:sessionId/refresh-preview
  // On-demand recompute of the hover-card recent-activity excerpt for a
  // non-running session (its live state is otherwise only refreshed when the
  // session is resumed). Fast reverse-scan of the JSONL, then push the result
  // to lists/hovers via a session-updated event so the preview updates in
  // place without flicker. See topics/session-hovercard-recent-activity.md.
  routes.post(
    "/projects/:projectId/sessions/:sessionId/refresh-preview",
    async (c) => {
      const projectId = c.req.param("projectId");
      const sessionId = c.req.param("sessionId");
      if (!isUrlProjectId(projectId)) {
        return c.json({ error: "Invalid project ID format" }, 400);
      }
      const routing = await resolveSessionProjectRouting(
        projectId as UrlProjectId,
        sessionId,
      );
      if ("redirectProjectId" in routing) {
        return c.redirect(
          buildSessionProjectRedirectPath(
            routing.redirectProjectId,
            sessionId,
            "/refresh-preview",
            c.req.url,
          ),
          307,
        );
      }
      if ("error" in routing) {
        return c.json({ error: routing.error }, routing.status);
      }
      const transcriptProject = routing.transcriptProject;
      const transcriptProjectId = routing.transcriptProjectId;
      const metadataProvider = deps.sessionMetadataService?.getProvider(
        sessionId,
      ) as ProviderName | undefined;
      const recapMessages =
        deps.sessionMetadataService?.getRecapMessages?.(sessionId) ?? [];
      let lastAgentText: string | undefined;
      if (recapMessages.length > 0) {
        const summaryResult = await findSessionSummaryAcrossProviders(
          transcriptProject,
          sessionId,
          transcriptProjectId,
          providerResolutionDeps(deps),
          metadataProvider,
        );
        if (summaryResult?.summary) {
          lastAgentText = applyRecapOverlayToSummary(
            summaryResult.summary,
            recapMessages,
          ).lastAgentText;
        }
      }

      // Claude uses the fast reverse-scan when there is no durable overlay to
      // compare; every other provider goes through the cross-provider load +
      // normalize, then a shared extractor on the uniform message form.
      const reader = deps.readerFactory(transcriptProject);
      lastAgentText ??= reader.getLastAgentExcerpt
        ? await reader.getLastAgentExcerpt(sessionId)
        : undefined;
      if (lastAgentText === undefined) {
        const normalized = await loadRestartSourceSession(
          transcriptProject,
          sessionId,
          transcriptProjectId,
          metadataProvider,
        );
        if (normalized) {
          lastAgentText = extractLastAgentExcerpt(normalized.messages);
        }
      }
      if (lastAgentText !== undefined) {
        deps.eventBus?.emit({
          type: "session-updated",
          sessionId,
          projectId: routing.workingProjectId,
          lastAgentText,
          timestamp: new Date().toISOString(),
        });
      }
      return c.json({ lastAgentText: lastAgentText ?? null });
    },
  );

  // GET /api/projects/:projectId/sessions/:sessionId - Get session detail
  // Optional query params:
  //   ?afterMessageId=<id> - incremental forward-fetch (append new messages)
  //   ?tailCompactions=<n> - return only last N compact boundaries worth of messages
  //   ?beforeMessageId=<id> - cursor for loading older chunks (used with tailCompactions)
  //   ?tailTurns=<n> - recent-turn selector within the authorized history scope
  //   ?tailFrom=<id> - start selector within the authorized history scope
  //   ?fullHistory=1 - explicitly authorize selectors to inspect full history
  routes.get("/projects/:projectId/sessions/:sessionId", async (c) => {
    const requestStartMs = performance.now();
    const projectId = c.req.param("projectId");
    const sessionId = c.req.param("sessionId");
    const afterMessageId = c.req.query("afterMessageId");
    const publicShare = c.req.query("publicShare") === "1";
    const fullHistory = c.req.query("fullHistory") === "1";
    const fullHistoryReason = c.req.query("fullHistoryReason");
    const tailCompactionsParam = c.req.query("tailCompactions");
    const beforeMessageId = c.req.query("beforeMessageId");
    const tailTurnsParam = c.req.query("tailTurns");
    const tailFrom = c.req.query("tailFrom");
    const tailCompactions =
      tailCompactionsParam !== undefined
        ? Number.parseInt(tailCompactionsParam, 10)
        : undefined;
    const tailTurns =
      tailTurnsParam !== undefined
        ? Number.parseInt(tailTurnsParam, 10)
        : undefined;
    const requestedTailCompactions =
      tailCompactions !== undefined &&
      !Number.isNaN(tailCompactions) &&
      tailCompactions > 0
        ? tailCompactions
        : undefined;
    const requestedTailTurns =
      tailTurns !== undefined && !Number.isNaN(tailTurns) && tailTurns > 0
        ? tailTurns
        : undefined;
    const defaultedToCompactTail =
      !fullHistory && !afterMessageId && requestedTailCompactions === undefined;
    const unboundedRequestDefaultedToCompactTail =
      defaultedToCompactTail && !tailFrom && requestedTailTurns === undefined;
    const effectiveTailCompactions =
      requestedTailCompactions ??
      (defaultedToCompactTail
        ? DEFAULT_SESSION_DETAIL_TAIL_COMPACTIONS
        : undefined);

    // Validate projectId format at API boundary
    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }

    const routing = await resolveSessionProjectRouting(
      projectId as UrlProjectId,
      sessionId,
    );
    if ("redirectProjectId" in routing) {
      return c.redirect(
        buildSessionProjectRedirectPath(
          routing.redirectProjectId,
          sessionId,
          "",
          c.req.url,
        ),
        307,
      );
    }
    if ("error" in routing) {
      return c.json({ error: routing.error }, routing.status);
    }
    const project = routing.workingProject;
    const effectiveProjectId = routing.workingProjectId;
    const transcriptProject = routing.transcriptProject;
    const transcriptProjectId = routing.transcriptProjectId;
    const projectResolvedMs = performance.now();

    // Check if session is actively owned by a process
    const process = deps.supervisor.getProcessForSession(sessionId);

    // Check if session is being controlled by an external program
    const isExternal = deps.externalTracker?.isExternal(sessionId) ?? false;

    // Check if we've ever owned this session (for orphan detection)
    // Only mark tools as "aborted" if we owned the session and know it terminated
    const wasEverOwned = deps.supervisor.wasEverOwned(sessionId);
    const metadataProvider = deps.sessionMetadataService?.getProvider(
      sessionId,
    ) as ProviderName | undefined;
    const recapMessages =
      deps.sessionMetadataService?.getRecapMessages?.(sessionId) ?? [];
    const syntheticDoneMessages =
      deps.sessionMetadataService?.getSyntheticDoneMessages?.(sessionId) ?? [];
    const localCommandMessages =
      deps.sessionMetadataService?.getLocalCommandMessages?.(sessionId) ?? [];
    const overlayCursor = findDurableOverlayCursor(afterMessageId, [
      ...recapMessages,
      ...syntheticDoneMessages,
      ...localCommandMessages,
    ]);
    const providerAfterMessageId = overlayCursor ? undefined : afterMessageId;
    const primaryReaderAfterMessageId =
      isClaudeSdkProviderName(project.provider) ||
      isClaudeSdkProviderName(metadataProvider)
        ? undefined
        : providerAfterMessageId;

    const loadedSession = await loadProviderSession(
      transcriptProject,
      sessionId,
      transcriptProjectId,
      metadataProvider ?? process?.provider,
      primaryReaderAfterMessageId,
      {
        // Only include orphaned tool info if:
        // 1. We previously owned this session (not external)
        // 2. No active process (tools aren't potentially in progress)
        // When we own the session, tools without results might be pending approval
        includeOrphans: wasEverOwned && !process,
        ...(process?.state.type === "in-turn" ||
        process?.state.type === "waiting-input"
          ? { ownedTurnInProgress: true }
          : {}),
        ...(!fullHistory &&
        ((!afterMessageId && effectiveTailCompactions !== undefined) ||
          primaryReaderAfterMessageId)
          ? {
              tailCompactions:
                effectiveTailCompactions ??
                DEFAULT_SESSION_DETAIL_TAIL_COMPACTIONS,
              ...(!afterMessageId && beforeMessageId
                ? { beforeMessageId }
                : {}),
            }
          : {}),
      },
    );

    const readEndMs = performance.now();

    let session = loadedSession
      ? normalizeSession(loadedSession, {
          rewindRecords:
            deps.sessionMetadataService?.getRewindRecords?.(sessionId),
        })
      : null;
    const explicitProvider = metadataProvider ?? process?.provider;
    if (session && explicitProvider) {
      session = { ...session, provider: explicitProvider };
    }
    const normalizedMessageCount = session?.messages.length ?? 0;
    const normalizeEndMs = performance.now();
    if (session && isClaudeSdkProviderName(session.provider)) {
      session = {
        ...session,
        messages: projectTaskListSnapshots(session.messages),
      };
    }
    let incrementalAnchorFound = false;
    if (session && providerAfterMessageId) {
      const sliced = sliceAfterMessageIdWithMatch(
        session.messages,
        providerAfterMessageId,
      );
      session = {
        ...session,
        messages: sliced.messages,
      };
      incrementalAnchorFound = sliced.found;
    }

    // Determine the session ownership
    const ownership = sessionOwnershipFromProcess(process, {
      isExternal,
      fallback: session?.ownership,
    });

    // Get pending input request from active process (for tool approval prompts)
    // This ensures clients get pending requests immediately without waiting for SSE
    const pendingInputRequest =
      process?.state.type === "waiting-input" ? process.state.request : null;
    const providerRuntimeStatus =
      deps.supervisor.getProviderRuntimeStatusForSession?.(sessionId) ??
      process?.getProviderRuntimeStatus() ??
      null;

    // Get available slash commands (for "/" button and typed slash menu)
    // The init message that normally carries these gets discarded from the SSE buffer
    // after ~30s, so we attach them to the REST response. Providers with known
    // native built-ins, such as Codex, can expose those while stopped.
    const metadataStartMs = performance.now();
    const slashCommands = await getSessionSlashCommands(
      process,
      process?.provider ??
        session?.provider ??
        metadataProvider ??
        project.provider,
      deps.sessionMetadataService?.getMetadata(sessionId),
    );
    const deferredMessages = sessionQueueSummaries(deps, sessionId, process);
    const providerChildren = await resolveProviderChildSessions(
      readerForProviderChildren(
        transcriptProject,
        providerResolutionDeps(deps),
        metadataProvider ?? process?.provider ?? project.provider,
      ),
      sessionId,
      "fresh",
    );

    const metadataMs = performance.now() - metadataStartMs;

    if (!session) {
      // Session file doesn't exist yet - only valid if we own the process
      if (process) {
        // Keep Process history as provider-owned replay state. Presentation fields
        // are computed on a detached client projection, as on file-backed reads.
        const sdkMessages = process.getMessageHistory();
        const transcriptSnapshotUpdatedAt =
          process.lastProviderContentTime?.toISOString() ??
          process.startedAt.toISOString();
        const processMessages = sdkMessagesToClientMessages(
          structuredClone(sdkMessages),
        );
        if (isClaudeSdkProviderName(process.provider)) {
          augmentTaskListSnapshots(processMessages);
        }
        if (publicShare) {
          await augmentEditToolUses(processMessages);
        } else {
          const pathIndex = await tryClaimProjectPathIndex(project.path);
          try {
            await augmentPersistedSessionMessages(processMessages, {
              projectFileLinks: {
                projectId: effectiveProjectId,
                projectPath: project.path,
                ...(pathIndex ? { index: pathIndex } : {}),
                resolveAbsoluteFilePaths: deps.resolveAbsoluteFilePaths,
              },
            });
          } finally {
            pathIndex?.release();
          }
        }
        // Extract context usage from raw SDK messages (has usage field)
        // Use process.contextWindow (captured from result messages) as primary source
        const mis = deps.modelInfoService;
        const sdkContextWindow = process.contextWindow;
        const contextUsage = extractContextUsageFromSDKMessages(
          sdkMessages,
          process.resolvedModel,
          process.provider,
          sdkContextWindow
            ? () => sdkContextWindow
            : mis
              ? (m, p) => mis.getContextWindow(m, p)
              : undefined,
        );
        // (Durable recording happens at the observation point in Process via
        // onContextWindowObserved, not as a side effect of this GET.)
        // Get metadata even for new sessions (in case it was set before file was written)
        const metadata = deps.sessionMetadataService?.getMetadata(sessionId);
        const recapMessages =
          deps.sessionMetadataService?.getRecapMessages?.(sessionId) ?? [];
        const syntheticDoneMessages =
          deps.sessionMetadataService?.getSyntheticDoneMessages?.(sessionId) ??
          [];
        const visibleProcessMessages = mergeSessionOverlayMessages(
          processMessages,
          recapMessages,
          syntheticDoneMessages,
          localCommandMessages,
        );
        // Get notification data for new sessions too
        const lastSeenEntry = deps.notificationService?.getLastSeen(sessionId);
        const latestRecap = latestRecapMessage(recapMessages);
        const newSessionUpdatedAt =
          latestRecap?.timestamp ?? new Date().toISOString();
        const publicShareCompletedMessageCount =
          publicShare && fullHistory
            ? completedPublicShareMessageCount({
                messages: visibleProcessMessages,
                process,
                sourceIsExternal: false,
                sourceUpdatedAt: newSessionUpdatedAt,
                hasDurableHistory: false,
              })
            : undefined;
        const hasUnread = deps.notificationService
          ? deps.notificationService.hasUnread(sessionId, newSessionUpdatedAt)
          : undefined;
        return c.json({
          session: {
            id: sessionId,
            projectId: effectiveProjectId,
            title: null,
            createdAt: new Date().toISOString(),
            updatedAt: newSessionUpdatedAt,
            messageCount: processMessages.length,
            ownership,
            nonHumanUserTurn: nonHumanUserTurnField(
              deps.sessionMetadataService,
              sessionId,
            ),
            customTitle: metadata?.customTitle,
            isArchived: metadata?.isArchived,
            isStarred: metadata?.isStarred,
            clearloop: deps.clearloopService?.getBadge(sessionId),
            rewindRecordIds: rewindRecordIdsFor(sessionId),
            parentSessionId: metadata?.parentSessionId,
            parentSessionKind: metadata?.parentSessionKind,
            forkedFromSessionId: metadata?.forkedFromSessionId,
            creationProvenance: metadata?.creationProvenance,
            routerBinding: metadata?.routerBinding,
            initialPrompt: metadata?.initialPrompt,
            heartbeatTurnsEnabled: metadata?.heartbeatTurnsEnabled,
            wakeTurnsEnabled: metadata?.wakeTurnsEnabled,
            heartbeatTurnsAfterMinutes: metadata?.heartbeatTurnsAfterMinutes,
            heartbeatTurnText: metadata?.heartbeatTurnText,
            heartbeatForceAfterMinutes: metadata?.heartbeatForceAfterMinutes,
            promptSuggestionMode: metadata?.promptSuggestionMode,
            recapAfterSeconds: metadata?.recapAfterSeconds,
            workingProjectId: metadata?.workingProjectId,
            transcriptProjectId: metadata?.transcriptProjectId,
            workstreamId: metadata?.workstreamId,
            transcriptDisplayObjects: metadata?.transcriptDisplayObjects,
            lastSeenAt: lastSeenEntry?.timestamp,
            hasUnread,
            provider: process.provider,
            model: process.resolvedModel,
            effectiveModelSettings:
              effectiveModelSettingsFromMetadata(metadata),
            effectiveLaunchSettings: metadata?.effectiveLaunchSettings,
            contextUsage,
            ...(providerChildren ? { providerChildren } : {}),
          },
          messages: visibleProcessMessages,
          transcriptSnapshotUpdatedAt,
          ownership,
          providerRuntimeStatus,
          pendingInputRequest,
          slashCommands,
          ...(publicShareCompletedMessageCount !== undefined
            ? {
                publicShareCapture: {
                  completedMessageCount: publicShareCompletedMessageCount,
                },
              }
            : {}),
          ...(deferredMessages.length > 0 ? { deferredMessages } : {}),
        });
      }
      const canonicalProjectId = await getGrokNativeProjectId(
        sessionId,
        projectId as UrlProjectId,
      );
      if (canonicalProjectId) {
        return c.redirect(
          buildGrokNativeRedirectPath(
            canonicalProjectId,
            sessionId,
            "",
            c.req.url,
          ),
          307,
        );
      }
      return c.json({ error: "Session not found" }, 404);
    }
    if (!loadedSession) {
      throw new Error("Normalized session is missing its reader snapshot");
    }

    // Get session metadata (custom title, archived, starred)
    const metadata = deps.sessionMetadataService?.getMetadata(sessionId);

    // Get notification data (lastSeenAt, hasUnread)
    const lastSeenEntry = deps.notificationService?.getLastSeen(sessionId);
    const lastSeenAt = lastSeenEntry?.timestamp;

    // Apply pagination BEFORE expensive augmentation. Compact boundaries set
    // the authorized history scope by default; turn selectors may narrow that
    // scope but cannot broaden it unless fullHistory=1 removed the default.
    // Skip initial-window slicing for incremental forward fetches. A provider-
    // bounded older page already ends before its requested cursor.
    const providerBoundedOlderPage =
      loadedSession.readWindow?.kind === "compact-page";
    let paginationInfo: PaginationInfo | undefined;
    if (
      !afterMessageId &&
      effectiveTailCompactions !== undefined &&
      !beforeMessageId &&
      (tailFrom || requestedTailTurns !== undefined)
    ) {
      const sliced = sliceAtCompactAndUserTurnBoundaries(
        session.messages,
        effectiveTailCompactions,
        requestedTailTurns ?? 20,
        tailFrom,
      );
      session = { ...session, messages: sliced.messages };
      paginationInfo = sliced.pagination;
    } else if (
      !afterMessageId &&
      effectiveTailCompactions === undefined &&
      (tailFrom || requestedTailTurns !== undefined)
    ) {
      const sliced = sliceAtUserTurnBoundary(
        session.messages,
        requestedTailTurns ?? 20,
        tailFrom,
      );
      session = { ...session, messages: sliced.messages };
      paginationInfo = sliced.pagination;
    } else if (effectiveTailCompactions !== undefined && !afterMessageId) {
      const sliced = sliceAtCompactBoundaries(
        session.messages,
        effectiveTailCompactions,
        providerBoundedOlderPage ? undefined : beforeMessageId,
      );
      session = { ...session, messages: sliced.messages };
      paginationInfo = sliced.pagination;
    }
    if (
      loadedSession.readWindow &&
      paginationInfo?.hasOlderMessages &&
      (session.provider === "codex" || session.provider === "codex-oss")
    ) {
      const firstMessage = session.messages[0];
      const sourceCursor = firstMessage
        ? getCodexMessageSourceByteCursor(firstMessage)
        : undefined;
      if (!sourceCursor) {
        throw new Error(
          "Provider compact-window read did not expose its source cursor",
        );
      }
      paginationInfo = {
        ...paginationInfo,
        truncatedBeforeMessageId: sourceCursor,
      };
    }
    if (
      loadedSession.readWindow &&
      !incrementalAnchorFound &&
      (paginationInfo?.hasOlderMessages !==
        loadedSession.readWindow.omittedPrefix ||
        (loadedSession.readWindow.omittedPrefix &&
          paginationInfo.truncatedBeforeMessageId === undefined))
    ) {
      throw new Error(
        "Provider compact-window read did not preserve its older-history boundary",
      );
    }
    // Codex normalized IDs can drift between stream and JSONL. If an
    // incremental request misses its anchor, never return the full historical
    // session into a compact-tail client; bound the fallback to the same tail
    // window used for initial loads.
    if (providerAfterMessageId && !incrementalAnchorFound) {
      const sliced = sliceAtCompactBoundaries(
        session.messages,
        effectiveTailCompactions ?? DEFAULT_SESSION_DETAIL_TAIL_COMPACTIONS,
      );
      session = { ...session, messages: sliced.messages };
      paginationInfo = sliced.pagination;
    }
    const sliceEndMs = performance.now();

    if (!publicShare) {
      deps.onIssueWindow?.(
        {
          sessionId: process?.sessionId ?? session.id,
          projectId: effectiveProjectId,
        },
        session.messages,
      );
    }

    // Normalization carries sanitized inline image bytes as private symbol
    // metadata. Consume those candidates before generic response detachment,
    // which intentionally retains only serializable fields. The materializer
    // is copy-on-write and does not mutate provider-reader cache objects.
    if (!publicShare && deps.toolResultMediaStore) {
      session = {
        ...session,
        messages: await deps.toolResultMediaStore
          .createMaterializer({
            provider: session.provider,
            projectId: effectiveProjectId,
            projectPath: project.path,
            getSessionId: () => sessionId,
          })
          .materializeMessages(session.messages),
      };
    }

    // Normalized messages may be shared by the parsed-transcript cache, and
    // several provider readers expose stable message objects directly.
    // Route-specific HTML, tool, media, and pruning fields belong only to this
    // response projection.
    session = {
      ...session,
      messages: detachSessionMessageProjection(session.messages),
    };
    if (isClaudeSdkProviderName(session.provider)) {
      pruneTaskListSnapshotsToLatest(session.messages);
    }

    // Keep persisted rendering in lockstep with stream augmentation behavior.
    let augmentDiagnostics: PersistedAugmentDiagnostics | undefined;
    if (publicShare) {
      await augmentEditToolUses(session.messages);
    } else {
      const pathIndex = await tryClaimProjectPathIndex(project.path);
      try {
        augmentDiagnostics = await augmentPersistedSessionMessages(
          session.messages,
          {
            projectFileLinks: {
              projectId: effectiveProjectId,
              projectPath: project.path,
              ...(pathIndex ? { index: pathIndex } : {}),
              resolveAbsoluteFilePaths: deps.resolveAbsoluteFilePaths,
            },
          },
          { delayMs: deps.persistedAugmentDelayMs },
        );
      } finally {
        pathIndex?.release();
      }
    }
    // The overlay reassigns `session` below; hasUnreadProviderContent needs
    // the pre-overlay timestamp.
    const preRecapUpdatedAt = getEffectiveProviderUpdatedAt(
      session.updatedAt,
      process,
    );
    session = {
      ...session,
      updatedAt: preRecapUpdatedAt,
      messages: mergeLocalCommandMessages(
        session.messages,
        localCommandMessages,
        {
          hasOlderMessages: Boolean(
            (afterMessageId && !overlayCursor) ||
              paginationInfo?.hasOlderMessages ||
              loadedSession.readWindow?.omittedPrefix,
          ),
          hasNewerMessages: Boolean(beforeMessageId),
        },
      ),
    };
    if (!beforeMessageId) {
      session = applySessionOverlaysToSession(
        session,
        recapMessages,
        syntheticDoneMessages,
      );
      if (overlayCursor && afterMessageId) {
        const sliced = sliceAfterDurableOverlayCursor({
          messages: session.messages,
          overlay: overlayCursor,
          cursorId: afterMessageId,
        });
        session = { ...session, messages: sliced.messages };
        incrementalAnchorFound = sliced.found;
      }
    } else {
      session = applyRecapOverlayToSummary(session, recapMessages);
    }
    const augmentEndMs = performance.now();

    const hasUnread = hasUnreadProviderContent(
      deps.notificationService,
      sessionId,
      preRecapUpdatedAt,
    );

    // Override context usage with SDK-reported context window from live process
    // The reader uses hardcoded defaults; the process captures the real value at runtime
    let { contextUsage } = session;
    if (process?.contextWindow && contextUsage) {
      const cw = process.contextWindow;
      contextUsage = {
        ...contextUsage,
        percentage: Math.round((contextUsage.inputTokens / cw) * 100),
        contextWindow: cw,
      };
      // Durable recording happens at the observation point in Process via
      // onContextWindowObserved; this block only overrides the displayed value.
    }

    const { messages: _messages, ...sessionMetadata } = session;
    const totalMs = performance.now() - requestStartMs;
    const detailTimings = {
      augment: roundedMs(augmentEndMs - sliceEndMs),
      metadata: roundedMs(metadataMs),
      normalize: roundedMs(normalizeEndMs - readEndMs),
      project: roundedMs(projectResolvedMs - requestStartMs),
      read: roundedMs(readEndMs - projectResolvedMs),
      route: roundedMs(sliceEndMs - normalizeEndMs - metadataMs),
      total: roundedMs(totalMs),
    };
    c.header(
      "Server-Timing",
      Object.entries(detailTimings)
        .map(([name, duration]) => {
          const description =
            name === "augment" && augmentDiagnostics
              ? `;desc="messages=${augmentDiagnostics.inputMessages} changed=${augmentDiagnostics.changedMessages} cache-hit=${augmentDiagnostics.cacheHits} cache-join=${augmentDiagnostics.cacheJoins} cache-miss=${augmentDiagnostics.cacheMisses}"`
              : "";
          return `vibeallday-${name};dur=${duration}${description}`;
        })
        .join(", "),
    );
    if (
      unboundedRequestDefaultedToCompactTail &&
      normalizedMessageCount >= LARGE_FULL_HISTORY_MESSAGE_THRESHOLD
    ) {
      getLogger().warn(
        {
          beforeMessageId: beforeMessageId ?? null,
          defaultTailCompactions: DEFAULT_SESSION_DETAIL_TAIL_COMPACTIONS,
          event: "session_detail_unbounded_defaulted_to_tail",
          normalizedMessageCount,
          projectId: effectiveProjectId,
          transcriptProjectId,
          provider: session.provider,
          publicShare,
          returnedMessageCount: session.messages.length,
          sessionId,
          timings: {
            augmentMs: roundedMs(augmentEndMs - sliceEndMs),
            metadataMs: roundedMs(metadataMs),
            normalizeMs: roundedMs(normalizeEndMs - readEndMs),
            projectMs: roundedMs(projectResolvedMs - requestStartMs),
            readMs: roundedMs(readEndMs - projectResolvedMs),
            routeMs: roundedMs(sliceEndMs - normalizeEndMs - metadataMs),
            totalMs: roundedMs(totalMs),
          },
          totalMessageCount: session.messageCount,
        },
        "SESSION_DETAIL: defaulted unbounded request to compact tail",
      );
    }
    if (
      fullHistory &&
      session.messages.length >= LARGE_FULL_HISTORY_MESSAGE_THRESHOLD
    ) {
      getLogger().warn(
        {
          event: "session_detail_full_history_large",
          fullHistoryReason: fullHistoryReason ?? null,
          normalizedMessageCount,
          projectId: effectiveProjectId,
          transcriptProjectId,
          provider: session.provider,
          publicShare,
          returnedMessageCount: session.messages.length,
          sessionId,
          timings: {
            augmentMs: roundedMs(augmentEndMs - sliceEndMs),
            metadataMs: roundedMs(metadataMs),
            normalizeMs: roundedMs(normalizeEndMs - readEndMs),
            projectMs: roundedMs(projectResolvedMs - requestStartMs),
            readMs: roundedMs(readEndMs - projectResolvedMs),
            routeMs: roundedMs(sliceEndMs - normalizeEndMs - metadataMs),
            totalMs: roundedMs(totalMs),
          },
          totalMessageCount: session.messageCount,
        },
        "SESSION_DETAIL: large explicit full-history request",
      );
    }
    if (totalMs >= SESSION_DETAIL_SLOW_LOG_MS) {
      getLogger().warn(
        {
          afterMessageId: afterMessageId ?? null,
          beforeMessageId: beforeMessageId ?? null,
          event: "session_detail_slow",
          defaultedToCompactTail,
          fullHistory,
          fullHistoryReason: fullHistoryReason ?? null,
          incrementalAnchorFound: afterMessageId
            ? incrementalAnchorFound
            : null,
          normalizedMessageCount,
          owned: Boolean(process),
          processState: process?.state.type ?? null,
          projectId: effectiveProjectId,
          transcriptProjectId,
          provider: session.provider,
          publicShare,
          returnedMessageCount: session.messages.length,
          sessionId,
          tailCompactions: effectiveTailCompactions ?? null,
          tailTurns: requestedTailTurns ?? null,
          timings: {
            augmentMs: roundedMs(augmentEndMs - sliceEndMs),
            metadataMs: roundedMs(metadataMs),
            normalizeMs: roundedMs(normalizeEndMs - readEndMs),
            projectMs: roundedMs(projectResolvedMs - requestStartMs),
            readMs: roundedMs(readEndMs - projectResolvedMs),
            routeMs: roundedMs(sliceEndMs - normalizeEndMs - metadataMs),
            totalMs: roundedMs(totalMs),
          },
          totalMessageCount: session.messageCount,
        },
        "SESSION_DETAIL: slow request",
      );
    }

    const publicShareCompletedMessageCount =
      publicShare && fullHistory
        ? completedPublicShareMessageCount({
            messages: session.messages,
            process,
            sourceIsExternal: isExternal,
            sourceUpdatedAt: session.updatedAt,
            hasDurableHistory: true,
          })
        : undefined;

    return c.json({
      session: {
        ...sessionMetadata,
        projectId: effectiveProjectId,
        nonHumanUserTurn: nonHumanUserTurnField(
          deps.sessionMetadataService,
          sessionId,
        ),
        ownership,
        contextUsage,
        customTitle: metadata?.customTitle,
        isArchived: metadata?.isArchived,
        isStarred: metadata?.isStarred,
        clearloop: deps.clearloopService?.getBadge(sessionId),
        rewindRecordIds: rewindRecordIdsFor(sessionId),
        parentSessionId: metadata?.parentSessionId ?? session.parentSessionId,
        parentSessionKind:
          metadata?.parentSessionKind ?? session.parentSessionKind,
        forkedFromSessionId:
          metadata?.forkedFromSessionId ?? session.forkedFromSessionId,
        creationProvenance: metadata?.creationProvenance,
        routerBinding: metadata?.routerBinding,
        initialPrompt: metadata?.initialPrompt ?? session.fullTitle,
        heartbeatTurnsEnabled: metadata?.heartbeatTurnsEnabled,
        wakeTurnsEnabled: metadata?.wakeTurnsEnabled,
        heartbeatTurnsAfterMinutes: metadata?.heartbeatTurnsAfterMinutes,
        heartbeatTurnText: metadata?.heartbeatTurnText,
        heartbeatForceAfterMinutes: metadata?.heartbeatForceAfterMinutes,
        promptSuggestionMode: metadata?.promptSuggestionMode,
        recapAfterSeconds: metadata?.recapAfterSeconds,
        workingProjectId: metadata?.workingProjectId,
        transcriptProjectId: metadata?.transcriptProjectId,
        workstreamId: metadata?.workstreamId,
        transcriptDisplayObjects: metadata?.transcriptDisplayObjects,
        // Model comes from the session reader (extracted from JSONL)
        model: session.model,
        effectiveModelSettings: effectiveModelSettingsFromMetadata(metadata),
        effectiveLaunchSettings: metadata?.effectiveLaunchSettings,
        lastSeenAt,
        hasUnread,
        ...(providerChildren ? { providerChildren } : {}),
      },
      messages: session.messages,
      transcriptSnapshotUpdatedAt: loadedSession.transcriptSnapshotUpdatedAt,
      ownership,
      providerRuntimeStatus,
      pendingInputRequest,
      slashCommands,
      ...(publicShareCompletedMessageCount !== undefined
        ? {
            publicShareCapture: {
              completedMessageCount: publicShareCompletedMessageCount,
            },
          }
        : {}),
      ...(paginationInfo && { pagination: paginationInfo }),
      ...(deferredMessages.length > 0 ? { deferredMessages } : {}),
    });
  });

  // POST /api/projects/:projectId/sessions - Start new session
  routes.post("/projects/:projectId/sessions", async (c) => {
    const projectId = c.req.param("projectId");

    // Validate projectId format at API boundary
    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }

    // Use getOrCreateProject to allow starting sessions in new directories
    const project = await deps.scanner.getOrCreateProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found or path does not exist" }, 404);
    }

    let body: StartSessionBody;
    try {
      body = await c.req.json<StartSessionBody>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (
      body.machineControl !== undefined &&
      typeof body.machineControl !== "boolean"
    )
      return c.json({ error: "machineControl must be a boolean" }, 400);
    if (body.computerControl)
      return c.json({ error: RETIRED_COMPUTER_CONTROL_ERROR }, 400);

    const modeError = permissionModeError(body.mode);
    if (modeError) {
      return c.json({ error: modeError }, 400);
    }

    if (!hasSessionMessageContent(body)) {
      return c.json({ error: "Message is required" }, 400);
    }
    const { executor, error: executorError } = parseOptionalExecutor(
      body.executor,
    );
    if (executorError) {
      return c.json({ error: executorError }, 400);
    }
    // A limited user's session is sandboxed and obeys their lock, decided
    // here rather than in the form (topics/limited-users.md § Delivery v1).
    const limitedLaunch = applyLimitedLaunchPolicy(c, body);
    if (limitedLaunch.kind === "error") {
      return c.json({ error: limitedLaunch.error }, 403);
    }
    const sandboxSelection = parseSessionSandboxLevel(
      body.sandboxLevel,
      body.sandboxNetworkFirewall,
    );
    if ("error" in sandboxSelection) {
      return c.json({ error: sandboxSelection.error }, 400);
    }
    const helperSettings = parseHelperSettings(body);
    if (helperSettings.error) {
      return c.json({ error: helperSettings.error }, 400);
    }
    const sandboxSettingsError = getSessionSandboxSettingsError(
      sandboxSelection.sandboxLevel,
      helperSettings.recapMode,
    );
    if (sandboxSettingsError) {
      return c.json({ error: sandboxSettingsError }, 400);
    }
    const workstreamTarget = resolveLaunchWorkstreamTarget(
      project,
      body.workstreamId,
    );
    if ("error" in workstreamTarget) {
      return c.json({ error: workstreamTarget.error }, workstreamTarget.status);
    }

    const serverTimestamp = Date.now();
    const userMessage: UserMessage = {
      text: body.message,
      images: body.images,
      documents: body.documents,
      attachments: body.attachments,
      mode: body.mode,
      tempId: body.tempId,
      metadata: buildUserMessageMetadata(
        body,
        serverTimestamp,
        "direct",
        actingUsername(c),
      ),
    };

    const { thinking, effort, ultracode } = buildThinkingOptions(body);

    // Convert model option (undefined or "default" means use CLI default)
    const model =
      body.model && body.model !== "default" ? body.model : undefined;
    const serviceTier = normalizeOptionalServiceTier(body.serviceTier);

    // Debug: log what we received
    console.log("[startSession] Request body:", {
      provider: body.provider,
      executor,
      model: body.model,
      serviceTier,
    });

    const result = await deps.supervisor.startSession(
      workstreamTarget.projectPath,
      userMessage,
      body.mode,
      {
        model,
        requestedModel: body.model,
        serviceTier,
        thinking,
        effort,
        ultracode,
        providerName: body.provider,
        routerAccountId: body.routerAccountId,
        routerPoolId: body.routerPoolId,
        routerPolicy: body.routerPolicy,
        computerControl: body.computerControl,
        machineControl: body.machineControl,
        desktopControlOrigin:
          body.machineControl === true ? desktopControlOrigin(c) : undefined,
        executor,
        sandboxLevel: sandboxSelection.sandboxLevel,
        sandboxNetworkFirewall: sandboxSelection.sandboxNetworkFirewall,
        instructionUsername: actingUsername(c),
        globalInstructions: getGlobalInstructions(),
        permissions: body.permissions,
        recapMode: helperSettings.recapMode,
        recapAfterSeconds: helperSettings.recapAfterSeconds,
        promptSuggestionMode: helperSettings.promptSuggestionMode,
        helperSideModel: helperSettings.helperSideModel,
        ...resolveCompactModelSettings(deps, {
          provider: body.provider ?? project.provider,
          vibeAllDayModelId: body.model,
          modelCandidates: [body.model, model],
        }),
      },
      {
        projectId: project.id,
        workstreamId: workstreamTarget.workstreamId,
        onStarted: (_sessionId, process) =>
          recordNewSessionLaunch(process, {
            heartbeatProjectId: project.id,
            creationProvenance: body.creationProvenance,
            createdByUser:
              limitedLaunch.kind === "applied"
                ? limitedLaunch.username
                : undefined,
            provider: body.provider,
            executor,
            initialPrompt: body.message,
            requestedModel: body.model,
            recapAfterSeconds: helperSettings.recapAfterSeconds,
            workstreamId: workstreamTarget.workstreamId,
            sandbox: {
              level: sandboxSelection.sandboxLevel,
              networkFirewall: sandboxSelection.sandboxNetworkFirewall,
            },
          }),
      },
    );

    // Check if queue is full
    if (isQueueFullResponse(result)) {
      return c.json(
        { error: "Queue is full", maxQueueSize: result.maxQueueSize },
        503,
      );
    }

    // Accepted, whether it starts now or waits for a worker.
    void deps.userUsageService?.recordSession(actingUsername(c));
    void deps.userUsageService?.recordTurn(actingUsername(c), userMessage.text);

    // Check if request was queued
    if (isQueuedResponse(result)) {
      return c.json({ ...result, serverTimestamp }, 202); // 202 Accepted - queued for processing
    }

    return c.json({
      sessionId: result.sessionId,
      processId: result.id,
      projectId: result.projectId,
      permissionMode: result.permissionMode,
      appliedPermissionMode: result.appliedPermissionMode,
      modeVersion: result.modeVersion,
      recapAfterSeconds: result.recapAfterSeconds,
      sandboxEnforcement: result.sandboxEnforcement,
      serverTimestamp,
    });
  });

  // POST /api/projects/:projectId/sessions/create - Create session without starting agent
  // Used for two-phase flow: create session first, upload files, then send first message
  routes.post("/projects/:projectId/sessions/create", async (c) => {
    const projectId = c.req.param("projectId");

    // Validate projectId format at API boundary
    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }

    // Use getOrCreateProject to allow starting sessions in new directories
    const project = await deps.scanner.getOrCreateProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found or path does not exist" }, 404);
    }

    let body: CreateSessionBody = {};
    try {
      body = await c.req.json<CreateSessionBody>();
    } catch {
      // Body is optional for this endpoint
    }

    if (
      body.machineControl !== undefined &&
      typeof body.machineControl !== "boolean"
    )
      return c.json({ error: "machineControl must be a boolean" }, 400);
    if (body.computerControl)
      return c.json({ error: RETIRED_COMPUTER_CONTROL_ERROR }, 400);

    const modeError = permissionModeError(body.mode);
    if (modeError) {
      return c.json({ error: modeError }, 400);
    }

    const { executor, error: executorError } = parseOptionalExecutor(
      body.executor,
    );
    if (executorError) {
      return c.json({ error: executorError }, 400);
    }
    // A limited user's session is sandboxed and obeys their lock, decided
    // here rather than in the form (topics/limited-users.md § Delivery v1).
    const limitedLaunch = applyLimitedLaunchPolicy(c, body);
    if (limitedLaunch.kind === "error") {
      return c.json({ error: limitedLaunch.error }, 403);
    }
    const sandboxSelection = parseSessionSandboxLevel(
      body.sandboxLevel,
      body.sandboxNetworkFirewall,
    );
    if ("error" in sandboxSelection) {
      return c.json({ error: sandboxSelection.error }, 400);
    }
    const helperSettings = parseHelperSettings(body);
    if (helperSettings.error) {
      return c.json({ error: helperSettings.error }, 400);
    }
    const sandboxSettingsError = getSessionSandboxSettingsError(
      sandboxSelection.sandboxLevel,
      helperSettings.recapMode,
    );
    if (sandboxSettingsError) {
      return c.json({ error: sandboxSettingsError }, 400);
    }
    const workstreamTarget = resolveLaunchWorkstreamTarget(
      project,
      body.workstreamId,
    );
    if ("error" in workstreamTarget) {
      return c.json({ error: workstreamTarget.error }, workstreamTarget.status);
    }

    const { thinking, effort, ultracode } = buildThinkingOptions(body);

    // Convert model option (undefined or "default" means use CLI default)
    const model =
      body.model && body.model !== "default" ? body.model : undefined;
    const serviceTier = normalizeOptionalServiceTier(body.serviceTier);

    const result = await deps.supervisor.createSession(
      workstreamTarget.projectPath,
      body.mode,
      {
        model,
        requestedModel: body.model,
        serviceTier,
        thinking,
        effort,
        ultracode,
        providerName: body.provider,
        routerAccountId: body.routerAccountId,
        routerPoolId: body.routerPoolId,
        routerPolicy: body.routerPolicy,
        computerControl: body.computerControl,
        machineControl: body.machineControl,
        desktopControlOrigin:
          body.machineControl === true ? desktopControlOrigin(c) : undefined,
        executor,
        sandboxLevel: sandboxSelection.sandboxLevel,
        sandboxNetworkFirewall: sandboxSelection.sandboxNetworkFirewall,
        instructionUsername: actingUsername(c),
        globalInstructions: getGlobalInstructions(),
        permissions: body.permissions,
        recapMode: helperSettings.recapMode,
        recapAfterSeconds: helperSettings.recapAfterSeconds,
        promptSuggestionMode: helperSettings.promptSuggestionMode,
        helperSideModel: helperSettings.helperSideModel,
        ...resolveCompactModelSettings(deps, {
          provider: body.provider,
          vibeAllDayModelId: body.model,
          modelCandidates: [body.model, model],
        }),
      },
      {
        projectId: project.id,
        workstreamId: workstreamTarget.workstreamId,
        onStarted: (_sessionId, process) =>
          recordNewSessionLaunch(process, {
            heartbeatProjectId: project.id,
            creationProvenance: body.creationProvenance,
            createdByUser:
              limitedLaunch.kind === "applied"
                ? limitedLaunch.username
                : undefined,
            provider: body.provider,
            executor,
            requestedModel: body.model,
            recapAfterSeconds: helperSettings.recapAfterSeconds,
            workstreamId: workstreamTarget.workstreamId,
            sandbox: {
              level: sandboxSelection.sandboxLevel,
              networkFirewall: sandboxSelection.sandboxNetworkFirewall,
            },
          }),
      },
    );

    // Check if queue is full
    if (isQueueFullResponse(result)) {
      return c.json(
        { error: "Queue is full", maxQueueSize: result.maxQueueSize },
        503,
      );
    }

    // Accepted, whether it starts now or waits for a worker.
    void deps.userUsageService?.recordSession(actingUsername(c));

    // Check if request was queued
    if (isQueuedResponse(result)) {
      return c.json({ ...result, serverTimestamp: Date.now() }, 202); // 202 Accepted - queued for processing
    }

    return c.json({
      sessionId: result.sessionId,
      processId: result.id,
      projectId: result.projectId,
      permissionMode: result.permissionMode,
      appliedPermissionMode: result.appliedPermissionMode,
      modeVersion: result.modeVersion,
      recapAfterSeconds: result.recapAfterSeconds,
      sandboxEnforcement: result.sandboxEnforcement,
      serverTimestamp: Date.now(),
    });
  });

  // POST /api/sessions - Start a detached new session under the hidden No Project workspace
  routes.post("/sessions", async (c) => {
    let body: StartSessionBody;
    try {
      body = await c.req.json<StartSessionBody>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (
      body.machineControl !== undefined &&
      typeof body.machineControl !== "boolean"
    )
      return c.json({ error: "machineControl must be a boolean" }, 400);
    if (body.computerControl)
      return c.json({ error: RETIRED_COMPUTER_CONTROL_ERROR }, 400);

    const limitedLaunch = applyLimitedLaunchPolicy(c, body);
    if (limitedLaunch.kind === "error")
      return c.json({ error: limitedLaunch.error }, 403);

    const modeError = permissionModeError(body.mode);
    if (modeError) {
      return c.json({ error: modeError }, 400);
    }

    if (!hasSessionMessageContent(body)) {
      return c.json({ error: "Message is required" }, 400);
    }
    const { executor, error: executorError } = parseOptionalExecutor(
      body.executor,
    );
    if (executorError) {
      return c.json({ error: executorError }, 400);
    }
    const sandboxSelection = parseSessionSandboxLevel(
      body.sandboxLevel,
      body.sandboxNetworkFirewall,
    );
    if ("error" in sandboxSelection) {
      return c.json({ error: sandboxSelection.error }, 400);
    }
    const helperSettings = parseHelperSettings(body);
    if (helperSettings.error) {
      return c.json({ error: helperSettings.error }, 400);
    }
    const sandboxSettingsError = getSessionSandboxSettingsError(
      sandboxSelection.sandboxLevel,
      helperSettings.recapMode,
    );
    if (sandboxSettingsError) {
      return c.json({ error: sandboxSettingsError }, 400);
    }

    const projectPath = await ensureDetachedProjectPath(
      executor,
      actingUsername(c),
    );
    const serverTimestamp = Date.now();
    const userMessage: UserMessage = {
      text: body.message,
      images: body.images,
      documents: body.documents,
      attachments: body.attachments,
      mode: body.mode,
      tempId: body.tempId,
      metadata: buildUserMessageMetadata(
        body,
        serverTimestamp,
        "direct",
        actingUsername(c),
      ),
    };

    const { thinking, effort, ultracode } = buildThinkingOptions(body);
    const model =
      body.model && body.model !== "default" ? body.model : undefined;
    const serviceTier = normalizeOptionalServiceTier(body.serviceTier);

    const result = await deps.supervisor.startSession(
      projectPath,
      userMessage,
      body.mode,
      {
        model,
        requestedModel: body.model,
        serviceTier,
        thinking,
        effort,
        ultracode,
        providerName: body.provider,
        routerAccountId: body.routerAccountId,
        routerPoolId: body.routerPoolId,
        routerPolicy: body.routerPolicy,
        computerControl: body.computerControl,
        machineControl: body.machineControl,
        desktopControlOrigin:
          body.machineControl === true ? desktopControlOrigin(c) : undefined,
        executor,
        sandboxLevel: sandboxSelection.sandboxLevel,
        sandboxNetworkFirewall: sandboxSelection.sandboxNetworkFirewall,
        globalInstructions: getGlobalInstructions(),
        instructionUsername: actingUsername(c),
        permissions: body.permissions,
        recapMode: helperSettings.recapMode,
        recapAfterSeconds: helperSettings.recapAfterSeconds,
        promptSuggestionMode: helperSettings.promptSuggestionMode,
        helperSideModel: helperSettings.helperSideModel,
      },
      {
        onStarted: (_sessionId, process) =>
          recordNewSessionLaunch(process, {
            creationProvenance: body.creationProvenance,
            createdByUser: actingUsername(c),
            provider: body.provider,
            executor,
            initialPrompt: body.message,
            requestedModel: body.model,
            recapAfterSeconds: helperSettings.recapAfterSeconds,
            sandbox: {
              level: sandboxSelection.sandboxLevel,
              networkFirewall: sandboxSelection.sandboxNetworkFirewall,
            },
          }),
      },
    );

    if (isQueueFullResponse(result)) {
      return c.json(
        { error: "Queue is full", maxQueueSize: result.maxQueueSize },
        503,
      );
    }

    // Accepted, whether it starts now or waits for a worker.
    void deps.userUsageService?.recordSession(actingUsername(c));
    void deps.userUsageService?.recordTurn(actingUsername(c), userMessage.text);

    if (isQueuedResponse(result)) {
      return c.json({ ...result, serverTimestamp: Date.now() }, 202);
    }

    return c.json({
      sessionId: result.sessionId,
      processId: result.id,
      projectId: result.projectId,
      permissionMode: result.permissionMode,
      appliedPermissionMode: result.appliedPermissionMode,
      modeVersion: result.modeVersion,
      recapAfterSeconds: result.recapAfterSeconds,
      sandboxEnforcement: result.sandboxEnforcement,
      serverTimestamp,
    });
  });

  // POST /api/sessions/create - Create a detached session without sending an initial message
  routes.post("/sessions/create", async (c) => {
    let body: CreateSessionBody = {};
    try {
      body = await c.req.json<CreateSessionBody>();
    } catch {
      // Body is optional for this endpoint
    }

    if (
      body.machineControl !== undefined &&
      typeof body.machineControl !== "boolean"
    )
      return c.json({ error: "machineControl must be a boolean" }, 400);
    if (body.computerControl)
      return c.json({ error: RETIRED_COMPUTER_CONTROL_ERROR }, 400);

    const limitedLaunch = applyLimitedLaunchPolicy(c, body);
    if (limitedLaunch.kind === "error")
      return c.json({ error: limitedLaunch.error }, 403);

    const modeError = permissionModeError(body.mode);
    if (modeError) {
      return c.json({ error: modeError }, 400);
    }

    const { executor, error: executorError } = parseOptionalExecutor(
      body.executor,
    );
    if (executorError) {
      return c.json({ error: executorError }, 400);
    }
    const sandboxSelection = parseSessionSandboxLevel(
      body.sandboxLevel,
      body.sandboxNetworkFirewall,
    );
    if ("error" in sandboxSelection) {
      return c.json({ error: sandboxSelection.error }, 400);
    }
    const helperSettings = parseHelperSettings(body);
    if (helperSettings.error) {
      return c.json({ error: helperSettings.error }, 400);
    }
    const sandboxSettingsError = getSessionSandboxSettingsError(
      sandboxSelection.sandboxLevel,
      helperSettings.recapMode,
    );
    if (sandboxSettingsError) {
      return c.json({ error: sandboxSettingsError }, 400);
    }

    const projectPath = await ensureDetachedProjectPath(
      executor,
      actingUsername(c),
    );
    const { thinking, effort, ultracode } = buildThinkingOptions(body);
    const model =
      body.model && body.model !== "default" ? body.model : undefined;
    const serviceTier = normalizeOptionalServiceTier(body.serviceTier);

    const result = await deps.supervisor.createSession(
      projectPath,
      body.mode,
      {
        model,
        requestedModel: body.model,
        serviceTier,
        thinking,
        effort,
        ultracode,
        providerName: body.provider,
        routerAccountId: body.routerAccountId,
        routerPoolId: body.routerPoolId,
        routerPolicy: body.routerPolicy,
        computerControl: body.computerControl,
        machineControl: body.machineControl,
        desktopControlOrigin:
          body.machineControl === true ? desktopControlOrigin(c) : undefined,
        executor,
        sandboxLevel: sandboxSelection.sandboxLevel,
        sandboxNetworkFirewall: sandboxSelection.sandboxNetworkFirewall,
        globalInstructions: getGlobalInstructions(),
        instructionUsername: actingUsername(c),
        permissions: body.permissions,
        recapMode: helperSettings.recapMode,
        recapAfterSeconds: helperSettings.recapAfterSeconds,
        promptSuggestionMode: helperSettings.promptSuggestionMode,
        helperSideModel: helperSettings.helperSideModel,
      },
      {
        onStarted: (_sessionId, process) =>
          recordNewSessionLaunch(process, {
            creationProvenance: body.creationProvenance,
            createdByUser: actingUsername(c),
            provider: body.provider,
            executor,
            requestedModel: body.model,
            recapAfterSeconds: helperSettings.recapAfterSeconds,
            sandbox: {
              level: sandboxSelection.sandboxLevel,
              networkFirewall: sandboxSelection.sandboxNetworkFirewall,
            },
          }),
      },
    );

    if (isQueueFullResponse(result)) {
      return c.json(
        { error: "Queue is full", maxQueueSize: result.maxQueueSize },
        503,
      );
    }

    // Accepted, whether it starts now or waits for a worker.
    void deps.userUsageService?.recordSession(actingUsername(c));

    if (isQueuedResponse(result)) {
      return c.json({ ...result, serverTimestamp: Date.now() }, 202);
    }

    return c.json({
      sessionId: result.sessionId,
      processId: result.id,
      projectId: result.projectId,
      permissionMode: result.permissionMode,
      appliedPermissionMode: result.appliedPermissionMode,
      modeVersion: result.modeVersion,
      recapAfterSeconds: result.recapAfterSeconds,
      sandboxEnforcement: result.sandboxEnforcement,
      serverTimestamp: Date.now(),
    });
  });

  // POST /api/projects/:projectId/sessions/:sessionId/resume - Resume session
  routes.post("/projects/:projectId/sessions/:sessionId/resume", async (c) => {
    const projectId = c.req.param("projectId");
    const sessionId = c.req.param("sessionId");

    // Validate projectId format at API boundary
    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }

    const requestProject = await deps.scanner.getOrCreateProject(projectId);
    if (!requestProject) {
      return c.json({ error: "Project not found or path does not exist" }, 404);
    }

    let body: StartSessionBody;
    try {
      body = await c.req.json<StartSessionBody>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (
      body.routerAccountId !== undefined ||
      body.routerPoolId !== undefined ||
      body.routerPolicy !== undefined
    ) {
      return c.json(
        {
          error:
            "Router account selection is only supported when creating a session; resumed sessions retain their pin",
        },
        400,
      );
    }

    const modeError = permissionModeError(body.mode);
    if (modeError) {
      return c.json({ error: modeError }, 400);
    }

    if (!hasSessionMessageContent(body)) {
      return c.json({ error: "Message is required" }, 400);
    }
    const parsedBodyExecutor = parseOptionalExecutor(body.executor);
    if (parsedBodyExecutor.error) {
      return c.json({ error: parsedBodyExecutor.error }, 400);
    }
    const helperSettings = parseHelperSettings(body);
    if (helperSettings.error) {
      return c.json({ error: helperSettings.error }, 400);
    }
    const parsedResumeMode = parseOptionalResumeMode(body.resumeMode);
    if (parsedResumeMode.error) {
      return c.json({ error: parsedResumeMode.error }, 400);
    }
    const resumeMode = parsedResumeMode.resumeMode ?? "full";
    const persistedMetadata =
      deps.sessionMetadataService?.getMetadata?.(sessionId);
    const metadataProvider = deps.sessionMetadataService?.getProvider(
      sessionId,
    ) as ProviderName | undefined;
    const identity = await resolveExistingSessionIdentity({
      sessionId,
      requestProjectId: projectId,
      preferredProvider: body.provider,
      requestFallbackProvider: requestProject.provider,
      metadata: persistedMetadata,
      scanner: deps.scanner,
      providerDeps: providerResolutionDeps(deps),
    });
    if (!identity) {
      return c.json({ error: "Session not found" }, 404);
    }
    const settledSandboxLevel = persistedMetadata?.sandboxLevel ?? "none";
    const settledSandboxNetworkFirewall =
      persistedSandboxNetworkFirewall(persistedMetadata);
    if (
      body.sandboxLevel !== undefined ||
      body.sandboxNetworkFirewall !== undefined
    ) {
      const requestedSandbox = parseSessionSandboxLevel(
        body.sandboxLevel,
        body.sandboxNetworkFirewall,
        settledSandboxLevel,
        settledSandboxNetworkFirewall,
      );
      if ("error" in requestedSandbox) {
        return c.json({ error: requestedSandbox.error }, 400);
      }
      if (
        requestedSandbox.sandboxLevel !== settledSandboxLevel ||
        requestedSandbox.sandboxNetworkFirewall !==
          settledSandboxNetworkFirewall
      ) {
        return c.json(
          {
            error:
              "The session sandbox boundary is settled at creation and cannot change on resume",
          },
          409,
        );
      }
    }

    const serverTimestamp = Date.now();
    const userMessage: UserMessage = {
      text: body.message,
      images: body.images,
      documents: body.documents,
      attachments: body.attachments,
      mode: body.mode,
      tempId: body.tempId,
      metadata: buildUserMessageMetadata(
        body,
        serverTimestamp,
        "direct",
        actingUsername(c),
      ),
    };

    const providerName = body.provider ?? metadataProvider ?? identity.provider;
    const previousProcess = deps.supervisor.getProcessForSession?.(sessionId);
    const resumeDiagnostics = {
      requestedMode: resumeMode,
      provider: providerName,
      previousProcess: previousProcess
        ? {
            processId: previousProcess.id,
            state: previousProcess.state.type,
            provider: previousProcess.provider,
            supportsDynamicCommands: previousProcess.supportsDynamicCommands,
          }
        : null,
    };

    let resumeSessionAt: string | undefined;
    // A recorded same-session rewind is applied by the supervisor at process
    // launch, whichever path starts the process (topics/session-rewind.md);
    // it wins over the API-error truncation below, whose blocker check is
    // skipped here because the dropped tail is already accounted for.
    const pendingRewind =
      deps.sessionMetadataService?.getPendingRewind?.(sessionId);
    if (!pendingRewind && isClaudeSdkProviderName(providerName)) {
      let blocker: ClaudeResumeApiErrorBlocker | null = null;
      try {
        blocker = await getClaudeResumeBlockerFromReader(
          deps.readerFactory(identity.transcriptProject),
          sessionId,
          identity.transcriptProjectId,
        );
      } catch (error) {
        getLogger().warn(
          {
            event: "claude_resume_api_error_check_failed",
            sessionId,
            projectId,
            providerName,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to check Claude session for resume-blocking API error",
        );
      }

      if (blocker?.resumeAtMessageId) {
        // Recoverable: resume up to the last good assistant message,
        // dropping the API-error tail, instead of forcing a handoff.
        resumeSessionAt = blocker.resumeAtMessageId;
        getLogger().info(
          {
            event: "claude_resume_truncated_after_api_error",
            sessionId,
            projectId,
            providerName,
            messageId: blocker.messageId,
            apiErrorStatus: blocker.apiErrorStatus,
            resumeSessionAt,
          },
          "Resuming Claude session before SDK API-error tail",
        );
      } else if (blocker) {
        getLogger().warn(
          {
            event: "claude_resume_blocked_after_api_error",
            sessionId,
            projectId,
            providerName,
            messageId: blocker.messageId,
            apiErrorStatus: blocker.apiErrorStatus,
          },
          "Blocked Claude provider resume after SDK API-error message",
        );
        return c.json(
          {
            error: blocker.error,
            recovery: blocker.recovery,
            resume: {
              ...resumeDiagnostics,
              blockedReason: "claude-api-error-tail",
            },
          },
          409,
        );
      }
    }

    const launch = buildResumeLaunch({
      sessionId,
      providerName,
      workingProjectPath: identity.workingProject.path,
      previousResolvedModel: previousProcess?.resolvedModel,
      request: {
        model: body.model,
        serviceTier: normalizeOptionalServiceTier(body.serviceTier),
        ...buildThinkingOptions(body),
        executor: parsedBodyExecutor.executor,
        permissions: body.permissions,
        recapMode: helperSettings.recapMode,
        recapAfterSeconds: helperSettings.recapAfterSeconds,
        promptSuggestionMode: helperSettings.promptSuggestionMode,
        helperSideModel: helperSettings.helperSideModel,
        resumeMode,
        resumeSessionAt,
      },
    });
    if ("error" in launch) {
      return c.json({ error: launch.error }, 400);
    }
    const { settings: resumeSettings, projectPath: resumeProjectPath } = launch;
    const executor = resumeSettings.executor;
    // A limited user resumes only a sandboxed session, on this host, inside
    // their lock (topics/limited-users.md § Delivery v1).
    const limitedResume = applyLimitedResumePolicy(c, resumeSettings, body);
    if (limitedResume.kind === "error") {
      return c.json({ error: limitedResume.error }, 403);
    }

    // For remote sessions, sync local files TO remote before resuming
    // This ensures the remote has the latest session state
    if (executor) {
      const projectDir = getProjectDirFromCwd(resumeProjectPath);
      const syncResult = await syncSessions({
        host: executor,
        projectDir,
        direction: "to-remote",
      });
      if (!syncResult.success) {
        console.warn(
          `[resume] Failed to pre-sync session to ${executor}: ${syncResult.error}`,
        );
        // Continue anyway - remote may have the files from before
      }

      // Save executor to metadata if not already saved (e.g. client provided it)
      if (deps.sessionMetadataService) {
        await deps.sessionMetadataService.setExecutor(sessionId, executor);
      }
    }

    let result: Awaited<ReturnType<Supervisor["resumeSession"]>>;
    try {
      result = await deps.supervisor.resumeSession(
        sessionId,
        resumeProjectPath,
        userMessage,
        body.mode,
        resumeSettings,
        { requireProviderSessionId: true },
      );
    } catch (error) {
      if (error instanceof ResumeCompactionError) {
        getLogger().warn(
          {
            event: "resume_compaction_failed",
            sessionId,
            projectId,
            providerName,
            attempt: error.attempt,
          },
          "Compact-first resume failed",
        );
        return c.json(
          {
            error: error.message,
            recovery: error.recovery,
            resume: {
              ...resumeDiagnostics,
              compaction: error.attempt,
            },
          },
          409,
        );
      }
      if (error instanceof SessionMessageRejectedError) {
        return c.json({ error: error.message, reason: error.message }, 409);
      }
      if (error instanceof RetryableSessionLaunchError) {
        getLogger().warn(
          {
            event: "provider_resume_attachment_failed",
            sessionId,
            projectId,
            providerName,
            error: error.message,
          },
          "Provider resume failed before native session attachment",
        );
        return c.json({ error: error.message }, 409);
      }
      throw error;
    }

    // Check if queue is full
    if (isQueueFullResponse(result)) {
      return c.json(
        { error: "Queue is full", maxQueueSize: result.maxQueueSize },
        503,
      );
    }

    // Check if request was queued
    if (isQueuedResponse(result)) {
      void deps.userUsageService?.recordTurn(
        actingUsername(c),
        userMessage.text,
      );
      return c.json(
        {
          ...result,
          serverTimestamp: Date.now(),
          resume: { ...resumeDiagnostics, outcome: "queued" },
        },
        202,
      ); // 202 Accepted - queued for processing
    }
    void deps.userUsageService?.recordTurn(actingUsername(c), userMessage.text);

    return c.json({
      processId: result.id,
      permissionMode: result.permissionMode,
      appliedPermissionMode: result.appliedPermissionMode,
      modeVersion: result.modeVersion,
      recapAfterSeconds: result.recapAfterSeconds,
      sandboxEnforcement: result.sandboxEnforcement,
      serverTimestamp,
      resume: {
        ...resumeDiagnostics,
        outcome: "started",
        compaction:
          resumeMode === "compact-first" ? { status: "completed" } : undefined,
      },
    });
  });

  // POST /api/projects/:projectId/sessions/:sessionId/reactivate
  // Spawn or reconcile a live harness process without delivering a turn. Every
  // request is validated and serialized, including when the session is already
  // owned or another activation is still in flight.
  routes.use(
    "/projects/:projectId/sessions/:sessionId/reactivate",
    async (c, next) => {
      const projectId = c.req.param("projectId");
      if (!isUrlProjectId(projectId) || !deps.projectQueueScheduler) {
        await next();
        return;
      }

      const release = deps.projectQueueScheduler.reserveUserSessionStart(
        projectId,
        c.req.param("sessionId"),
      );
      try {
        await next();
      } finally {
        release();
      }
    },
  );
  routes.post(
    "/projects/:projectId/sessions/:sessionId/reactivate",
    async (c) => {
      const projectId = c.req.param("projectId");
      const sessionId = c.req.param("sessionId");

      if (!isUrlProjectId(projectId)) {
        return c.json({ error: "Invalid project ID format" }, 400);
      }

      const parsedBody = parseOptionalReactivateSessionBody(await c.req.text());
      if ("error" in parsedBody) {
        return c.json({ error: parsedBody.error }, 400);
      }
      const body = parsedBody.body;
      const modeError = permissionModeError(body.mode);
      if (modeError) {
        return c.json({ error: modeError }, 400);
      }
      const parsedBodyExecutor = parseOptionalExecutor(body.executor);
      if (parsedBodyExecutor.error) {
        return c.json({ error: parsedBodyExecutor.error }, 400);
      }
      const helperSettings = parseHelperSettings(body);
      if (helperSettings.error) {
        return c.json({ error: helperSettings.error }, 400);
      }
      const requestProject = await deps.scanner.getOrCreateProject(projectId);
      if (!requestProject) {
        return c.json(
          { error: "Project not found or path does not exist" },
          404,
        );
      }

      const metadata = deps.sessionMetadataService?.getMetadata?.(sessionId);
      const parsedSandbox = parseSessionSandboxLevel(
        body.sandboxLevel,
        body.sandboxNetworkFirewall,
        metadata?.sandboxLevel ?? "none",
        persistedSandboxNetworkFirewall(metadata),
      );
      if ("error" in parsedSandbox) {
        return c.json({ error: parsedSandbox.error }, 400);
      }
      const hasProvider = Object.hasOwn(body, "provider");
      const hasExecutor = Object.hasOwn(body, "executor");
      const hasModel = Object.hasOwn(body, "model");
      const hasServiceTier = Object.hasOwn(body, "serviceTier");
      const hasThinking = Object.hasOwn(body, "thinking");
      const hasUltracode = Object.hasOwn(body, "ultracode");
      const hasSandbox =
        Object.hasOwn(body, "sandboxLevel") ||
        Object.hasOwn(body, "sandboxNetworkFirewall");
      const hasPermissions = Object.hasOwn(body, "permissions");
      const hasRecapMode = Object.hasOwn(body, "recapMode");
      const hasRecapAfterSeconds = Object.hasOwn(body, "recapAfterSeconds");
      const hasPromptSuggestionMode = Object.hasOwn(
        body,
        "promptSuggestionMode",
      );
      const hasHelperSideModel = Object.hasOwn(body, "helperSideModel");

      const existingProcess = deps.supervisor.getProcessForSession?.(sessionId);
      const identity = existingProcess
        ? null
        : await resolveExistingSessionIdentity({
            sessionId,
            requestProjectId: projectId,
            preferredProvider: hasProvider
              ? body.provider
              : (metadata?.provider as ProviderName | undefined),
            metadata,
            scanner: deps.scanner,
            providerDeps: providerResolutionDeps(deps),
          });
      if (!existingProcess && !identity) {
        return c.json({ error: "Session not found" }, 404);
      }
      let providerName = hasProvider
        ? body.provider
        : (metadata?.provider as ProviderName | undefined);
      if (!providerName) {
        providerName = existingProcess?.provider ?? identity?.provider;
      }
      if (!providerName) {
        return c.json({ error: "Session provider not found" }, 404);
      }
      const executor = hasExecutor
        ? parsedBodyExecutor.executor
        : metadata?.executor;
      const requestedModel = hasModel ? body.model : metadata?.requestedModel;
      const model =
        requestedModel && requestedModel !== "default"
          ? requestedModel
          : undefined;
      const serviceTier = normalizeOptionalServiceTier(body.serviceTier);
      // Each key appears only when the body named it: the supervisor reads
      // presence, so an ultracode-only toggle must not also assert thinking.
      const thinkingOptions =
        hasThinking || hasUltracode
          ? {
              ...(hasThinking ? buildThinkingOptions(body) : {}),
              ...(hasUltracode ? { ultracode: body.ultracode === true } : {}),
            }
          : undefined;
      const sandboxLevel = hasSandbox
        ? parsedSandbox.sandboxLevel
        : metadata?.sandboxLevel;
      const sandboxNetworkFirewall = hasSandbox
        ? parsedSandbox.sandboxNetworkFirewall
        : metadata?.sandboxLevel === "project-write" &&
          metadata.sandboxNetworkFirewall !== false;
      const recapMode = hasRecapMode
        ? helperSettings.recapMode
        : metadata?.recapMode;
      const recapAfterSeconds = hasRecapAfterSeconds
        ? helperSettings.recapAfterSeconds
        : metadata?.recapAfterSeconds;
      const promptSuggestionMode = hasPromptSuggestionMode
        ? helperSettings.promptSuggestionMode
        : metadata?.promptSuggestionMode;
      const sandboxSettingsError = getSessionSandboxSettingsError(
        sandboxLevel,
        recapMode,
      );
      if (sandboxSettingsError) {
        return c.json({ error: sandboxSettingsError }, 400);
      }

      const coldSettings: ModelSettings = {
        model,
        requestedModel,
        ...(hasServiceTier ? { serviceTier } : {}),
        ...thinkingOptions,
        providerName,
        executor,
        ...(hasPermissions
          ? { permissions: body.permissions ?? undefined }
          : {}),
        ...(hasSandbox || sandboxLevel === "project-write"
          ? {
              sandboxLevel,
              sandboxNetworkFirewall,
              sandboxStateKey: metadata?.sandboxStateKey,
            }
          : {}),
        globalInstructions: getGlobalInstructions(),
        recapAfterSeconds,
        recapMode,
        promptSuggestionMode,
        ...(hasHelperSideModel
          ? { helperSideModel: helperSettings.helperSideModel }
          : {}),
        ...resolveCompactModelSettings(deps, {
          provider: providerName,
          vibeAllDayModelId: requestedModel,
          modelCandidates: [requestedModel, model],
        }),
      };
      const overrideModelSettings: ModelSettings = {
        ...(hasModel ? { model, requestedModel: body.model } : {}),
        ...(hasServiceTier ? { serviceTier } : {}),
        ...thinkingOptions,
        ...(hasProvider ? { providerName: body.provider } : {}),
        ...(hasExecutor ? { executor: parsedBodyExecutor.executor } : {}),
        ...(hasPermissions
          ? { permissions: body.permissions ?? undefined }
          : {}),
        ...(hasSandbox
          ? {
              sandboxLevel: parsedSandbox.sandboxLevel,
              sandboxNetworkFirewall: parsedSandbox.sandboxNetworkFirewall,
              sandboxStateKey: metadata?.sandboxStateKey,
            }
          : {}),
        ...(hasRecapMode ? { recapMode: helperSettings.recapMode } : {}),
        ...(hasRecapAfterSeconds
          ? { recapAfterSeconds: helperSettings.recapAfterSeconds }
          : {}),
        ...(hasPromptSuggestionMode
          ? { promptSuggestionMode: helperSettings.promptSuggestionMode }
          : {}),
        ...(hasHelperSideModel
          ? { helperSideModel: helperSettings.helperSideModel }
          : {}),
      };
      // A limited user reactivates only a sandboxed session, on this host,
      // inside their lock (topics/limited-users.md § Delivery v1). The cold
      // settings already carry every override the body named, so checking
      // them covers both; an override the lock then replaced follows it.
      const limitedReactivate = applyLimitedResumePolicy(c, coldSettings, body);
      if (limitedReactivate.kind === "error") {
        return c.json({ error: limitedReactivate.error }, 403);
      }
      if (limitedReactivate.kind === "applied") {
        for (const field of [
          "model",
          "requestedModel",
          "thinking",
          "effort",
        ] as const) {
          if (Object.hasOwn(overrideModelSettings, field)) {
            (overrideModelSettings as Record<string, unknown>)[field] =
              coldSettings[field];
          }
        }
      }
      const requestedOverrides: SessionReactivationOverrides = {
        ...(Object.hasOwn(body, "mode") && body.mode !== undefined
          ? { permissionMode: body.mode }
          : {}),
        ...(Object.keys(overrideModelSettings).length > 0
          ? { modelSettings: overrideModelSettings }
          : {}),
      };
      const reactivationProjectPath =
        sandboxLevel === "project-write"
          ? (metadata?.sandboxProjectPath ??
            existingProcess?.projectPath ??
            identity?.workingProject.path ??
            requestProject.path)
          : (existingProcess?.projectPath ??
            identity?.workingProject.path ??
            requestProject.path);
      const reservationProjectId =
        existingProcess?.projectId ?? identity?.workingProjectId ?? projectId;
      const release =
        reservationProjectId === projectId
          ? undefined
          : deps.projectQueueScheduler?.reserveUserSessionStart(
              reservationProjectId,
              sessionId,
            );

      let process: Process;
      try {
        process = await deps.supervisor.reactivateSession(
          reactivationProjectPath,
          sessionId,
          body.mode,
          coldSettings,
          { requestedOverrides },
        );
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to reactivate session",
          },
          error instanceof SessionConfigurationConflictError ? 409 : 503,
        );
      } finally {
        release?.();
      }

      return c.json({
        processId: process.id,
        permissionMode: process.permissionMode,
        appliedPermissionMode: process.appliedPermissionMode,
        modeVersion: process.modeVersion,
        recapAfterSeconds: process.recapAfterSeconds,
        sandboxEnforcement: process.sandboxEnforcement,
        serverTimestamp: Date.now(),
      });
    },
  );

  // POST /api/projects/:projectId/sessions/:sessionId/recap
  // Away-recap trigger, keyed by session (not process) so it survives a server
  // restart that killed the process. A live process recaps directly in its own
  // mode; a cold fork-mode session is revived — without ever preempting a live
  // worker — and recapped from its on-disk transcript. See topics/fork-recap.md.
  routes.post("/projects/:projectId/sessions/:sessionId/recap", async (c) => {
    const projectId = c.req.param("projectId");
    const sessionId = c.req.param("sessionId");

    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }

    let sinceMs: number | null = null;
    try {
      const body = await c.req.json<{ hiddenSinceMs?: unknown }>();
      if (
        typeof body.hiddenSinceMs === "number" &&
        Number.isFinite(body.hiddenSinceMs)
      ) {
        sinceMs = body.hiddenSinceMs;
      }
    } catch {
      // Empty body is accepted.
    }

    // Live process: recap directly in whatever mode it runs.
    const live = deps.supervisor.getProcessForSession(sessionId);
    if (live && !live.isTerminated) {
      const result = await deps.supervisor.requestRecap(live.id, { sinceMs });
      return c.json(result);
    }

    // Cold session: only fork mode can recap from the on-disk transcript —
    // side-session/native recaps need in-memory recent text a revived process
    // lacks. Other modes simply skip until the session is live again.
    const metadata = deps.sessionMetadataService?.getMetadata?.(sessionId);
    if (deps.supervisor.isRecapPausedUntilUserTurn(sessionId)) {
      return c.json({
        supported: true,
        emitted: false,
        reason: "recaps paused until next user turn",
      });
    }
    if (!isAutomaticSessionResumeAllowed(metadata)) {
      return c.json({
        supported: true,
        emitted: false,
        reason: "recap skipped: automatic resume disabled",
      });
    }
    const recapMode =
      metadata?.recapMode ??
      deps.sessionMetadataService?.getRecapMode?.(sessionId);
    const sandboxSettingsError = getSessionSandboxSettingsError(
      metadata?.sandboxLevel,
      recapMode,
    );
    if (sandboxSettingsError) {
      return c.json({
        supported: false,
        emitted: false,
        reason: sandboxSettingsError,
      });
    }
    if (recapMode !== "fork") {
      return c.json({
        supported: true,
        emitted: false,
        reason: "recap requires a live process for this recap mode",
      });
    }

    const project = await deps.scanner.getOrCreateProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found or path does not exist" }, 404);
    }

    const providerName =
      (metadata?.provider as ProviderName | undefined) ?? project.provider;
    const rawModel = metadata?.requestedModel;
    const model = rawModel && rawModel !== "default" ? rawModel : undefined;

    let process: Process;
    try {
      const recapProjectPath =
        metadata?.sandboxLevel === "project-write"
          ? (metadata.sandboxProjectPath ?? project.path)
          : project.path;
      process = await deps.supervisor.reactivateSession(
        recapProjectPath,
        sessionId,
        undefined,
        {
          model,
          providerName,
          executor: metadata?.executor,
          ...inheritedSandboxSettings(metadata),
          globalInstructions: getGlobalInstructions(),
          recapAfterSeconds: metadata?.recapAfterSeconds,
          recapMode: "fork",
        },
        { preempt: false, requestedOverrides: {} },
      );
    } catch (error) {
      // At capacity with no idle worker to drop (background recaps never
      // preempt), or reactivation failed — skip the recap rather than error.
      const atCapacity =
        error instanceof Error && error.message.includes("worker capacity");
      return c.json({
        supported: true,
        emitted: false,
        reason: atCapacity
          ? "recap skipped: at worker capacity"
          : "recap skipped: session could not be revived",
      });
    }

    const result = await deps.supervisor.requestRecap(process.id, {
      sinceMs,
      revived: true,
    });
    return c.json(result);
  });

  /**
   * The text a handoff successor would receive. Shared by the preview route
   * and the restart itself, so the draft a user edits and the message an
   * unedited handoff sends are built the same way.
   */
  const buildHandoffText = async (params: {
    project: Project;
    projectId: UrlProjectId;
    sessionId: string;
    handoffTitle: string;
    sourceSession: Session;
    sourceProvider: ProviderName;
    oldProcess?: Process;
    sourceUrl?: string;
    targetExecutor?: string;
    projectPath: string;
    purpose?: "restart" | "cold-session";
  }): Promise<string> => {
    const { transcript, omittedCount } = buildRestartTranscript(
      params.sourceSession.messages,
    );
    // The provider's reader knows where the source session's transcript lives
    // on disk; surface it so the successor can grep/read for any detail the
    // bounded summary above dropped. Best-effort — omitted when unavailable.
    const sourceReader = await resolveSessionReader({
      deps,
      project: params.project,
      sessionId: params.sessionId,
      projectId: params.projectId,
    });
    const sourceTranscriptPath =
      (await sourceReader.getSessionFilePath?.(params.sessionId)) ?? undefined;
    return buildRestartHandoff({
      handoffTitle: params.handoffTitle,
      sourceSession: params.sourceSession,
      sourceProvider: params.sourceProvider,
      sourceModel:
        params.oldProcess?.resolvedModel ?? params.sourceSession.model,
      sourceProcess: params.oldProcess,
      sourceUrl: params.sourceUrl,
      sourceTranscriptPath,
      sourceTranscriptHost: hostname(),
      targetExecutor: params.targetExecutor,
      projectPath: params.projectPath,
      omittedCount,
      transcript,
      purpose: params.purpose,
    });
  };

  // GET /api/projects/:projectId/sessions/:sessionId/restart/handoff
  // The handoff text as it stands now, so the client can offer it as an
  // editable draft. Compacts first, exactly as the handoff path does, so the
  // draft shows the boundary a real handoff would carry. Unlike the restart
  // itself this never interrupts the source process: previewing is not
  // starting, and a user who closes the dialog keeps their session running.
  routes.get(
    "/projects/:projectId/sessions/:sessionId/restart/handoff",
    async (c) => {
      const projectId = c.req.param("projectId");
      const sessionId = c.req.param("sessionId");

      if (!isUrlProjectId(projectId)) {
        return c.json({ error: "Invalid project ID format" }, 400);
      }

      const project = await deps.scanner.getOrCreateProject(projectId);
      if (!project) {
        return c.json(
          { error: "Project not found or path does not exist" },
          404,
        );
      }

      const oldProcess = deps.supervisor.getProcessForSession(sessionId);
      const metadataProvider = deps.sessionMetadataService?.getProvider(
        sessionId,
      ) as ProviderName | undefined;
      const preferredSourceProvider =
        metadataProvider ?? oldProcess?.provider ?? project.provider;
      const compact = await tryRestartCompact(oldProcess);
      const sourceSession = await loadRestartSourceSession(
        project,
        sessionId,
        projectId,
        preferredSourceProvider,
        oldProcess,
      );
      if (!sourceSession) {
        return c.json({ error: "Session not found" }, 404);
      }

      const originalMetadata =
        deps.sessionMetadataService?.getMetadata?.(sessionId);
      const parsedExecutor = parseOptionalExecutor(
        deps.sessionMetadataService?.getExecutor(sessionId),
      );
      if (parsedExecutor.error) {
        return c.json({ error: parsedExecutor.error }, 400);
      }
      const handoffTitle = deriveRestartTitle({
        preferredTitle: originalMetadata?.customTitle,
        sourceSession,
      });
      const handoff = await buildHandoffText({
        project,
        projectId,
        sessionId,
        handoffTitle,
        sourceSession,
        sourceProvider: sourceSession.provider ?? preferredSourceProvider,
        oldProcess,
        sourceUrl: c.req.query("sourceUrl"),
        targetExecutor: parsedExecutor.executor,
        projectPath:
          originalMetadata?.sandboxLevel === "project-write"
            ? (originalMetadata.sandboxProjectPath ?? project.path)
            : project.path,
      });

      // The compact status explains a draft that carries no compact summary
      // without making the client parse the text for one.
      return c.json({ handoff, handoffTitle, compactStatus: compact.status });
    },
  );

  // POST /api/projects/:projectId/sessions/:sessionId/restart
  // Start a fresh session from a bounded handoff, then terminate the old VIBEALLDAY-owned process.
  routes.post("/projects/:projectId/sessions/:sessionId/restart", async (c) => {
    const projectId = c.req.param("projectId");
    const sessionId = c.req.param("sessionId");
    if (isRoutedSession(sessionId)) {
      return c.json(
        { error: routedSessionUnsupportedMessage("Restart and handoff") },
        409,
      );
    }

    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }

    const parsedBody = parseOptionalRestartSessionBody(await c.req.text());
    if ("error" in parsedBody) {
      return c.json({ error: parsedBody.error }, 400);
    }
    const { body } = parsedBody;

    const project = await deps.scanner.getOrCreateProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found or path does not exist" }, 404);
    }

    const modeError = permissionModeError(body.mode);
    if (modeError) {
      return c.json({ error: modeError }, 400);
    }

    const parsedHandoffText = parseRestartHandoffText(body.handoffText);
    if ("error" in parsedHandoffText) {
      return c.json({ error: parsedHandoffText.error }, 400);
    }
    const { handoffText } = parsedHandoffText;

    const parsedBodyExecutor = parseOptionalExecutor(body.executor);
    if (parsedBodyExecutor.error) {
      return c.json({ error: parsedBodyExecutor.error }, 400);
    }
    const helperSettings = parseHelperSettings(body);
    if (helperSettings.error) {
      return c.json({ error: helperSettings.error }, 400);
    }
    const originalMetadata =
      deps.sessionMetadataService?.getMetadata?.(sessionId);
    const originalSandboxLevel = originalMetadata?.sandboxLevel ?? "none";
    const originalSandboxNetworkFirewall =
      originalSandboxLevel === "project-write" &&
      originalMetadata?.sandboxNetworkFirewall !== false;
    const requestedRestartSandbox = parseSessionSandboxLevel(
      body.sandboxLevel,
      body.sandboxNetworkFirewall,
      originalSandboxLevel,
      originalSandboxNetworkFirewall,
    );
    if ("error" in requestedRestartSandbox) {
      return c.json({ error: requestedRestartSandbox.error }, 400);
    }
    const restartSandboxLevel = requestedRestartSandbox.sandboxLevel;
    const restartSandboxNetworkFirewall =
      requestedRestartSandbox.sandboxNetworkFirewall;
    const sandboxSettingsError = getSessionSandboxSettingsError(
      restartSandboxLevel,
      helperSettings.recapMode ?? originalMetadata?.recapMode,
    );
    if (sandboxSettingsError) {
      return c.json({ error: sandboxSettingsError }, 400);
    }

    let executor = parsedBodyExecutor.executor;
    if (!executor) {
      const parsedSavedExecutor = parseOptionalExecutor(
        deps.sessionMetadataService?.getExecutor(sessionId),
      );
      if (parsedSavedExecutor.error) {
        return c.json({ error: parsedSavedExecutor.error }, 400);
      }
      executor = parsedSavedExecutor.executor;
    }

    const restartMode = body.restartMode ?? "handoff";
    if (
      restartSandboxLevel !== originalSandboxLevel ||
      restartSandboxNetworkFirewall !== originalSandboxNetworkFirewall
    ) {
      return c.json(
        {
          error:
            "A restarted session inherits the source sandbox boundary and cannot change it",
        },
        409,
      );
    }
    const restartProjectPath =
      originalMetadata?.sandboxLevel === "project-write"
        ? (originalMetadata.sandboxProjectPath ?? project.path)
        : project.path;

    const oldProcess = deps.supervisor.getProcessForSession(sessionId);
    const metadataProvider = deps.sessionMetadataService?.getProvider(
      sessionId,
    ) as ProviderName | undefined;
    const preferredSourceProvider =
      metadataProvider ?? oldProcess?.provider ?? project.provider;
    let sourceSession: Session | null = null;

    // Fork validation must use the source transcript, but it must not disturb
    // the source process until every unsupported request has been rejected.
    if (restartMode === "fork") {
      sourceSession = await loadRestartSourceSession(
        project,
        sessionId,
        projectId,
        preferredSourceProvider,
        oldProcess,
      );
      if (!sourceSession) {
        return c.json({ error: "Session not found" }, 404);
      }
      const forkSourceProvider =
        sourceSession.provider ?? preferredSourceProvider;
      if (body.provider && body.provider !== forkSourceProvider) {
        return c.json(
          {
            error:
              "Fork keeps the source provider; omit provider or match the source session",
          },
          400,
        );
      }
      if (!deps.supervisor.supportsForkSession(forkSourceProvider)) {
        return c.json(
          { error: `${forkSourceProvider} does not support transcript fork` },
          400,
        );
      }
    }

    // Fork copies the transcript as-is. Handoff first asks the provider to
    // compact so the bounded transcript can include that boundary when one is
    // available. A supplied draft was already built from a compacted
    // transcript by the preview route, so compacting again would only spend
    // tokens to produce a boundary this restart will not read.
    if (restartMode !== "fork" && handoffText === undefined) {
      await tryRestartCompact(oldProcess);
    }
    const oldProcessInterrupted =
      await interruptOldProcessForHandoff(oldProcess);
    if (restartMode !== "fork") {
      sourceSession = await loadRestartSourceSession(
        project,
        sessionId,
        projectId,
        preferredSourceProvider,
        oldProcess,
      );
    }
    if (!sourceSession) {
      return c.json({ error: "Session not found" }, 404);
    }

    const sourceProvider = sourceSession.provider ?? preferredSourceProvider;
    const providerName = body.provider ?? sourceProvider;
    const inheritsSourceProviderSettings = providerName === sourceProvider;

    const {
      requestedModel,
      thinking,
      effort,
      ultracode,
      serviceTier,
      permissionMode: restartPermissionMode,
    } = inheritSuccessorLaunchSettings(
      originalMetadata?.effectiveLaunchSettings,
      {
        sameProvider: inheritsSourceProviderSettings,
        legacyRequestedModel: () =>
          deps.sessionMetadataService?.getRequestedModel(sessionId),
      },
      {
        requestedModel: body.model,
        thinking: body.thinking,
        ultracode: body.ultracode,
        serviceTier:
          body.serviceTier !== undefined
            ? (normalizeOptionalServiceTier(body.serviceTier) ?? null)
            : undefined,
        permissionMode: body.mode,
      },
    );
    const model =
      requestedModel && requestedModel !== "default"
        ? requestedModel
        : undefined;

    if (restartMode === "fork") {
      const claimed =
        await deps.sessionMetadataService?.nextForkOrdinal(sessionId);
      const lineageRootId = claimed?.lineageRootId ?? sessionId;
      const forkTitle = deriveForkTitle({
        preferredTitle: originalMetadata?.customTitle,
        sourceSession,
        ordinal: claimed?.ordinal ?? 1,
      });
      let fork: Awaited<ReturnType<Supervisor["forkSession"]>>;
      try {
        fork = await deps.supervisor.forkSession({
          sessionId,
          projectPath: restartProjectPath,
          providerName: sourceProvider,
          upToMessageId: body.forkUpToMessageId,
          title: forkTitle,
          launchOverrides: {
            requestedModel,
            thinking: body.thinking,
            // Already resolved above, model change included, so the fork's own
            // inheritance pass does not have to decide it a second time.
            ultracode,
            permissionMode: restartPermissionMode,
            serviceTier:
              body.serviceTier !== undefined
                ? (serviceTier ?? null)
                : undefined,
          },
          sandboxLevel: restartSandboxLevel,
          sandboxNetworkFirewall: restartSandboxNetworkFirewall,
          sandboxStateKey: originalMetadata?.sandboxStateKey,
        });
      } catch (error) {
        if (claimed && !(error instanceof ForkSettingsPersistenceError)) {
          await deps.sessionMetadataService?.releaseForkOrdinal(claimed);
        }
        getLogger().warn(
          {
            event: "restart_fork_failed",
            sessionId,
            projectId,
            sourceProvider,
            upToMessageId: body.forkUpToMessageId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Transcript fork failed",
        );
        return c.json(
          {
            error:
              error instanceof Error ? error.message : "Transcript fork failed",
          },
          error instanceof RouterUnavailable ? 409 : 500,
        );
      }

      const forkMessage =
        body.reason?.trim() || "Continue from this fork point.";
      const result = await deps.supervisor.resumeSession(
        fork.sessionId,
        restartProjectPath,
        { text: forkMessage, mode: restartPermissionMode },
        restartPermissionMode,
        {
          model,
          requestedModel: requestedModel ?? undefined,
          serviceTier,
          thinking,
          effort,
          ultracode,
          providerName: sourceProvider,
          executor,
          sandboxLevel: restartSandboxLevel,
          sandboxNetworkFirewall: restartSandboxNetworkFirewall,
          sandboxStateKey:
            fork.sandboxStateKey ?? originalMetadata?.sandboxStateKey,
          globalInstructions: getGlobalInstructions(),
          permissions: body.permissions,
          recapMode: helperSettings.recapMode,
          recapAfterSeconds:
            helperSettings.recapAfterSeconds ??
            originalMetadata?.recapAfterSeconds,
          // Inherit the source session's preference unless the body overrides.
          promptSuggestionMode:
            helperSettings.promptSuggestionMode ??
            originalMetadata?.promptSuggestionMode,
          helperSideModel: helperSettings.helperSideModel,
          ...resolveCompactModelSettings(deps, {
            provider: sourceProvider,
            vibeAllDayModelId: requestedModel ?? undefined,
            modelCandidates: [
              body.model,
              model,
              oldProcess?.resolvedModel,
              sourceSession.model,
            ],
          }),
        },
      );

      if (isQueueFullResponse(result)) {
        return c.json(
          { error: "Queue is full", maxQueueSize: result.maxQueueSize },
          503,
        );
      }
      if (isQueuedResponse(result)) {
        deps.supervisor.cancelQueuedRequest(result.queueId);
        return c.json(
          {
            error:
              "Fork could not start immediately; old process was left running",
          },
          503,
        );
      }

      void deps.userUsageService?.recordSession(actingUsername(c));
      await recordCreationProvenance(result.sessionId, body.creationProvenance);
      await persistLaunchMetadata(
        result.sessionId,
        sourceProvider,
        executor,
        undefined,
        requestedModel ?? undefined,
        result.promptSuggestionMode,
        result.recapAfterSeconds,
        originalMetadata?.workstreamId,
        {
          level: restartSandboxLevel,
          networkFirewall: restartSandboxNetworkFirewall,
          stateKey:
            result.sandboxStateKey ??
            fork.sandboxStateKey ??
            originalMetadata?.sandboxStateKey,
          projectPath: restartProjectPath,
          projectId: result.projectId,
        },
      );
      if (deps.sessionMetadataService) {
        await deps.sessionMetadataService.updateMetadata(result.sessionId, {
          title: forkTitle,
          forkLineageRootId: lineageRootId,
        });
        deps.eventBus?.emit({
          type: "session-metadata-changed",
          sessionId: result.sessionId,
          title: forkTitle,
          timestamp: new Date().toISOString(),
        });
      }

      const oldProcessAbortDeferred = abortOldProcessAfterReplacementActivity(
        oldProcess,
        result,
      );

      return c.json({
        sessionId: result.sessionId,
        processId: result.id,
        projectId: result.projectId,
        provider: result.provider,
        model: result.resolvedModel ?? result.model,
        title: forkTitle,
        permissionMode: result.permissionMode,
        appliedPermissionMode: result.appliedPermissionMode,
        modeVersion: result.modeVersion,
        recapAfterSeconds: result.recapAfterSeconds,
        sandboxEnforcement: result.sandboxEnforcement,
        restartedFrom: sessionId,
        forkUpToMessageId: body.forkUpToMessageId,
        oldProcessId: oldProcess?.id,
        oldProcessInterrupted,
        oldProcessAbortDeferred,
        oldProcessAborted: false,
      });
    }

    const handoffTitle = deriveRestartTitle({
      preferredTitle: originalMetadata?.customTitle,
      sourceSession,
    });
    const handoff =
      handoffText ??
      (await buildHandoffText({
        project,
        projectId,
        sessionId,
        handoffTitle,
        sourceSession,
        sourceProvider,
        oldProcess,
        sourceUrl: body.sourceUrl,
        targetExecutor: executor,
        projectPath: restartProjectPath,
      }));

    const result = await deps.supervisor.startSession(
      restartProjectPath,
      {
        text: handoff,
        mode: restartPermissionMode,
      },
      restartPermissionMode,
      {
        model,
        requestedModel: requestedModel ?? undefined,
        serviceTier,
        thinking,
        effort,
        ultracode,
        providerName,
        clientName: "vibeallday",
        executor,
        sandboxLevel: restartSandboxLevel,
        sandboxNetworkFirewall: restartSandboxNetworkFirewall,
        globalInstructions: getGlobalInstructions(),
        permissions: body.permissions,
        recapMode: helperSettings.recapMode,
        recapAfterSeconds:
          helperSettings.recapAfterSeconds ??
          originalMetadata?.recapAfterSeconds,
        // Inherit the source session's preference unless the body overrides.
        promptSuggestionMode:
          helperSettings.promptSuggestionMode ??
          originalMetadata?.promptSuggestionMode,
        helperSideModel: helperSettings.helperSideModel,
        ...resolveCompactModelSettings(deps, {
          provider: providerName,
          vibeAllDayModelId: requestedModel ?? undefined,
          modelCandidates: inheritsSourceProviderSettings
            ? [
                body.model,
                model,
                oldProcess?.resolvedModel,
                sourceSession.model,
              ]
            : [body.model, model],
        }),
      },
    );

    if (isQueueFullResponse(result)) {
      return c.json(
        { error: "Queue is full", maxQueueSize: result.maxQueueSize },
        503,
      );
    }

    if (isQueuedResponse(result)) {
      deps.supervisor.cancelQueuedRequest(result.queueId);
      return c.json(
        {
          error:
            "Restart could not start immediately; old process was left running",
        },
        503,
      );
    }

    void deps.userUsageService?.recordSession(actingUsername(c));
    await recordCreationProvenance(result.sessionId, body.creationProvenance);
    await persistLaunchMetadata(
      result.sessionId,
      providerName,
      executor,
      undefined,
      requestedModel ?? undefined,
      result.promptSuggestionMode,
      result.recapAfterSeconds,
      undefined,
      {
        level: restartSandboxLevel,
        networkFirewall: restartSandboxNetworkFirewall,
        stateKey: result.sandboxStateKey,
        projectPath: result.sandboxProjectPath ?? result.projectPath,
        projectId: result.projectId,
      },
    );
    if (deps.sessionMetadataService) {
      await deps.sessionMetadataService.updateMetadata(result.sessionId, {
        title: handoffTitle,
      });
      deps.eventBus?.emit({
        type: "session-metadata-changed",
        sessionId: result.sessionId,
        title: handoffTitle,
        timestamp: new Date().toISOString(),
      });
    }

    const oldProcessAbortDeferred = abortOldProcessAfterReplacementActivity(
      oldProcess,
      result,
    );

    return c.json({
      sessionId: result.sessionId,
      processId: result.id,
      projectId: result.projectId,
      provider: result.provider,
      model: result.resolvedModel ?? result.model,
      title: handoffTitle,
      permissionMode: result.permissionMode,
      appliedPermissionMode: result.appliedPermissionMode,
      modeVersion: result.modeVersion,
      recapAfterSeconds: result.recapAfterSeconds,
      sandboxEnforcement: result.sandboxEnforcement,
      restartedFrom: sessionId,
      oldProcessId: oldProcess?.id,
      oldProcessInterrupted,
      oldProcessAbortDeferred,
      oldProcessAborted: false,
    });
  });

  // POST /api/projects/:projectId/sessions/:sessionId/stale-handoff
  // A turn refused because its session went cold under the limited-user
  // freshness cutoff, delivered instead as the first turn of a new session
  // seeded with a bounded handoff of the old one
  // (topics/limited-users.md § Freshness). Unlike restart, the source is
  // neither compacted nor interrupted: either would spend the cold context
  // this exists to avoid, and the old session is left exactly as it was.
  routes.post(
    "/projects/:projectId/sessions/:sessionId/stale-handoff",
    async (c) => {
      const projectId = c.req.param("projectId");
      const sessionId = c.req.param("sessionId");
      if (isRoutedSession(sessionId)) {
        return c.json(
          { error: routedSessionUnsupportedMessage("Handoff") },
          409,
        );
      }
      if (!isUrlProjectId(projectId)) {
        return c.json({ error: "Invalid project ID format" }, 400);
      }
      const project = await deps.scanner.getOrCreateProject(projectId);
      if (!project) {
        return c.json(
          { error: "Project not found or path does not exist" },
          404,
        );
      }

      let body: StartSessionBody;
      try {
        body = await c.req.json<StartSessionBody>();
      } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      const modeError = permissionModeError(body.mode);
      if (modeError) {
        return c.json({ error: modeError }, 400);
      }
      if (!hasSessionMessageContent(body)) {
        return c.json({ error: "Message is required" }, 400);
      }

      const originalMetadata =
        deps.sessionMetadataService?.getMetadata?.(sessionId);
      const oldProcess = deps.supervisor.getProcessForSession(sessionId);
      const metadataProvider = deps.sessionMetadataService?.getProvider(
        sessionId,
      ) as ProviderName | undefined;
      const preferredSourceProvider =
        metadataProvider ?? oldProcess?.provider ?? project.provider;
      const sourceSession = await loadRestartSourceSession(
        project,
        sessionId,
        projectId,
        preferredSourceProvider,
        oldProcess,
      );
      if (!sourceSession) {
        return c.json({ error: "Session not found" }, 404);
      }
      const sourceProvider = sourceSession.provider ?? preferredSourceProvider;

      // The request names no launch settings: the lock supplies what it
      // fixes, the source session the rest, so nothing here can conflict
      // with the lock.
      const launchBody: LimitedLaunchBody = {};
      const limitedLaunch = applyLimitedLaunchPolicy(c, launchBody);
      if (limitedLaunch.kind === "error") {
        return c.json({ error: limitedLaunch.error }, 403);
      }
      const limited = limitedLaunch.kind === "applied";
      const sandbox: { level: SessionSandboxLevel; networkFirewall: boolean } =
        limited
          ? { level: "project-write", networkFirewall: true }
          : {
              level: originalMetadata?.sandboxLevel ?? "none",
              networkFirewall:
                persistedSandboxNetworkFirewall(originalMetadata),
            };
      const parsedExecutor = limited
        ? { executor: undefined }
        : parseOptionalExecutor(
            deps.sessionMetadataService?.getExecutor(sessionId),
          );
      if ("error" in parsedExecutor && parsedExecutor.error) {
        return c.json({ error: parsedExecutor.error }, 400);
      }
      const executor = parsedExecutor.executor;
      const providerName =
        (launchBody.provider as ProviderName | undefined) ?? sourceProvider;
      const {
        requestedModel,
        thinking,
        effort,
        ultracode,
        serviceTier,
        permissionMode,
      } = inheritSuccessorLaunchSettings(
        originalMetadata?.effectiveLaunchSettings,
        {
          sameProvider: providerName === sourceProvider,
          legacyRequestedModel: () =>
            deps.sessionMetadataService?.getRequestedModel(sessionId),
        },
        {
          requestedModel: launchBody.model,
          thinking: launchBody.thinking as ThinkingOption | undefined,
          permissionMode: body.mode,
        },
      );
      const model =
        requestedModel && requestedModel !== "default"
          ? requestedModel
          : undefined;
      const projectPath =
        originalMetadata?.sandboxLevel === "project-write"
          ? (originalMetadata.sandboxProjectPath ?? project.path)
          : project.path;

      const handoffTitle = deriveRestartTitle({
        preferredTitle: originalMetadata?.customTitle,
        sourceSession,
      });
      const handoff = await buildHandoffText({
        project,
        projectId,
        sessionId,
        handoffTitle,
        sourceSession,
        sourceProvider,
        oldProcess,
        targetExecutor: executor,
        projectPath,
        purpose: "cold-session",
      });
      const serverTimestamp = Date.now();
      const userMessage: UserMessage = {
        text: `${handoff}\n\n## New Message\n\n${body.message}`,
        images: body.images,
        documents: body.documents,
        attachments: body.attachments,
        mode: body.mode,
        tempId: body.tempId,
        metadata: buildUserMessageMetadata(
          body,
          serverTimestamp,
          "direct",
          actingUsername(c),
        ),
      };

      const result = await deps.supervisor.startSession(
        projectPath,
        userMessage,
        permissionMode,
        {
          model,
          requestedModel: requestedModel ?? undefined,
          serviceTier,
          thinking,
          effort,
          ultracode,
          providerName,
          executor,
          sandboxLevel: sandbox.level,
          sandboxNetworkFirewall: sandbox.networkFirewall,
          instructionUsername: actingUsername(c),
          globalInstructions: getGlobalInstructions(),
          recapAfterSeconds: originalMetadata?.recapAfterSeconds,
          promptSuggestionMode: originalMetadata?.promptSuggestionMode,
          ...resolveCompactModelSettings(deps, {
            provider: providerName,
            vibeAllDayModelId: requestedModel ?? undefined,
            modelCandidates: [model, sourceSession.model],
          }),
        },
        {
          projectId: project.id,
          onStarted: (_sessionId, process) =>
            recordNewSessionLaunch(process, {
              heartbeatProjectId: project.id,
              creationProvenance: body.creationProvenance,
              createdByUser: limited ? limitedLaunch.username : undefined,
              provider: providerName,
              executor,
              initialPrompt: body.message,
              requestedModel: requestedModel ?? undefined,
              recapAfterSeconds: originalMetadata?.recapAfterSeconds,
              sandbox,
            }),
        },
      );
      if (isQueueFullResponse(result)) {
        return c.json(
          { error: "Queue is full", maxQueueSize: result.maxQueueSize },
          503,
        );
      }
      void deps.userUsageService?.recordSession(actingUsername(c));
      void deps.userUsageService?.recordTurn(actingUsername(c), body.message);
      if (isQueuedResponse(result)) {
        return c.json({ ...result, serverTimestamp }, 202);
      }

      if (deps.sessionMetadataService) {
        await deps.sessionMetadataService.updateMetadata(result.sessionId, {
          title: handoffTitle,
        });
        deps.eventBus?.emit({
          type: "session-metadata-changed",
          sessionId: result.sessionId,
          title: handoffTitle,
          timestamp: new Date().toISOString(),
        });
      }
      return c.json({
        sessionId: result.sessionId,
        processId: result.id,
        projectId: result.projectId,
        provider: result.provider,
        model: result.resolvedModel ?? result.model,
        title: handoffTitle,
        permissionMode: result.permissionMode,
        appliedPermissionMode: result.appliedPermissionMode,
        modeVersion: result.modeVersion,
        recapAfterSeconds: result.recapAfterSeconds,
        sandboxEnforcement: result.sandboxEnforcement,
        serverTimestamp,
        staleHandoffFrom: sessionId,
      });
    },
  );

  // POST /api/projects/:projectId/sessions/:sessionId/fork
  // Fork the provider transcript into a new resumable session without
  // starting a process or sending any message ("fork from here" / rewind).
  // The forked session opens cold; the next user send resumes it normally.
  // ---------------------------------------------------------------------
  // Same-session rewind, /clear N, and /clearloop (topics/session-rewind.md)
  // ---------------------------------------------------------------------

  type RewindCut = {
    kind: "after-user-turn" | "before-user-turn";
    sourceMessageId: string;
  };

  type RewindFailure = { ok: false; error: string; status: 400 | 404 | 409 };
  type RewindSuccess = {
    ok: true;
    /** Null when the cut was already the tail and nothing was dropped. */
    record: SessionRewindRecord | null;
    cutMessageId: string;
    processAborted: boolean;
  };

  /** A session as one rewind command read it, shared by its steps. */
  type RewindSource = {
    providerName: ProviderName;
    process: Process | undefined;
    session: Session | null;
  };

  const isRewindProvider = (providerName: ProviderName): boolean =>
    isClaudeSdkProviderName(providerName);

  const resolveRewindProvider = async (
    project: Project,
    projectId: UrlProjectId,
    sessionId: string,
  ): Promise<{ providerName: ProviderName; process: Process | undefined }> => {
    const process = deps.supervisor.getProcessForSession(sessionId);
    const metadataProvider = deps.sessionMetadataService?.getProvider(
      sessionId,
    ) as ProviderName | undefined;
    let providerName = process?.provider ?? metadataProvider;
    if (!providerName) {
      const summary = await findSessionListSummaryAcrossProviders(
        project,
        sessionId,
        projectId,
        providerResolutionDeps(deps),
        undefined,
      );
      providerName = summary?.source.provider ?? project.provider;
    }
    return { providerName, process };
  };

  /**
   * Drop everything after `cutMessageId` from the live conversation: record
   * the rewind, arm it for the next resume, and stop the live process so that
   * resume happens. The transcript file is untouched; the reader groups the
   * dropped rows from the record.
   */
  const rewindSessionToCut = async (input: {
    project: Project;
    projectId: UrlProjectId;
    sessionId: string;
    cutMessageId: string;
    cutTurnIndex: number;
    reason: SessionRewindReason;
    clearloopId?: string;
    clearloopIteration?: number;
    clearloopTotal?: number;
    clearloopPrompt?: string;
    /** The session as the caller just resolved it; absent loads it here. */
    source?: RewindSource;
  }): Promise<RewindFailure | RewindSuccess> => {
    const { project, projectId, sessionId } = input;
    const { providerName, process } =
      input.source ??
      (await resolveRewindProvider(project, projectId, sessionId));
    if (!isRewindProvider(providerName)) {
      return {
        ok: false,
        error: `${providerName} does not support same-session rewind`,
        status: 409,
      };
    }
    if (deps.externalTracker?.isExternal(sessionId)) {
      return {
        ok: false,
        error: "The session is being written by another process",
        status: 409,
      };
    }
    if (
      process &&
      (process.state.type === "in-turn" ||
        process.state.type === "waiting-input")
    ) {
      return {
        ok: false,
        error:
          "Rewind is available after the current response completes. Nothing was changed.",
        status: 409,
      };
    }
    if (process && process.getDeferredQueueSummary().length > 0) {
      return {
        ok: false,
        error:
          "Cancel or deliver the queued messages before rewinding. Nothing was changed.",
        status: 409,
      };
    }
    const session = input.source
      ? input.source.session
      : await loadRestartSourceSession(
          project,
          sessionId,
          projectId,
          providerName,
          process,
        );
    if (!session) {
      return { ok: false, error: "Session not found", status: 404 };
    }
    const cutIndex = session.messages.findIndex(
      (message) =>
        messageId(message) === input.cutMessageId && !message.rewoundGroupId,
    );
    if (cutIndex < 0) {
      return {
        ok: false,
        error: "The rewind cut is no longer in the session",
        status: 409,
      };
    }
    let droppedTurnCount = 0;
    let droppedFromMessageId: string | undefined;
    let droppedPromptIds: string[] = [];
    for (let index = cutIndex + 1; index < session.messages.length; index++) {
      const message = session.messages[index];
      if (!message || message.rewoundGroupId) continue;
      if (isRealUserTurn(message)) {
        droppedTurnCount += 1;
        const id = messageId(message);
        if (id) {
          droppedFromMessageId ??= id;
          droppedPromptIds.push(id);
        }
      }
    }
    const hasTail = session.messages
      .slice(cutIndex + 1)
      .some(
        (message) => !message.rewoundGroupId && Boolean(messageId(message)),
      );
    if (!hasTail) {
      return {
        ok: true,
        record: null,
        cutMessageId: input.cutMessageId,
        processAborted: false,
      };
    }
    // The drop guard protects a hand-picked `/clear N` from discarding what
    // the user never saw. A clearloop iteration is discarded whole by
    // contract, task notifications and absorbed queued messages included.
    if (droppedTurnCount > 1 || input.reason === "clearloop") {
      droppedPromptIds = [];
    }

    let processAborted = false;
    if (process) {
      await deps.supervisor.abortSessionWithVerification(sessionId);
      processAborted = true;
    }
    const droppedThroughMessageId = await readRewindBoundRowId(
      project,
      sessionId,
      projectId,
      providerName,
    );
    if (!droppedThroughMessageId) {
      console.warn(
        `Rewind of ${sessionId} found no transcript rows on disk; its group falls back to timestamps`,
      );
    }
    const record: SessionRewindRecord = {
      id: randomUUID(),
      at: new Date().toISOString(),
      cutMessageId: input.cutMessageId,
      cutTurnIndex: input.cutTurnIndex,
      ...(droppedFromMessageId ? { droppedFromMessageId } : {}),
      ...(droppedThroughMessageId ? { droppedThroughMessageId } : {}),
      droppedTurnCount,
      reason: input.reason,
      ...(input.clearloopId ? { clearloopId: input.clearloopId } : {}),
      ...(input.clearloopIteration !== undefined
        ? { clearloopIteration: input.clearloopIteration }
        : {}),
      ...(input.clearloopTotal !== undefined
        ? { clearloopTotal: input.clearloopTotal }
        : {}),
      ...(input.clearloopPrompt
        ? { clearloopPrompt: input.clearloopPrompt }
        : {}),
    };
    await deps.sessionMetadataService?.addRewindRecord(sessionId, record, {
      recordId: record.id,
      cutMessageId: input.cutMessageId,
      ...(droppedPromptIds.length === 1
        ? { dropsTurnPromptId: droppedPromptIds[0] }
        : {}),
    });
    deps.eventBus?.emit({
      type: "session-metadata-changed",
      sessionId,
      projectId,
      rewindRecord: record,
      timestamp: new Date().toISOString(),
    });
    return {
      ok: true,
      record,
      cutMessageId: input.cutMessageId,
      processAborted,
    };
  };

  /** Resolve a turn-relative cut to the provider chain entry it keeps. */
  const resolveRewindCut = (
    source: RewindSource & { session: Session },
    sessionId: string,
    cut: RewindCut,
  ):
    | RewindFailure
    | { ok: true; cutMessageId: string; cutTurnIndex: number } => {
    const { providerName, process, session } = source;
    // Numbering spans the full sequence, cleared turns included, but a cut
    // inside a cleared span is a tree hop whose UI is unspecified; refuse it
    // (topics/session-rewind.md § Vocabulary).
    const sourceMessage = session.messages.find(
      (message) => messageId(message) === cut.sourceMessageId,
    );
    if (sourceMessage?.rewoundGroupId) {
      return {
        ok: false,
        error:
          "That turn is inside a cleared span; rewinding into cleared history is not supported yet",
        status: 409,
      };
    }
    const messages = session.messages.filter(
      (message) =>
        (message as { subtype?: unknown }).subtype !== "rewound_group",
    );
    const sourceIsBusy = Boolean(
      deps.externalTracker?.isExternal(sessionId) ||
        process?.state.type === "in-turn" ||
        process?.state.type === "waiting-input",
    );
    const boundary =
      cut.kind === "before-user-turn"
        ? resolveForkBeforeBoundary(messages, cut.sourceMessageId, providerName)
        : resolveForkAfterBoundary(
            messages,
            cut.sourceMessageId,
            sourceIsBusy,
            providerName,
          );
    if ("error" in boundary) {
      return { ok: false, error: boundary.error, status: boundary.status };
    }
    if (boundary.providerBoundary?.kind !== "message") {
      return {
        ok: false,
        error: "Same-session rewind needs a Claude transcript boundary",
        status: 409,
      };
    }
    // The kept turn's stamped ordinal is the record's N: the same number the
    // turn menu shows, so `/clear N` and the label agree by construction.
    // A before cut keeps the previous turn on the source's chain, which a
    // clear may have put well below N−1. The boundary above already refused
    // non-turns; a kept turn that still has no stamp came from an
    // unnormalized history and has no N to record.
    const keptTurn =
      cut.kind === "before-user-turn" && sourceMessage
        ? precedingChainTurn(messages, sourceMessage)
        : sourceMessage;
    const cutTurnIndex = turnIndexOf(keptTurn);
    if (cutTurnIndex === undefined) {
      return {
        ok: false,
        error: "That message is not a user turn",
        status: 409,
      };
    }
    return {
      ok: true,
      cutMessageId: boundary.providerBoundary.messageId,
      cutTurnIndex,
    };
  };

  const parseRewindCut = (body: unknown): RewindCut | { error: string } => {
    if (!body || typeof body !== "object") return { error: "Invalid body" };
    const cut = (body as { cut?: unknown }).cut;
    if (!cut || typeof cut !== "object") return { error: "cut is required" };
    const kind = (cut as { kind?: unknown }).kind;
    const sourceMessageId = (cut as { sourceMessageId?: unknown })
      .sourceMessageId;
    if (kind !== "after-user-turn" && kind !== "before-user-turn") {
      return { error: "cut.kind must be after-user-turn or before-user-turn" };
    }
    if (typeof sourceMessageId !== "string" || !sourceMessageId.trim()) {
      return { error: "cut.sourceMessageId is required" };
    }
    return { kind, sourceMessageId: sourceMessageId.trim() };
  };

  /** Resume the session with one direct prompt using its saved launch settings. */
  const sendClearloopPrompt = async (input: {
    project: Project;
    projectId: UrlProjectId;
    sessionId: string;
    prompt: string;
  }): Promise<void> => {
    const { project, projectId, sessionId } = input;
    const { providerName } = await resolveRewindProvider(
      project,
      projectId,
      sessionId,
    );
    // No client asks for this turn, so the settings the session last applied
    // stand in for the choices a resume request would carry.
    const saved =
      deps.sessionMetadataService?.getEffectiveLaunchSettings?.(sessionId);
    const launch = buildResumeLaunch({
      sessionId,
      providerName,
      workingProjectPath: project.path,
      request: {
        serviceTier: saved?.serviceTier ?? undefined,
        thinking: saved?.thinking ?? undefined,
        effort: saved?.effort ?? undefined,
        ultracode: saved?.ultracode,
        // The iteration's rewind is armed as the session's pending rewind;
        // the supervisor applies it when this resume launches the process.
        resumeMode: "full",
      },
    });
    if ("error" in launch) throw new Error(launch.error);
    const userMessage: UserMessage = {
      text: input.prompt,
      // VIBEALLDAY-injected, not a principal's turn: no sender and no usage record.
      metadata: buildUserMessageMetadata({}, Date.now(), "direct"),
    };
    const result = await deps.supervisor.resumeSession(
      sessionId,
      launch.projectPath,
      userMessage,
      saved?.permissionMode,
      launch.settings,
      { requireProviderSessionId: true },
    );
    if (isQueueFullResponse(result)) {
      throw new Error("Queue is full");
    }
  };

  deps.clearloopService?.setRunner({
    rewind: async ({ sessionId, projectId, job, iteration }) => {
      const project = await deps.scanner.getOrCreateProject(projectId);
      if (!project) throw new Error("Project not found");
      const result = await rewindSessionToCut({
        project,
        projectId,
        sessionId,
        cutMessageId: job.cutMessageId,
        cutTurnIndex: job.cutTurnIndex,
        reason: "clearloop",
        clearloopId: job.id,
        clearloopIteration: iteration,
        clearloopTotal: job.total,
        clearloopPrompt: job.prompt,
      });
      if (!result.ok) throw new Error(result.error);
      return result.record ? "rewound" : "noop";
    },
    send: async ({ sessionId, projectId, job }) => {
      const project = await deps.scanner.getOrCreateProject(projectId);
      if (!project) throw new Error("Project not found");
      await sendClearloopPrompt({
        project,
        projectId,
        sessionId,
        prompt: job.prompt,
      });
    },
  });

  /**
   * The user turn a typed rewind command names: turn `N`, or the session's
   * last real turn when the command gave no number. Queued commands resolve
   * this at dispatch, so `/clearloop 3: p` queued now loops over whatever the
   * tail is when the project finally goes quiet.
   */
  const typedTurnSourceMessageId = (
    session: Session,
    turnIndex: number | undefined,
  ): RewindFailure | { ok: true; sourceMessageId: string } => {
    const turns = session.messages.filter(
      (message) =>
        !message.rewoundGroupId && turnIndexOf(message) !== undefined,
    );
    const target =
      turnIndex === undefined
        ? turns[turns.length - 1]
        : turns.find((message) => turnIndexOf(message) === turnIndex);
    if (!target) {
      return {
        ok: false,
        error:
          turnIndex === undefined
            ? "The session has no turns to rewind to"
            : `Turn ${turnIndex} is not in the session`,
        status: 409,
      };
    }
    const id = messageId(target);
    if (!id) {
      return { ok: false, error: "That turn has no id", status: 409 };
    }
    return { ok: true, sourceMessageId: id };
  };

  /**
   * The one server operation behind `/clear N` and `/clearloop`, whether the
   * composer sent it or Project Queue dispatched it: refuse what rewind cannot
   * do, read the session once, resolve the kept turn, then rewind or start the
   * loop (topics/session-rewind.md).
   */
  const runRewindCommand = async (input: {
    project: Project;
    projectId: UrlProjectId;
    sessionId: string;
    /** An explicit cut, or typed turn N (the last real turn when absent). */
    target: { cut: RewindCut } | { turnIndex?: number };
    action:
      | { name: "clear" }
      | {
          name: "clearloop";
          prompt: string;
          total: number;
          commandText: string;
          patient: boolean;
        };
  }): Promise<
    | RewindFailure
    | { ok: true; rewind: RewindSuccess }
    | {
        ok: true;
        job: Awaited<ReturnType<ClearloopService["start"]>>;
      }
  > => {
    const { project, projectId, sessionId, action } = input;
    const clearloopService = deps.clearloopService;
    if (action.name === "clear" && clearloopService?.isRunning(sessionId)) {
      return {
        ok: false,
        error: "Cancel the running /clearloop before rewinding",
        status: 409,
      };
    }
    const { providerName, process } = await resolveRewindProvider(
      project,
      projectId,
      sessionId,
    );
    if (!isRewindProvider(providerName)) {
      return {
        ok: false,
        error: `${providerName} does not support same-session rewind`,
        status: 409,
      };
    }
    const session = await loadRestartSourceSession(
      project,
      sessionId,
      projectId,
      providerName,
      process,
    );
    if (!session) {
      return { ok: false, error: "Session not found", status: 404 };
    }
    const source = { providerName, process, session };
    let cut: RewindCut;
    if ("cut" in input.target) {
      cut = input.target.cut;
    } else {
      const typed = typedTurnSourceMessageId(session, input.target.turnIndex);
      if (!typed.ok) return typed;
      cut = { kind: "after-user-turn", sourceMessageId: typed.sourceMessageId };
    }
    const resolved = resolveRewindCut(source, sessionId, cut);
    if (!resolved.ok) return resolved;
    if (action.name === "clear") {
      const rewind = await rewindSessionToCut({
        project,
        projectId,
        sessionId,
        cutMessageId: resolved.cutMessageId,
        cutTurnIndex: resolved.cutTurnIndex,
        reason: "clear",
        source,
      });
      return rewind.ok ? { ok: true, rewind } : rewind;
    }
    if (!clearloopService) {
      return { ok: false, error: "clearloop is not available", status: 404 };
    }
    try {
      const job = await clearloopService.start(sessionId, projectId, {
        cutMessageId: resolved.cutMessageId,
        cutTurnIndex: resolved.cutTurnIndex,
        prompt: action.prompt,
        total: action.total,
        commandText: action.commandText,
        ...(action.patient ? { patient: true } : {}),
      });
      return { ok: true, job };
    } catch (error) {
      if (error instanceof ClearloopConflictError) {
        return { ok: false, error: error.message, status: 409 };
      }
      throw error;
    }
  };

  // Route tests supply a partial scheduler; the runner is optional like the
  // other scheduler hooks this module calls.
  deps.projectQueueScheduler?.setVibeAllDayCommandRunner?.({
    run: async ({ sessionId, projectId, command, commandText }) => {
      const project = await deps.scanner.getOrCreateProject(projectId);
      if (!project) throw new Error("Project not found");
      // The queue refused an unreadable argument when the item was queued,
      // edited, or loaded; the scheduler hands over only commands that read.
      const reading = readQueuedVibeAllDayCommand(command);
      if (!reading.ok) {
        throw new Error(
          describeQueuedVibeAllDayCommandProblem(command, reading.problem),
        );
      }
      const { action } = reading;
      const turnArgument =
        action.name === "clear" ? action.turnIndex : action.arguments.turnIndex;
      // A refusal fails the queued item, which keeps its text for Retry.
      const result = await runRewindCommand({
        project,
        projectId,
        sessionId,
        target: turnArgument === undefined ? {} : { turnIndex: turnArgument },
        action:
          action.name === "clearloop"
            ? {
                name: "clearloop",
                prompt: action.arguments.prompt,
                total: action.arguments.total,
                commandText,
                // The user chose a lane that waits for the project; the loop it
                // starts keeps waiting (topics/project-queue.md § Queued VIBEALLDAY
                // commands).
                patient: true,
              }
            : { name: "clear" },
      });
      if (!result.ok) throw new Error(result.error);
    },
  });

  // POST /api/projects/:projectId/sessions/:sessionId/rewind
  routes.post("/projects/:projectId/sessions/:sessionId/rewind", async (c) => {
    const projectId = c.req.param("projectId");
    const sessionId = c.req.param("sessionId");
    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }
    const project = await deps.scanner.getOrCreateProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found or path does not exist" }, 404);
    }
    let body: unknown;
    try {
      body = await c.req.json<unknown>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const cut = parseRewindCut(body);
    if ("error" in cut) return c.json({ error: cut.error }, 400);
    const result = await runRewindCommand({
      project,
      projectId,
      sessionId,
      target: { cut },
      action: { name: "clear" },
    });
    if (!result.ok) {
      return c.json({ error: result.error }, result.status);
    }
    if (!("rewind" in result)) {
      throw new Error("A clear command returned no rewind result");
    }
    const { rewind } = result;
    return c.json({
      record: rewind.record,
      cutMessageId: rewind.cutMessageId,
      noop: rewind.record === null,
      processAborted: rewind.processAborted,
    });
  });

  // POST /api/projects/:projectId/sessions/:sessionId/clearloop
  routes.post(
    "/projects/:projectId/sessions/:sessionId/clearloop",
    async (c) => {
      const projectId = c.req.param("projectId");
      const sessionId = c.req.param("sessionId");
      if (!isUrlProjectId(projectId)) {
        return c.json({ error: "Invalid project ID format" }, 400);
      }
      if (!deps.clearloopService) {
        return c.json({ error: "clearloop is not available" }, 404);
      }
      const project = await deps.scanner.getOrCreateProject(projectId);
      if (!project) {
        return c.json(
          { error: "Project not found or path does not exist" },
          404,
        );
      }
      let body: unknown;
      try {
        body = await c.req.json<unknown>();
      } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      const cut = parseRewindCut(body);
      if ("error" in cut) return c.json({ error: cut.error }, 400);
      const record = body as {
        prompt?: unknown;
        total?: unknown;
        commandText?: unknown;
        patient?: unknown;
      };
      const prompt =
        typeof record.prompt === "string" ? record.prompt.trim() : "";
      const total = record.total;
      if (!prompt) return c.json({ error: "prompt is required" }, 400);
      if (
        typeof total !== "number" ||
        !Number.isInteger(total) ||
        total < 1 ||
        total > 10_000
      ) {
        return c.json({ error: "total must be an integer from 1" }, 400);
      }
      const commandText =
        typeof record.commandText === "string" && record.commandText.trim()
          ? record.commandText.trim()
          : `/clearloop ${total}: ${prompt}`;
      const result = await runRewindCommand({
        project,
        projectId,
        sessionId,
        target: { cut },
        action: {
          name: "clearloop",
          prompt,
          total,
          commandText,
          patient: record.patient === true,
        },
      });
      if (!result.ok) {
        return c.json({ error: result.error }, result.status);
      }
      if (!("job" in result)) {
        throw new Error("A clearloop command returned no job");
      }
      return c.json({ job: result.job }, 202);
    },
  );

  // PATCH /api/projects/:projectId/sessions/:sessionId/clearloop
  // Runtime controls on a running loop: the project-idle wait, and Start now.
  routes.patch(
    "/projects/:projectId/sessions/:sessionId/clearloop",
    async (c) => {
      const sessionId = c.req.param("sessionId");
      if (!deps.clearloopService) {
        return c.json({ error: "clearloop is not available" }, 404);
      }
      let body: unknown;
      try {
        body = await c.req.json<unknown>();
      } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      const request = (body ?? {}) as UpdateClearloopRequest;
      if (
        request.patient !== undefined &&
        typeof request.patient !== "boolean"
      ) {
        return c.json({ error: "patient must be a boolean" }, 400);
      }
      if (request.patient === undefined && request.startNow !== true) {
        return c.json({ error: "patient or startNow is required" }, 400);
      }
      try {
        let job =
          request.patient === undefined
            ? deps.clearloopService.getRunningJob(sessionId)
            : await deps.clearloopService.setPatience(
                sessionId,
                request.patient,
              );
        if (job && request.startNow === true) {
          job = await deps.clearloopService.startNow(sessionId);
        }
        if (!job) return c.json({ error: "No running /clearloop" }, 404);
        return c.json({ job });
      } catch (error) {
        if (error instanceof ClearloopConflictError) {
          return c.json({ error: error.message }, 409);
        }
        throw error;
      }
    },
  );

  // DELETE /api/projects/:projectId/sessions/:sessionId/clearloop
  // Cancels without stopping in-flight work or starting a turn.
  routes.delete(
    "/projects/:projectId/sessions/:sessionId/clearloop",
    async (c) => {
      const sessionId = c.req.param("sessionId");
      const job = await deps.clearloopService?.cancel(sessionId);
      if (!job) {
        return c.json({ error: "No running /clearloop" }, 404);
      }
      return c.json({ job });
    },
  );

  routes.post("/projects/:projectId/sessions/:sessionId/fork", async (c) => {
    const projectId = c.req.param("projectId");
    const sessionId = c.req.param("sessionId");

    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }
    const project = await deps.scanner.getOrCreateProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found or path does not exist" }, 404);
    }

    let body: {
      forkKind?: unknown;
      sourceMessageId?: unknown;
      upToMessageId?: unknown;
      thinking?: unknown;
      creationProvenance?: unknown;
    } = {};
    try {
      const parsed = await c.req.json<unknown>();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      body = parsed as typeof body;
    } catch {
      // Body is optional; full-transcript fork.
    }
    let forkThinking: ThinkingOption | undefined;
    if (body.thinking !== undefined) {
      if (!isThinkingOption(body.thinking)) {
        return c.json(
          { error: "thinking must be off, auto, or on:<effort level>" },
          400,
        );
      }
      forkThinking = body.thinking;
    }
    const hasIntentFields =
      body.forkKind !== undefined || body.sourceMessageId !== undefined;
    if (hasIntentFields && body.upToMessageId !== undefined) {
      return c.json(
        {
          error:
            "forkKind/sourceMessageId cannot be combined with upToMessageId",
        },
        400,
      );
    }
    const forkKind =
      body.forkKind === "clone-latest-complete" ||
      body.forkKind === "before-user-turn" ||
      body.forkKind === "after-user-turn"
        ? (body.forkKind as SessionForkKind)
        : undefined;
    if (hasIntentFields && !forkKind) {
      return c.json({ error: "Invalid forkKind" }, 400);
    }
    const sourceMessageId =
      typeof body.sourceMessageId === "string" && body.sourceMessageId.trim()
        ? body.sourceMessageId.trim()
        : undefined;
    if (
      (forkKind === "before-user-turn" || forkKind === "after-user-turn") &&
      !sourceMessageId
    ) {
      return c.json({ error: "sourceMessageId is required" }, 400);
    }
    if (forkKind === "clone-latest-complete" && sourceMessageId) {
      return c.json(
        { error: "clone-latest-complete does not accept sourceMessageId" },
        400,
      );
    }
    const upToMessageId =
      typeof body.upToMessageId === "string" && body.upToMessageId
        ? body.upToMessageId
        : undefined;

    const metadataProvider = deps.sessionMetadataService?.getProvider(
      sessionId,
    ) as ProviderName | undefined;
    const sourceProcess = deps.supervisor.getProcessForSession(sessionId);
    const sessionSummaryResult = await findSessionListSummaryAcrossProviders(
      project,
      sessionId,
      projectId,
      providerResolutionDeps(deps),
      sourceProcess?.provider ?? metadataProvider,
    );
    const sessionSummary = sessionSummaryResult?.summary ?? null;
    const providerName =
      sourceProcess?.provider ??
      metadataProvider ??
      sessionSummaryResult?.source.provider ??
      project.provider;
    if (!deps.supervisor.supportsForkSession(providerName)) {
      return c.json(
        { error: `${providerName} does not support transcript fork` },
        400,
      );
    }

    const sourceIsBusy = Boolean(
      deps.externalTracker?.isExternal(sessionId) ||
        sourceProcess?.state.type === "in-turn" ||
        sourceProcess?.state.type === "waiting-input",
    );
    let providerBoundary: ProviderForkBoundary | undefined;
    let retainedThroughMessageId: string | undefined;
    if (forkKind === "clone-latest-complete" && sourceIsBusy) {
      return c.json(
        {
          error:
            "Clone is available after the current response completes. No new session was created and the source is unchanged.",
        },
        409,
      );
    }
    if (
      (forkKind === "before-user-turn" || forkKind === "after-user-turn") &&
      sourceMessageId
    ) {
      const sourceSession = await loadRestartSourceSession(
        project,
        sessionId,
        projectId,
        providerName,
        sourceProcess,
      );
      if (!sourceSession) {
        return c.json({ error: "Source session not found" }, 404);
      }
      const boundary =
        forkKind === "before-user-turn"
          ? resolveForkBeforeBoundary(
              sourceSession.messages,
              sourceMessageId,
              providerName,
            )
          : resolveForkAfterBoundary(
              sourceSession.messages,
              sourceMessageId,
              sourceIsBusy,
              providerName,
            );
      if ("error" in boundary) {
        return c.json({ error: boundary.error }, boundary.status);
      }
      if (!boundary.providerBoundary) {
        return c.json(
          { error: "Completed turn provider boundary is unavailable" },
          409,
        );
      }
      providerBoundary = boundary.providerBoundary;
      retainedThroughMessageId = boundary.retainedThroughMessageId;
    }

    const originalMetadata =
      deps.sessionMetadataService?.getMetadata?.(sessionId);
    const forkProjectPath =
      originalMetadata?.sandboxLevel === "project-write"
        ? (originalMetadata.sandboxProjectPath ?? project.path)
        : project.path;
    let baseTitle = normalizeRestartTitleCandidate(
      originalMetadata?.customTitle,
    );
    if (!baseTitle) {
      baseTitle = normalizeRestartTitleCandidate(sessionSummary?.title);
    }
    const titlePrefix = forkKind === "clone-latest-complete" ? "Clone" : "Fork";
    const claimed = baseTitle
      ? await deps.sessionMetadataService?.nextForkOrdinal(sessionId)
      : undefined;
    const forkLineageRootId =
      claimed?.lineageRootId ??
      deps.sessionMetadataService?.forkLineageRoot(sessionId) ??
      sessionId;
    const forkTitle = baseTitle
      ? forkTitleWithOrdinal(baseTitle, claimed?.ordinal ?? 1, titlePrefix)
      : undefined;

    let fork: Awaited<ReturnType<Supervisor["forkSession"]>>;
    try {
      fork = await deps.supervisor.forkSession({
        sessionId,
        projectPath: forkProjectPath,
        providerName,
        upToMessageId,
        boundary: providerBoundary,
        title: forkTitle,
        ...(forkThinking !== undefined
          ? { launchOverrides: { thinking: forkThinking } }
          : {}),
        ...inheritedSandboxSettings(originalMetadata),
      });
    } catch (error) {
      if (claimed && !(error instanceof ForkSettingsPersistenceError)) {
        await deps.sessionMetadataService?.releaseForkOrdinal(claimed);
      }
      getLogger().warn(
        {
          event: "session_fork_failed",
          sessionId,
          projectId,
          providerName,
          forkKind: forkKind ?? null,
          sourceMessageId: sourceMessageId ?? null,
          retainedThroughMessageId: retainedThroughMessageId ?? null,
          upToMessageId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Transcript fork failed",
      );
      // A copy of a pinned session that could not keep its account.
      if (error instanceof RouterUnavailable) {
        return c.json({ error: error.message }, 409);
      }
      return c.json(
        hasIntentFields && !(error instanceof ForkSettingsPersistenceError)
          ? {
              error:
                "No new session was created. The source session is unchanged. Try again after the selected response completes.",
              detail:
                error instanceof Error
                  ? error.message
                  : "Transcript fork failed",
            }
          : {
              error:
                error instanceof Error
                  ? error.message
                  : "Transcript fork failed",
            },
        500,
      );
    }

    const savedExecutor = parseOptionalExecutor(
      deps.sessionMetadataService?.getExecutor(sessionId),
    ).executor;
    let inheritedModel = fork.launchSettings
      ? (fork.launchSettings.requestedModel ?? undefined)
      : resolveInheritedForkModel(
          deps.sessionMetadataService?.getRequestedModel(sessionId),
          sourceProcess?.resolvedModel,
          sourceProcess?.model,
        );
    if (!fork.launchSettings && !inheritedModel) {
      const fullSummary = await findSessionSummaryAcrossProviders(
        project,
        sessionId,
        projectId,
        providerResolutionDeps(deps),
        providerName,
      );
      inheritedModel = resolveInheritedForkModel(
        deps.sessionMetadataService?.getRequestedModel(sessionId),
        fullSummary?.summary.model,
      );
    }
    await persistLaunchMetadata(
      fork.sessionId,
      providerName,
      savedExecutor,
      undefined,
      inheritedModel,
      originalMetadata?.promptSuggestionMode,
      originalMetadata?.recapAfterSeconds,
      originalMetadata?.workstreamId,
      {
        level: originalMetadata?.sandboxLevel ?? "none",
        networkFirewall: persistedSandboxNetworkFirewall(originalMetadata),
        stateKey: fork.sandboxStateKey ?? originalMetadata?.sandboxStateKey,
        projectPath: forkProjectPath,
        projectId:
          originalMetadata?.workingProjectId ?? (projectId as UrlProjectId),
      },
    );
    await recordCreationProvenance(fork.sessionId, body.creationProvenance);
    const forkCreator = actingUsername(c);
    if (forkCreator) {
      // A limited user's fork is theirs, like a session they start
      // (topics/limited-users.md § Delivery v1).
      await deps.sessionMetadataService?.recordSessionCreator(
        fork.sessionId,
        forkCreator,
      );
    }
    void deps.userUsageService?.recordSession(forkCreator);
    if (deps.sessionMetadataService) {
      await deps.sessionMetadataService.updateMetadata(fork.sessionId, {
        title: forkTitle,
        forkedFromSessionId: sessionId,
        forkLineageRootId,
      });
      deps.eventBus?.emit({
        type: "session-metadata-changed",
        sessionId: fork.sessionId,
        title: forkTitle,
        forkedFromSessionId: sessionId,
        timestamp: new Date().toISOString(),
      });
    }

    return c.json({
      sessionId: fork.sessionId,
      projectId,
      provider: providerName,
      title: forkTitle,
      forkedFrom: sessionId,
      upToMessageId,
      ...(forkKind ? { forkKind } : {}),
      ...(sourceMessageId ? { sourceMessageId } : {}),
      ...(retainedThroughMessageId ? { retainedThroughMessageId } : {}),
    });
  });

  registerSessionForkSummaryRoutes({
    routes,
    deps,
    isRoutedSession,
    getGlobalInstructions,
    persistLaunchMetadata,
    loadRestartSourceSession,
  });

  registerSessionRuntimeRoutes({
    routes,
    deps,
    getGlobalInstructions,
    persistLaunchMetadata,
  });

  // POST /api/projects/:projectId/sessions/:sessionId/clone - Clone a session
  routes.post("/projects/:projectId/sessions/:sessionId/clone", async (c) => {
    const projectId = c.req.param("projectId");
    const sessionId = c.req.param("sessionId");

    // Validate projectId format at API boundary
    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }

    const project = await deps.scanner.getOrCreateProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Check provider supports cloning
    const supportedProviders = ["claude", "codex", "codex-oss"];
    if (!supportedProviders.includes(project.provider)) {
      return c.json(
        { error: `Clone is not supported for ${project.provider} sessions` },
        400,
      );
    }

    let body: {
      title?: string;
      provider?: ProviderName;
      parentSessionId?: string | null;
    } = {};
    try {
      body = await c.req.json();
    } catch {
      // Body is optional
    }

    if (
      body.parentSessionId !== undefined &&
      body.parentSessionId !== null &&
      typeof body.parentSessionId !== "string"
    ) {
      return c.json({ error: "parentSessionId must be a string or null" }, 400);
    }
    const parentSessionId =
      typeof body.parentSessionId === "string"
        ? body.parentSessionId.trim() || undefined
        : undefined;

    try {
      // A copy of a router-pinned session must be able to keep its account.
      deps.supervisor.assertRouterBindingInheritable(sessionId);
      // Get session directory from project
      const sessionDir = project.sessionDir;
      if (!sessionDir) {
        return c.json({ error: "Session directory not found" }, 500);
      }

      // Resolve bounded source/title metadata without treating it as a
      // complete transcript summary.
      const originalResolution = await findSessionListSummaryAcrossProviders(
        project,
        sessionId,
        projectId,
        providerResolutionDeps(deps),
        body.provider,
      );
      const originalSession = originalResolution?.summary ?? null;
      let cloneProvider: ProviderName =
        originalResolution?.source.provider ?? project.provider;

      const originalMetadata =
        deps.sessionMetadataService?.getMetadata?.(sessionId);
      const originalTitle =
        originalMetadata?.customTitle ?? originalSession?.title;
      const cloneTitle =
        body.title ?? (originalTitle ? `${originalTitle} [cloned]` : undefined);

      let result: { newSessionId: string; entries: number };

      const shouldCloneFromCodex =
        isCodexProviderName(body.provider) ||
        isCodexProviderName(originalResolution?.source.provider) ||
        isCodexProviderName(project.provider) ||
        (!originalSession && project.provider === "claude");

      const cloneSettings = !shouldCloneFromCodex
        ? await deps.supervisor.resolveForkLaunchSettings(
            sessionId,
            project.path,
            cloneProvider,
          )
        : undefined;

      if (shouldCloneFromCodex) {
        const codexReader = getCodexReader(project.path);
        if (!codexReader) {
          return c.json({ error: "Codex session reader not available" }, 500);
        }
        cloneProvider =
          originalResolution?.source.provider ??
          body.provider ??
          (isCodexProviderName(project.provider) ? project.provider : "codex");
        const forkProjectPath =
          originalMetadata?.sandboxLevel === "project-write"
            ? (originalMetadata.sandboxProjectPath ?? project.path)
            : project.path;
        const fork = await deps.supervisor.forkSession({
          sessionId,
          projectPath: forkProjectPath,
          providerName: cloneProvider,
          title: cloneTitle,
          ...inheritedSandboxSettings(originalMetadata),
        });
        if (originalMetadata?.sandboxLevel === "project-write") {
          await deps.sessionMetadataService?.setSessionSandbox(fork.sessionId, {
            level: originalMetadata.sandboxLevel,
            networkFirewall: persistedSandboxNetworkFirewall(originalMetadata),
            stateKey: fork.sandboxStateKey ?? originalMetadata.sandboxStateKey,
            projectPath: forkProjectPath,
            projectId:
              originalMetadata.workingProjectId ?? (projectId as UrlProjectId),
          });
        }
        result = {
          newSessionId: fork.sessionId,
          // Older /btw clients use this offset only until their prompt marker
          // arrives. A conservative bound hides inherited text without a scan.
          entries: Number.MAX_SAFE_INTEGER,
        };
      } else if (originalMetadata?.sandboxLevel === "project-write") {
        // A sandboxed source's transcript lives in its project's private
        // provider root, and a clone for the same canonical project shares
        // that root and its settled sandbox (topics/session-sandboxing.md
        // § Session Lifetime), so the copy is read from and written there.
        const stateKey = originalMetadata.sandboxStateKey;
        if (!stateKey) {
          return c.json(
            {
              error:
                "This sandboxed session records no private state, so its transcript cannot be cloned",
            },
            409,
          );
        }
        const sandboxProjectPath =
          originalMetadata.sandboxProjectPath ?? project.path;
        const transcriptDirectory =
          await deps.supervisor.openClaudeSandboxTranscriptDirectory({
            stateKey,
            projectPath: sandboxProjectPath,
          });
        try {
          result = await cloneClaudeSession(
            `/proc/self/fd/${transcriptDirectory.fd}`,
            sessionId,
          );
        } finally {
          await transcriptDirectory.close();
        }
        await deps.sessionMetadataService?.setSessionSandbox(
          result.newSessionId,
          {
            level: "project-write",
            networkFirewall: persistedSandboxNetworkFirewall(originalMetadata),
            stateKey,
            projectPath: sandboxProjectPath,
            projectId:
              originalMetadata.workingProjectId ?? (projectId as UrlProjectId),
            // The sandbox transcript readers find a session by its provider.
            provider: cloneProvider,
          },
        );
      } else {
        result = await cloneClaudeSession(sessionDir, sessionId);
      }
      // The Codex path forks through the Supervisor, which already did this.
      if (!shouldCloneFromCodex) {
        const copyId = result.newSessionId;
        await deps.supervisor.inheritRouterBinding(sessionId, copyId, () =>
          rm(join(sessionDir, `${copyId}.jsonl`), { force: true }),
        );
      }
      if (cloneSettings) {
        await deps.supervisor.recordForkLaunchSettings(
          result.newSessionId,
          cloneSettings,
        );
      }
      if (!shouldCloneFromCodex) {
        // The verbatim copy keeps every uuid, so the source's rewound groups
        // and any still-pending rewind mean the same rows in the clone
        // (topics/session-rewind.md).
        await deps.sessionMetadataService?.copyRewindState?.(
          sessionId,
          result.newSessionId,
        );
      }

      const cloneCreator = actingUsername(c);
      if (cloneCreator) {
        // A limited user's clone is theirs, like a session they start
        // (topics/limited-users.md § Delivery v1).
        await deps.sessionMetadataService?.recordSessionCreator(
          result.newSessionId,
          cloneCreator,
        );
      }
      void deps.userUsageService?.recordSession(cloneCreator);
      // Set clone metadata. /btw asides pass parentSessionId so the child
      // can jump back into the parent viewport.
      if (deps.sessionMetadataService) {
        await deps.sessionMetadataService.updateMetadata(result.newSessionId, {
          title: cloneTitle,
          parentSessionId,
          parentSessionKind: parentSessionId ? "btw-aside" : undefined,
          forkedFromSessionId: sessionId,
        });
      }

      return c.json({
        sessionId: result.newSessionId,
        messageCount: result.entries,
        clonedFrom: sessionId,
        provider: cloneProvider,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to clone session";
      return c.json(
        { error: message },
        error instanceof RouterUnavailable ? 409 : 500,
      );
    }
  });

  return routes;
}
