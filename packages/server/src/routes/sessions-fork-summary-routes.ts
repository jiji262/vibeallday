import {
  ALL_PERMISSION_MODES,
  type ProviderName,
  type TranscriptDisplayObject,
  type UrlProjectId,
  isUrlProjectId,
  truncateSessionTitle,
} from "@vibeallday/shared";
import { randomUUID } from "node:crypto";
import type { Hono } from "hono";
import { getLogger } from "../logging/logger.js";
import type { ForkOrdinalClaim } from "../metadata/SessionMetadataService.js";
import type { PermissionMode } from "../sdk/types.js";
import {
  findSessionListSummaryAcrossProviders,
  findSessionSummaryAcrossProviders,
} from "../sessions/provider-resolution.js";
import { resolveInheritedForkModel } from "../sdk/providers/types.js";
import {
  ForkSettingsPersistenceError,
  routedSessionUnsupportedMessage,
} from "../supervisor/Supervisor.js";
import { parseOptionalExecutor } from "./session-request-helpers.js";
import { providerResolutionDeps } from "./session-provider-resolution.js";
import { actingUsername } from "../auth/limitedLaunchPolicy.js";
import {
  type LoadRestartSourceSessionFn,
  type PersistLaunchMetadataFn,
  type SessionsDeps,
  forkSummaryTitleCandidate,
  forkTitleWithOrdinal,
  generatedRetitleCandidate,
  inheritedSandboxSettings,
  isQueueFullResponse,
  isQueuedResponse,
  normalizeRestartTitleCandidate,
  persistedSandboxNetworkFirewall,
  resolveCompactModelSettings,
  resolveForkAfterBoundary,
} from "./sessions-restart-fork-helpers.js";

export function registerSessionForkSummaryRoutes(context: {
  routes: Hono;
  deps: SessionsDeps;
  isRoutedSession: (sessionId: string) => boolean;
  getGlobalInstructions: () => string | undefined;
  persistLaunchMetadata: PersistLaunchMetadataFn;
  loadRestartSourceSession: LoadRestartSourceSessionFn;
}): void {
  const {
    routes,
    deps,
    isRoutedSession,
    getGlobalInstructions,
    persistLaunchMetadata,
    loadRestartSourceSession,
  } = context;
  const activeForkSummaryJobs = new Map<
    string,
    { objectId: string; abortController: AbortController }
  >();
  const emitTranscriptDisplayObjects = (sessionId: string): void => {
    deps.eventBus?.emit({
      type: "session-metadata-changed",
      sessionId,
      transcriptDisplayObjects:
        deps.sessionMetadataService?.getTranscriptDisplayObjects(sessionId) ??
        [],
      timestamp: new Date().toISOString(),
    });
  };
  const updateForkSummaryChildMetadata = async (
    childSessionId: string,
    sourceSessionId: string,
    title: string,
    archived: boolean,
    forkLineageRootId?: string,
  ): Promise<void> => {
    await deps.sessionMetadataService?.updateMetadata(childSessionId, {
      title,
      archived,
      forkedFromSessionId: sourceSessionId,
      ...(forkLineageRootId ? { forkLineageRootId } : {}),
    });
    deps.eventBus?.emit({
      type: "session-metadata-changed",
      sessionId: childSessionId,
      title,
      archived,
      forkedFromSessionId: sourceSessionId,
      timestamp: new Date().toISOString(),
    });
  };
  // POST /api/projects/:projectId/sessions/:sessionId/retitle
  // Generate a proposed session title through an archived helper fork. This
  // never updates the source session title; the client must explicitly accept
  // the returned proposal through the ordinary metadata update route.
  routes.post("/projects/:projectId/sessions/:sessionId/retitle", async (c) => {
    const projectId = c.req.param("projectId");
    const sessionId = c.req.param("sessionId");
    if (isRoutedSession(sessionId)) {
      return c.json(
        { error: routedSessionUnsupportedMessage("Title generation") },
        409,
      );
    }

    if (!isUrlProjectId(projectId)) {
      return c.json({ error: "Invalid project ID format" }, 400);
    }
    const project = await deps.scanner.getOrCreateProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found or path does not exist" }, 404);
    }
    if (!deps.sessionMetadataService) {
      return c.json({ error: "Session metadata service not available" }, 503);
    }

    let body: { currentTitle?: unknown; lengthTarget?: unknown } = {};
    try {
      body = await c.req.json();
    } catch {
      // Body is optional.
    }

    const currentTitle =
      typeof body.currentTitle === "string"
        ? body.currentTitle.trim().slice(0, 200)
        : undefined;
    let lengthTarget: number | undefined;
    if (body.lengthTarget !== undefined) {
      if (
        typeof body.lengthTarget !== "number" ||
        !Number.isInteger(body.lengthTarget) ||
        body.lengthTarget < 20 ||
        body.lengthTarget > 132
      ) {
        return c.json(
          { error: "lengthTarget must be an integer between 20 and 132" },
          400,
        );
      }
      lengthTarget = body.lengthTarget;
    }

    const metadataProvider = deps.sessionMetadataService.getProvider(
      sessionId,
    ) as ProviderName | undefined;
    let sourceProcess = deps.supervisor.getProcessForSession(sessionId);
    const liveSourceProcess =
      sourceProcess && !sourceProcess.isTerminated ? sourceProcess : undefined;
    const sessionSummaryResult = await findSessionListSummaryAcrossProviders(
      project,
      sessionId,
      projectId,
      providerResolutionDeps(deps),
      liveSourceProcess?.provider ?? metadataProvider,
    );
    const providerName =
      liveSourceProcess?.provider ??
      metadataProvider ??
      sessionSummaryResult?.source.provider ??
      sourceProcess?.provider ??
      project.provider;
    if (!deps.supervisor.supportsForkSession(providerName)) {
      return c.json(
        { error: `${providerName} does not support transcript fork` },
        400,
      );
    }

    const savedExecutor = parseOptionalExecutor(
      deps.sessionMetadataService.getExecutor(sessionId),
    ).executor;
    let requestedModel = resolveInheritedForkModel(
      deps.sessionMetadataService.getRequestedModel(sessionId),
      liveSourceProcess?.resolvedModel,
      liveSourceProcess?.model,
    );
    if (!requestedModel) {
      const fullSummary = await findSessionSummaryAcrossProviders(
        project,
        sessionId,
        projectId,
        providerResolutionDeps(deps),
        providerName,
      );
      requestedModel = resolveInheritedForkModel(
        deps.sessionMetadataService.getRequestedModel(sessionId),
        fullSummary?.summary.model,
      );
    }
    const sourceMetadata = deps.sessionMetadataService.getMetadata?.(sessionId);
    const sourceProjectPath =
      sourceMetadata?.sandboxLevel === "project-write"
        ? (sourceMetadata.sandboxProjectPath ?? project.path)
        : project.path;
    const promptSuggestionMode = sourceMetadata?.promptSuggestionMode;
    const recapAfterSeconds = sourceMetadata?.recapAfterSeconds;
    const abortController = new AbortController();
    const abortFromRequest = () => abortController.abort();
    if (c.req.raw.signal.aborted) {
      abortController.abort();
    } else {
      c.req.raw.signal.addEventListener("abort", abortFromRequest, {
        once: true,
      });
    }

    let generatorSessionId: string | undefined;
    try {
      if (!liveSourceProcess) {
        sourceProcess = await deps.supervisor.reactivateSession(
          sourceProjectPath,
          sessionId,
          undefined,
          {
            model:
              requestedModel && requestedModel !== "default"
                ? requestedModel
                : undefined,
            providerName,
            executor: savedExecutor,
            ...inheritedSandboxSettings(sourceMetadata),
            globalInstructions: getGlobalInstructions(),
            promptSuggestionMode,
            recapAfterSeconds,
          },
          { requestedOverrides: {} },
        );
        requestedModel = resolveInheritedForkModel(
          requestedModel,
          sourceProcess.resolvedModel,
          sourceProcess.model,
        );
      }

      const generator = await deps.supervisor.forkSession({
        sessionId,
        projectPath: sourceProjectPath,
        providerName,
        title: "Retitle generator",
        ...inheritedSandboxSettings(sourceMetadata),
      });
      generatorSessionId = generator.sessionId;
      requestedModel =
        generator.launchSettings?.requestedModel ?? requestedModel;
      await updateForkSummaryChildMetadata(
        generator.sessionId,
        sessionId,
        "Retitle generator",
        true,
      );
      await persistLaunchMetadata(
        generator.sessionId,
        providerName,
        savedExecutor,
        undefined,
        requestedModel,
        promptSuggestionMode,
        recapAfterSeconds,
        sourceMetadata?.workstreamId,
        {
          level: sourceMetadata?.sandboxLevel ?? "none",
          networkFirewall: persistedSandboxNetworkFirewall(sourceMetadata),
          stateKey:
            generator.sandboxStateKey ?? sourceMetadata?.sandboxStateKey,
          projectPath: sourceProjectPath,
          projectId:
            sourceMetadata?.workingProjectId ?? (projectId as UrlProjectId),
        },
      );
      if (abortController.signal.aborted) {
        throw new DOMException("Retitle cancelled", "AbortError");
      }

      const generated = await deps.supervisor.generateSummary(providerName, {
        purpose: "session-retitle",
        strategy: "fork",
        generatorSessionId: generator.sessionId,
        cwd: sourceProjectPath,
        model: requestedModel,
        currentTitle,
        lengthTarget,
        signal: abortController.signal,
        sessionSandbox: generator.sessionSandbox,
      });
      const title = generatedRetitleCandidate(generated.text);
      if (!title) {
        throw new Error("Retitle generation returned empty title");
      }
      return c.json({ title, generatorSessionId: generator.sessionId });
    } catch (error) {
      const cancelled =
        abortController.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError");
      const message =
        error instanceof Error ? error.message : "Retitle generation failed";
      getLogger().warn(
        {
          event: cancelled
            ? "session_retitle_cancelled"
            : "session_retitle_failed",
          sessionId,
          projectId,
          providerName,
          generatorSessionId,
          error: message,
        },
        cancelled ? "Session retitle cancelled" : "Session retitle failed",
      );
      return c.json({ error: message }, cancelled ? 400 : 500);
    } finally {
      c.req.raw.signal.removeEventListener("abort", abortFromRequest);
      abortController.abort();
    }
  });

  // POST /api/projects/:projectId/sessions/:sessionId/fork-summary
  // Start a server-owned whole-context fork-after-summary job. The response
  // returns after durable job creation; generation continues independently of
  // the requesting client connection.
  routes.post(
    "/projects/:projectId/sessions/:sessionId/fork-summary",
    async (c) => {
      const projectId = c.req.param("projectId");
      const sessionId = c.req.param("sessionId");
      // Its summary step calls the provider directly, without the pin.
      if (isRoutedSession(sessionId)) {
        return c.json(
          { error: routedSessionUnsupportedMessage("Fork with summary") },
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

      let body: {
        sourceMessageId?: unknown;
        instructions?: unknown;
        mode?: unknown;
        autoOpenWhenReady?: unknown;
      };
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      const sourceMessageId =
        typeof body.sourceMessageId === "string" && body.sourceMessageId.trim()
          ? body.sourceMessageId.trim()
          : undefined;
      if (!sourceMessageId) {
        return c.json({ error: "sourceMessageId is required" }, 400);
      }
      if (
        body.mode !== undefined &&
        (typeof body.mode !== "string" ||
          !ALL_PERMISSION_MODES.includes(body.mode as PermissionMode))
      ) {
        return c.json({ error: "Invalid permission mode" }, 400);
      }
      if (
        body.autoOpenWhenReady !== undefined &&
        typeof body.autoOpenWhenReady !== "boolean"
      ) {
        return c.json({ error: "autoOpenWhenReady must be a boolean" }, 400);
      }
      const mode = body.mode as PermissionMode | undefined;
      const instructions =
        typeof body.instructions === "string" ? body.instructions : undefined;
      const autoOpenWhenReady = body.autoOpenWhenReady === true;

      const metadataProvider = deps.sessionMetadataService?.getProvider(
        sessionId,
      ) as ProviderName | undefined;
      const sourceProcess = deps.supervisor.getProcessForSession(sessionId);
      const providerName =
        metadataProvider ?? sourceProcess?.provider ?? project.provider;
      if (!deps.supervisor.supportsForkSession(providerName)) {
        return c.json(
          { error: `${providerName} does not support transcript fork` },
          400,
        );
      }
      if (!deps.sessionMetadataService) {
        return c.json({ error: "Session metadata service not available" }, 503);
      }
      const originalMetadata =
        deps.sessionMetadataService.getMetadata?.(sessionId);
      const sourceProjectPath =
        originalMetadata?.sandboxLevel === "project-write"
          ? (originalMetadata.sandboxProjectPath ?? project.path)
          : project.path;
      if (activeForkSummaryJobs.has(sessionId)) {
        return c.json(
          { error: "A fork summary is already generating for this session" },
          409,
        );
      }

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
      const boundary = resolveForkAfterBoundary(
        sourceSession.messages,
        sourceMessageId,
        sourceProcess?.state.type === "in-turn" ||
          sourceProcess?.state.type === "waiting-input",
        providerName,
      );
      if ("error" in boundary) {
        return c.json({ error: boundary.error }, boundary.status);
      }

      const displayObject: TranscriptDisplayObject = {
        id: randomUUID(),
        kind: "fork-summary",
        createdAt: new Date().toISOString(),
        placementAfterMessageId: boundary.placementAfterMessageId,
        sourceMessageId,
        retainedThroughMessageId: boundary.retainedThroughMessageId,
        status: "generating",
        autoOpenWhenReady: autoOpenWhenReady || undefined,
      };
      const abortController = new AbortController();
      activeForkSummaryJobs.set(sessionId, {
        objectId: displayObject.id,
        abortController,
      });
      try {
        await deps.sessionMetadataService.addTranscriptDisplayObject(
          sessionId,
          displayObject,
        );
      } catch (error) {
        activeForkSummaryJobs.delete(sessionId);
        throw error;
      }
      emitTranscriptDisplayObjects(sessionId);

      const baseTitle = normalizeRestartTitleCandidate(
        originalMetadata?.customTitle ?? sourceSession.title,
      );
      // Claim a fork ordinal only when the generated summary yields no title,
      // so an unused number is not burned on every fork-after-summary. The
      // lineage the target belongs to is recorded either way.
      const forkLineageRootId =
        deps.sessionMetadataService.forkLineageRoot(sessionId);
      let fallbackClaim: ForkOrdinalClaim | undefined;
      const fallbackTitle = async (): Promise<string | undefined> => {
        if (!baseTitle) return undefined;
        fallbackClaim =
          await deps.sessionMetadataService?.nextForkOrdinal(sessionId);
        return forkTitleWithOrdinal(baseTitle, fallbackClaim?.ordinal ?? 1);
      };
      const savedExecutor = parseOptionalExecutor(
        deps.sessionMetadataService.getExecutor(sessionId),
      ).executor;
      let requestedModel = resolveInheritedForkModel(
        deps.sessionMetadataService.getRequestedModel(sessionId),
        sourceProcess?.resolvedModel,
        sourceSession.model,
        sourceProcess?.model,
      );
      const forkSummaryActor = actingUsername(c);

      void (async () => {
        let generatorSessionId: string | undefined;
        let targetSessionId: string | undefined;
        let targetTitle: string | undefined;
        let targetProcessId: string | undefined;
        let completed = false;
        try {
          const generator = await deps.supervisor.forkSession({
            sessionId,
            projectPath: sourceProjectPath,
            providerName,
            title: "Fork summary generator",
            ...inheritedSandboxSettings(originalMetadata),
          });
          generatorSessionId = generator.sessionId;
          requestedModel =
            generator.launchSettings?.requestedModel ?? requestedModel;
          await updateForkSummaryChildMetadata(
            generator.sessionId,
            sessionId,
            "Fork summary generator",
            true,
          );
          await persistLaunchMetadata(
            generator.sessionId,
            providerName,
            savedExecutor,
            undefined,
            requestedModel,
            originalMetadata?.promptSuggestionMode,
            originalMetadata?.recapAfterSeconds,
            originalMetadata?.workstreamId,
            {
              level: originalMetadata?.sandboxLevel ?? "none",
              networkFirewall:
                persistedSandboxNetworkFirewall(originalMetadata),
              stateKey:
                generator.sandboxStateKey ?? originalMetadata?.sandboxStateKey,
              projectPath: sourceProjectPath,
              projectId:
                originalMetadata?.workingProjectId ??
                (projectId as UrlProjectId),
            },
          );
          if (abortController.signal.aborted) {
            throw new DOMException("Fork summary cancelled", "AbortError");
          }

          const generated = await deps.supervisor.generateSummary(
            providerName,
            {
              purpose: "fork-after-summary",
              strategy: "fork",
              generatorSessionId: generator.sessionId,
              cwd: sourceProjectPath,
              model: requestedModel,
              afterTurnMessageId: boundary.retainedThroughMessageId,
              afterTurnContext: boundary.retainedThroughContext,
              instructions,
              signal: abortController.signal,
              sessionSandbox: generator.sessionSandbox,
            },
          );
          if (abortController.signal.aborted) {
            throw new DOMException("Fork summary cancelled", "AbortError");
          }

          const summaryTitle = forkSummaryTitleCandidate(generated.text);
          const title = summaryTitle
            ? truncateSessionTitle(summaryTitle)
            : ((await fallbackTitle()) ?? "Forked session");
          targetTitle = title;
          const target = await deps.supervisor.forkSession({
            sessionId,
            launchSettings: generator.launchSettings,
            launchOverrides:
              mode !== undefined ? { permissionMode: mode } : undefined,
            projectPath: sourceProjectPath,
            providerName,
            ...(boundary.providerBoundary
              ? { boundary: boundary.providerBoundary }
              : { upToMessageId: boundary.retainedThroughMessageId }),
            title,
            ...inheritedSandboxSettings(originalMetadata),
          });
          targetSessionId = target.sessionId;
          void deps.userUsageService?.recordSession(forkSummaryActor);
          await updateForkSummaryChildMetadata(
            target.sessionId,
            sessionId,
            title,
            true,
            forkLineageRootId,
          );
          await persistLaunchMetadata(
            target.sessionId,
            providerName,
            savedExecutor,
            undefined,
            requestedModel,
            originalMetadata?.promptSuggestionMode,
            originalMetadata?.recapAfterSeconds,
            originalMetadata?.workstreamId,
            {
              level: originalMetadata?.sandboxLevel ?? "none",
              networkFirewall:
                persistedSandboxNetworkFirewall(originalMetadata),
              stateKey:
                target.sandboxStateKey ?? originalMetadata?.sandboxStateKey,
              projectPath: sourceProjectPath,
              projectId:
                originalMetadata?.workingProjectId ??
                (projectId as UrlProjectId),
            },
          );
          if (abortController.signal.aborted) {
            throw new DOMException("Fork summary cancelled", "AbortError");
          }

          const result = await deps.supervisor.resumeSession(
            target.sessionId,
            sourceProjectPath,
            { text: generated.text, mode },
            mode,
            {
              providerName,
              executor: savedExecutor,
              ...inheritedSandboxSettings({
                ...originalMetadata,
                sandboxStateKey:
                  target.sandboxStateKey ?? originalMetadata?.sandboxStateKey,
              }),
              globalInstructions: getGlobalInstructions(),
              model: requestedModel,
              promptSuggestionMode: originalMetadata?.promptSuggestionMode,
              recapAfterSeconds: originalMetadata?.recapAfterSeconds,
              ...resolveCompactModelSettings(deps, {
                provider: providerName,
                vibeAllDayModelId: requestedModel,
                modelCandidates: [requestedModel],
              }),
            },
          );
          if (isQueueFullResponse(result)) {
            throw new Error("Queue is full");
          }
          if (isQueuedResponse(result)) {
            deps.supervisor.cancelQueuedRequest(result.queueId);
            throw new Error("Fork summary could not start immediately");
          }
          targetProcessId = result.id;
          if (abortController.signal.aborted) {
            await deps.supervisor.abortProcess(result.id);
            targetProcessId = undefined;
            throw new DOMException("Fork summary cancelled", "AbortError");
          }

          await persistLaunchMetadata(
            result.sessionId,
            providerName,
            savedExecutor,
            undefined,
            requestedModel,
            result.promptSuggestionMode,
            result.recapAfterSeconds,
            originalMetadata?.workstreamId,
            {
              level: originalMetadata?.sandboxLevel ?? "none",
              networkFirewall:
                persistedSandboxNetworkFirewall(originalMetadata),
              stateKey:
                result.sandboxStateKey ??
                target.sandboxStateKey ??
                originalMetadata?.sandboxStateKey,
              projectPath: result.sandboxProjectPath ?? result.projectPath,
              projectId: result.projectId,
            },
          );
          await updateForkSummaryChildMetadata(
            result.sessionId,
            sessionId,
            title,
            false,
            forkLineageRootId,
          );
          await deps.sessionMetadataService?.updateTranscriptDisplayObject(
            sessionId,
            displayObject.id,
            (object) =>
              object.kind !== "fork-summary"
                ? object
                : {
                    ...object,
                    status: "ready",
                    targetSessionId: result.sessionId,
                    title,
                    error: undefined,
                  },
          );
          emitTranscriptDisplayObjects(sessionId);
          completed = true;
        } catch (error) {
          const cancelled =
            abortController.signal.aborted ||
            (error instanceof DOMException && error.name === "AbortError");
          const logCleanupFailure = (
            stage: string,
            cleanupError: unknown,
          ): void => {
            getLogger().warn(
              {
                event: "fork_after_summary_cleanup_failed",
                sessionId,
                projectId,
                providerName,
                stage,
                error:
                  cleanupError instanceof Error
                    ? cleanupError.message
                    : String(cleanupError),
              },
              "Fork-after-summary cleanup failed",
            );
          };
          if (generatorSessionId) {
            try {
              await updateForkSummaryChildMetadata(
                generatorSessionId,
                sessionId,
                "Fork summary generator",
                true,
              );
            } catch (cleanupError) {
              logCleanupFailure("archive-generator", cleanupError);
            }
          }
          if (targetSessionId && targetTitle) {
            try {
              await updateForkSummaryChildMetadata(
                targetSessionId,
                sessionId,
                targetTitle,
                true,
              );
            } catch (cleanupError) {
              logCleanupFailure("archive-target", cleanupError);
            }
          } else if (
            fallbackClaim &&
            !(error instanceof ForkSettingsPersistenceError)
          ) {
            try {
              await deps.sessionMetadataService?.releaseForkOrdinal(
                fallbackClaim,
              );
            } catch (cleanupError) {
              logCleanupFailure("release-fork-ordinal", cleanupError);
            }
          }
          if (!completed && targetProcessId) {
            try {
              await deps.supervisor.abortProcess(targetProcessId);
            } catch (cleanupError) {
              logCleanupFailure("abort-target-process", cleanupError);
            }
          }
          if (!cancelled) {
            const message =
              error instanceof Error
                ? error.message
                : "Summary generation failed";
            getLogger().warn(
              {
                event: "fork_after_summary_failed",
                sessionId,
                projectId,
                providerName,
                sourceMessageId,
                error: message,
              },
              "Fork-after-summary job failed",
            );
            try {
              await deps.sessionMetadataService?.updateTranscriptDisplayObject(
                sessionId,
                displayObject.id,
                (object) =>
                  object.kind !== "fork-summary"
                    ? object
                    : {
                        ...object,
                        status: "error",
                        error: message,
                      },
              );
              emitTranscriptDisplayObjects(sessionId);
            } catch (cleanupError) {
              logCleanupFailure("persist-error-state", cleanupError);
            }
          }
        } finally {
          const active = activeForkSummaryJobs.get(sessionId);
          if (active?.objectId === displayObject.id) {
            activeForkSummaryJobs.delete(sessionId);
          }
        }
      })().catch((error) => {
        getLogger().error(
          {
            event: "fork_after_summary_unhandled_failure",
            sessionId,
            projectId,
            providerName,
            sourceMessageId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Fork-after-summary job escaped its guarded workflow",
        );
      });

      return c.json({ displayObject }, 202);
    },
  );

  routes.post(
    "/projects/:projectId/sessions/:sessionId/fork-summary/:objectId/cancel",
    async (c) => {
      const projectId = c.req.param("projectId");
      const sessionId = c.req.param("sessionId");
      const objectId = c.req.param("objectId");
      if (!isUrlProjectId(projectId)) {
        return c.json({ error: "Invalid project ID format" }, 400);
      }
      const active = activeForkSummaryJobs.get(sessionId);
      const object = deps.sessionMetadataService
        ?.getTranscriptDisplayObjects(sessionId)
        .find((candidate) => candidate.id === objectId);
      if (!object) {
        return c.json({ error: "Transcript display object not found" }, 404);
      }
      if (active?.objectId === objectId && object.status === "generating") {
        active.abortController.abort();
      } else if (object.status !== "error") {
        return c.json({ error: "Fork summary job is not active" }, 409);
      }
      await deps.sessionMetadataService?.removeTranscriptDisplayObject(
        sessionId,
        objectId,
      );
      emitTranscriptDisplayObjects(sessionId);
      return c.json({
        transcriptDisplayObjects:
          deps.sessionMetadataService?.getTranscriptDisplayObjects(sessionId) ??
          [],
      });
    },
  );

  routes.patch(
    "/projects/:projectId/sessions/:sessionId/fork-summary/:objectId",
    async (c) => {
      const projectId = c.req.param("projectId");
      const sessionId = c.req.param("sessionId");
      const objectId = c.req.param("objectId");
      if (!isUrlProjectId(projectId)) {
        return c.json({ error: "Invalid project ID format" }, 400);
      }
      if (!deps.sessionMetadataService) {
        return c.json({ error: "Session metadata service not available" }, 503);
      }
      let body: { autoOpenWhenReady?: unknown; action?: unknown };
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
      }
      const action =
        body.action === "opened" || body.action === "clicked"
          ? body.action
          : undefined;
      if (
        body.autoOpenWhenReady !== undefined &&
        typeof body.autoOpenWhenReady !== "boolean"
      ) {
        return c.json({ error: "autoOpenWhenReady must be a boolean" }, 400);
      }
      if (body.action !== undefined && !action) {
        return c.json({ error: "action must be opened or clicked" }, 400);
      }
      const now = new Date().toISOString();
      const updated =
        await deps.sessionMetadataService.updateTranscriptDisplayObject(
          sessionId,
          objectId,
          (object) =>
            object.kind !== "fork-summary"
              ? object
              : {
                  ...object,
                  ...(typeof body.autoOpenWhenReady === "boolean"
                    ? { autoOpenWhenReady: body.autoOpenWhenReady || undefined }
                    : {}),
                  ...(action === "opened" ? { openedAt: now } : {}),
                  ...(action === "clicked" ? { clickedAt: now } : {}),
                },
        );
      if (!updated) {
        return c.json({ error: "Transcript display object not found" }, 404);
      }
      emitTranscriptDisplayObjects(sessionId);
      return c.json({
        displayObject: updated,
        transcriptDisplayObjects:
          deps.sessionMetadataService.getTranscriptDisplayObjects(sessionId),
      });
    },
  );
}
