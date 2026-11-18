import {
  type ProviderName,
  SESSION_UNREAD_TIMESTAMP,
} from "@vibeallday/shared";
import type { Hono } from "hono";
import { nonHumanUserTurnField } from "../metadata/SessionMetadataService.js";
import { parseSlashCommandSubmission } from "../sdk/slashCommandEmulation.js";
import { dispatchProviderCommand } from "../supervisor/provider-command.js";
import type { PermissionMode, UserMessage } from "../sdk/types.js";
import { appendApprovalAuditLog } from "../security/approvalAuditLog.js";
import { getProvider } from "../sdk/providers/index.js";
import {
  buildUserMessageMetadata,
  normalizeOptionalServiceTier,
  parseOptionalExecutor,
} from "./session-request-helpers.js";
import { isClaudeSdkProviderName } from "./session-provider-resolution.js";
import { parseSessionMetadataPatch } from "./session-metadata-patch.js";
import { sessionQueueSummaries } from "./session-queue-summaries.js";
import {
  reportableProcessState,
  resolveRecoveredGroupForDelivery,
  resumeRecoveredGroup,
} from "./session-recovered-queue.js";
import { buildThinkingOptions } from "./session-thinking-options.js";
import { actingUsername } from "../auth/limitedLaunchPolicy.js";
import {
  type InputResponseBody,
  type PersistLaunchMetadataFn,
  type SessionsDeps,
  type StartSessionBody,
  hasSessionMessageContent,
  isApprovalAuditLogEnabled,
  permissionModeError,
  resolveCompactModelSettings,
} from "./sessions-restart-fork-helpers.js";

export function registerSessionRuntimeRoutes(context: {
  routes: Hono;
  deps: SessionsDeps;
  getGlobalInstructions: () => string | undefined;
  persistLaunchMetadata: PersistLaunchMetadataFn;
}): void {
  const { routes, deps, getGlobalInstructions, persistLaunchMetadata } =
    context;
  // POST /api/sessions/:sessionId/messages - Queue message
  routes.post("/sessions/:sessionId/messages", async (c) => {
    const sessionId = c.req.param("sessionId");

    const process = deps.supervisor.getProcessForSession(sessionId);
    if (!process) {
      return c.json({ error: "No active process for session" }, 404);
    }

    let body: StartSessionBody & { deferred?: boolean };
    try {
      body = await c.req.json<StartSessionBody & { deferred?: boolean }>();
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
        body.deferred ? "deferred" : "direct",
        actingUsername(c),
      ),
    };

    if (
      userMessage.metadata?.turnEffort &&
      process.provider !== "codex" &&
      !isClaudeSdkProviderName(process.provider)
    ) {
      return c.json(
        { error: "This provider does not support one-turn effort modifiers" },
        400,
      );
    }

    // Check if process is terminated
    if (process.isTerminated) {
      return c.json(
        {
          error: "Process terminated",
          reason: process.terminationReason,
        },
        410,
      ); // 410 Gone
    }

    // Invalidate speculative idle work before any provider-native command or
    // delivery preparation can await.
    process.noteInputIntent();

    // Past the request-shape guards this turn is delivered or queued, so it
    // counts here rather than at each of the branches below.
    void deps.userUsageService?.recordTurn(actingUsername(c), userMessage.text);

    // Provider-native slash commands (e.g. Codex `/compact`) are dispatched
    // through the provider's own protocol rather than delivered as turn text the
    // model would never interpret. Claude's `/compact` reports handled:false and
    // falls through to normal delivery so the SDK handles it as a regular turn
    // (and any trailing focus instructions reach the SDK verbatim). Native
    // controls are out-of-band even when the composer requests deferred send.
    const parsed = parseSlashCommandSubmission(body.message);
    if (parsed) {
      const providerResult = await dispatchProviderCommand(
        process,
        parsed,
        body.tempId,
        deps.sessionMetadataService,
      );
      if (providerResult.handled) {
        if (providerResult.error) {
          return c.json(
            { error: providerResult.error, reason: providerResult.error },
            409,
          );
        }
        return c.json({ queued: true, serverTimestamp });
      }
    }

    // Retained for response compatibility. VIBEALLDAY no longer chooses an implicit
    // model-specific threshold; only an explicit per-model setting can trigger
    // early compaction.
    const compactQueued = false;

    // Deferred messages stay server-side until Process reaches a safe delivery
    // boundary. If the process is already idle, Process can accept them now.
    if (
      body.deferred ||
      (userMessage.metadata?.turnEffort && process.state.type !== "idle")
    ) {
      if (body.mode) {
        process.setPermissionMode(body.mode);
      }
      await process.primeSupportedCommandsForMessage(userMessage);
      const deferredResult = process.deferMessage(userMessage, {
        promoteIfReady: true,
      });
      if (!deferredResult.success) {
        return c.json(
          {
            error: "Failed to queue message",
            reason: deferredResult.error,
          },
          410,
        );
      }
      await process.waitForPatientQueuePersistenceIdle();
      return c.json({
        queued: true,
        deferred: deferredResult.deferred,
        promoted: deferredResult.promoted,
        position: deferredResult.position,
        deferredMessages: sessionQueueSummaries(deps, sessionId, process),
        serverTimestamp,
      });
    }

    const { thinking, effort, ultracode } = buildThinkingOptions(body);

    const metadataProvider = deps.sessionMetadataService?.getProvider(
      sessionId,
    ) as ProviderName | undefined;
    const metadataExecutor = parseOptionalExecutor(
      deps.sessionMetadataService?.getExecutor(sessionId),
    );
    if (metadataExecutor.error) {
      return c.json({ error: metadataExecutor.error }, 400);
    }
    const { executor, error: executorError } = parseOptionalExecutor(
      body.executor,
    );
    if (executorError) {
      return c.json({ error: executorError }, 400);
    }

    const model =
      body.model && body.model !== "default"
        ? body.model
        : (process.resolvedModel ?? process.model);
    const serviceTier = normalizeOptionalServiceTier(body.serviceTier);
    const requestedProvider =
      metadataProvider ?? body.provider ?? process.provider;

    // Per-model preemptive-compaction threshold (task 029). The route holds the
    // settings; the Supervisor stays settings-agnostic. Key strictly by the VIBEALLDAY
    // model id: the alias the user picked this turn, else the live requested
    // alias, else the alias persisted at launch (survives restart), else the
    // provider's reported→VIBEALLDAY-id helper for sessions VIBEALLDAY didn't start. No family
    // fallback. See topics/provider-abstraction.md § Per-model settings keying.
    const vibeAllDayModelId =
      body.model ??
      process.requestedModel ??
      deps.sessionMetadataService?.getRequestedModel(sessionId) ??
      getProvider(requestedProvider)?.vibeAllDayModelIdForReported?.(
        process.resolvedModel,
      );
    const compactSettings = resolveCompactModelSettings(deps, {
      provider: requestedProvider,
      vibeAllDayModelId,
      modelCandidates: [
        vibeAllDayModelId,
        process.resolvedModel,
        process.model,
      ],
    });

    // Use queueMessageToSession which handles thinking mode changes
    // If thinking mode changed, it will restart the process automatically
    const queueGlobalInstructions = getGlobalInstructions();
    const result = await deps.supervisor.queueMessageToSession(
      sessionId,
      process.projectPath,
      userMessage,
      body.mode,
      {
        model,
        serviceTier,
        thinking,
        effort,
        ultracode,
        providerName: requestedProvider,
        executor:
          executor ??
          metadataExecutor.executor ??
          process.executor ??
          undefined,
        globalInstructions: queueGlobalInstructions,
        permissions: body.permissions,
        ...compactSettings,
      },
    );

    if (!result.success) {
      return c.json(
        {
          error: "Failed to queue message",
          reason: result.error,
        },
        410,
      ); // 410 Gone - process is no longer available
    }

    return c.json({
      queued: true,
      compactQueued,
      restarted: result.restarted,
      processId: result.process.id,
      serverTimestamp,
    });
  });

  // DELETE /api/sessions/:sessionId/recovered-queue/:queueId - Delete a
  // restart-paused patient queue entry by durable queue id.
  routes.delete("/sessions/:sessionId/recovered-queue/:queueId", async (c) => {
    const sessionId = c.req.param("sessionId");
    const queueId = c.req.param("queueId");
    const service = deps.sessionQueuePersistenceService;
    if (!service) {
      return c.json({ error: "Session queue persistence unavailable" }, 503);
    }

    const item = service
      .listSession(sessionId)
      .find((candidate) => candidate.id === queueId);
    if (item?.kind !== "patient" || item.status !== "paused-after-restart") {
      return c.json({ error: "Recovered queued message not found" }, 404);
    }

    await service.deleteItem(queueId);
    return c.json({
      deleted: true,
      deferredMessages: sessionQueueSummaries(
        deps,
        sessionId,
        deps.supervisor.getProcessForSession(sessionId),
      ),
    });
  });

  const recoveredQueueDeps = {
    sessionQueuePersistenceService: deps.sessionQueuePersistenceService,
    sessionMetadataService: deps.sessionMetadataService,
    supervisor: deps.supervisor,
    getGlobalInstructions,
    persistLaunchMetadata,
  };

  // POST /api/sessions/:sessionId/recovered-queue/:queueId/resume - Move
  // restart-paused patient queue entries back into the live patient queue,
  // through the requested entry: resuming a non-head entry also resumes every
  // recovered entry before it, so compose order is preserved.
  routes.post(
    "/sessions/:sessionId/recovered-queue/:queueId/resume",
    async (c) => {
      const sessionId = c.req.param("sessionId");
      const queueId = c.req.param("queueId");
      const resolved = await resolveRecoveredGroupForDelivery(
        recoveredQueueDeps,
        sessionId,
        queueId,
        "Drain or cancel newer queued messages before resuming recovered work.",
      );
      if (!resolved.ok) {
        return c.json(resolved.body, resolved.status);
      }
      const { process, group } = resolved;

      const { last, error } = await resumeRecoveredGroup(process, group, {
        promoteIfReady: true,
      });
      if (error || !last) {
        return c.json(
          {
            error: "Failed to resume recovered queued message",
            reason: error,
            deferredMessages: sessionQueueSummaries(deps, sessionId, process),
          },
          409,
        );
      }

      await process.waitForPatientQueuePersistenceIdle();
      return c.json({
        resumed: true,
        resumedCount: group.length,
        deferred: last.deferred,
        promoted: last.promoted,
        position: last.position,
        processId: process.id,
        processState: reportableProcessState(process),
        permissionMode: process.permissionMode,
        appliedPermissionMode: process.appliedPermissionMode,
        modeVersion: process.modeVersion,
        recapAfterSeconds: process.recapAfterSeconds,
        deferredMessages: sessionQueueSummaries(deps, sessionId, process),
        serverTimestamp: Date.now(),
      });
    },
  );

  // POST /api/sessions/:sessionId/recovered-queue/:queueId/steer - Steer a
  // restart-paused patient queue entry into the session now, without waiting
  // for verified quiet: the entry and every recovered or live patient entry
  // composed before it rejoin the live queue and steer in compose order.
  routes.post(
    "/sessions/:sessionId/recovered-queue/:queueId/steer",
    async (c) => {
      const sessionId = c.req.param("sessionId");
      const queueId = c.req.param("queueId");
      const resolved = await resolveRecoveredGroupForDelivery(
        recoveredQueueDeps,
        sessionId,
        queueId,
        "Drain or cancel newer queued messages before steering recovered work.",
      );
      if (!resolved.ok) {
        return c.json(resolved.body, resolved.status);
      }
      const { process, group } = resolved;

      const { lastMessage, error } = await resumeRecoveredGroup(
        process,
        group,
        { promoteIfReady: false },
      );
      if (error || !lastMessage?.tempId) {
        return c.json(
          {
            error: "Failed to steer recovered queued message",
            reason: error,
            deferredMessages: sessionQueueSummaries(deps, sessionId, process),
          },
          409,
        );
      }

      const steerResult = process.steerPatientDeferredMessagesThrough(
        lastMessage.tempId,
      );
      if (!steerResult.success) {
        return c.json(
          {
            error:
              steerResult.error ?? "Failed to steer recovered queued message",
            deferredMessages: sessionQueueSummaries(deps, sessionId, process),
          },
          409,
        );
      }

      await process.waitForPatientQueuePersistenceIdle();
      return c.json({
        steered: true,
        count: steerResult.steered,
        processId: process.id,
        processState: reportableProcessState(process),
        permissionMode: process.permissionMode,
        appliedPermissionMode: process.appliedPermissionMode,
        modeVersion: process.modeVersion,
        recapAfterSeconds: process.recapAfterSeconds,
        deferredMessages: sessionQueueSummaries(deps, sessionId, process),
        serverTimestamp: Date.now(),
      });
    },
  );

  // DELETE /api/sessions/:sessionId/deferred/:tempId - Cancel a deferred message
  routes.delete("/sessions/:sessionId/deferred/:tempId", async (c) => {
    const sessionId = c.req.param("sessionId");
    const tempId = c.req.param("tempId");

    const process = deps.supervisor.getProcessForSession(sessionId);
    if (!process) {
      return c.json({ error: "No active process for session" }, 404);
    }

    const cancelled = process.cancelDeferredMessage(tempId);
    if (!cancelled) {
      return c.json({ error: "Deferred message not found" }, 404);
    }

    await process.waitForPatientQueuePersistenceIdle();
    return c.json({ cancelled: true });
  });

  // DELETE /api/sessions/:sessionId/steering/:tempId - Cancel a sent steering
  // message that has not yet been consumed by the provider.
  routes.delete("/sessions/:sessionId/steering/:tempId", async (c) => {
    const sessionId = c.req.param("sessionId");
    const tempId = c.req.param("tempId");

    const process = deps.supervisor.getProcessForSession(sessionId);
    if (!process) {
      return c.json({ error: "No active process for session" }, 404);
    }

    const cancelled = process.cancelUnconfirmedSteerMessage(tempId);
    if (!cancelled) {
      return c.json(
        { error: "Steering message already acted on or not found" },
        404,
      );
    }

    return c.json({ cancelled: true });
  });

  // POST /api/sessions/:sessionId/deferred/:tempId/steer - Steer a patient
  // queued message, and every patient entry ahead of it, into the session now.
  routes.post("/sessions/:sessionId/deferred/:tempId/steer", async (c) => {
    const sessionId = c.req.param("sessionId");
    const tempId = c.req.param("tempId");

    const process = deps.supervisor.getProcessForSession(sessionId);
    if (!process) {
      return c.json({ error: "No active process for session" }, 404);
    }

    const result = process.steerPatientDeferredMessagesThrough(tempId);
    if (!result.success) {
      const status = result.error === "Deferred message not found" ? 404 : 409;
      return c.json({ error: result.error }, status);
    }

    await process.waitForPatientQueuePersistenceIdle();
    return c.json({
      steered: true,
      count: result.steered,
      // Include any still-paused recovered entries so the client's list does
      // not lose their chips when a live entry is steered.
      deferredMessages: sessionQueueSummaries(deps, sessionId, process),
    });
  });

  // POST /api/sessions/:sessionId/deferred/:tempId/deliver-without-compaction
  // - Release a patient item held for compact-first delivery so it delivers at
  // its ordinary boundary without compacting.
  routes.post(
    "/sessions/:sessionId/deferred/:tempId/deliver-without-compaction",
    async (c) => {
      const sessionId = c.req.param("sessionId");
      const tempId = c.req.param("tempId");

      const process = deps.supervisor.getProcessForSession(sessionId);
      if (!process) {
        return c.json({ error: "No active process for session" }, 404);
      }
      if (!deps.supervisor.deliverPatientWithoutCompaction(process, tempId)) {
        return c.json({ error: "No compact-first queued message found" }, 404);
      }
      return c.json({
        released: true,
        deferredMessages: sessionQueueSummaries(deps, sessionId, process),
      });
    },
  );

  // PUT /api/sessions/:sessionId/mode - Update permission mode without sending a message
  routes.put("/sessions/:sessionId/mode", async (c) => {
    const sessionId = c.req.param("sessionId");
    const body = await c.req.json<{ mode: PermissionMode }>();

    if (!body.mode) {
      return c.json({ error: "mode is required" }, 400);
    }
    const modeError = permissionModeError(body.mode);
    if (modeError) {
      return c.json({ error: modeError }, 400);
    }

    const process = deps.supervisor.getProcessForSession(sessionId);
    if (!process) {
      return c.json({ error: "No active process for session" }, 404);
    }

    process.setPermissionMode(body.mode);

    return c.json({
      permissionMode: process.permissionMode,
      appliedPermissionMode: process.appliedPermissionMode,
      modeVersion: process.modeVersion,
    });
  });

  // GET /api/sessions/:sessionId/pending-input - Get pending input request
  routes.get("/sessions/:sessionId/pending-input", async (c) => {
    const sessionId = c.req.param("sessionId");

    const process = deps.supervisor.getProcessForSession(sessionId);
    if (!process) {
      return c.json({ request: null });
    }

    // Use getPendingInputRequest which works for both mock and real SDK
    const request = process.getPendingInputRequest();
    return c.json({ request });
  });

  // GET /api/sessions/:sessionId/process - Get process info for a session
  routes.get("/sessions/:sessionId/process", async (c) => {
    const sessionId = c.req.param("sessionId");

    const process = deps.supervisor.getProcessForSession(sessionId);
    if (!process) {
      return c.json({ process: null });
    }

    return c.json({ process: process.getInfo() });
  });

  // POST /api/sessions/:sessionId/input - Respond to input request
  routes.post("/sessions/:sessionId/input", async (c) => {
    const sessionId = c.req.param("sessionId");

    const process = deps.supervisor.getProcessForSession(sessionId);
    if (!process) {
      return c.json({ error: "No active process for session" }, 404);
    }

    let body: InputResponseBody;
    try {
      body = await c.req.json<InputResponseBody>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.requestId || !body.response) {
      return c.json({ error: "requestId and response are required" }, 400);
    }

    // Handle approve_accept_edits: approve and switch permission mode
    const isApproveAcceptEdits = body.response === "approve_accept_edits";

    // Normalize response to approve/deny
    const normalizedResponse =
      body.response === "approve" ||
      body.response === "allow" ||
      body.response === "approve_accept_edits"
        ? "approve"
        : "deny";

    const requestBefore = process.getPendingInputRequest();
    const permissionModeBefore = process.permissionMode;

    if (process.state.type !== "waiting-input") {
      if (isApprovalAuditLogEnabled(deps)) {
        try {
          await appendApprovalAuditLog(deps.dataDir, {
            timestamp: new Date().toISOString(),
            sessionId,
            processId: process.id,
            provider: process.provider,
            requestId: body.requestId,
            request: requestBefore,
            response: body.response,
            normalizedResponse,
            answers: body.answers,
            feedback: body.feedback,
            accepted: false,
            failure: "No pending input request",
            permissionModeBefore,
            permissionModeAfter: process.permissionMode,
          });
        } catch (error) {
          console.warn("[approval-audit] Failed to append audit log:", error);
        }
      }
      return c.json({ error: "No pending input request" }, 400);
    }

    // Call respondToInput which resolves the SDK's canUseTool promise
    const accepted = process.respondToInput(
      body.requestId,
      normalizedResponse,
      body.answers,
      body.feedback,
    );

    if (!accepted) {
      if (isApprovalAuditLogEnabled(deps)) {
        try {
          await appendApprovalAuditLog(deps.dataDir, {
            timestamp: new Date().toISOString(),
            sessionId,
            processId: process.id,
            provider: process.provider,
            requestId: body.requestId,
            request: requestBefore,
            response: body.response,
            normalizedResponse,
            answers: body.answers,
            feedback: body.feedback,
            accepted: false,
            failure: "Invalid request ID or no pending request",
            permissionModeBefore,
            permissionModeAfter: process.permissionMode,
          });
        } catch (error) {
          console.warn("[approval-audit] Failed to append audit log:", error);
        }
      }
      return c.json({ error: "Invalid request ID or no pending request" }, 400);
    }

    // Preserve a concurrently selected Bypass policy: this narrower legacy
    // combined action must not overwrite the user's newer standing choice.
    if (
      isApproveAcceptEdits &&
      process.permissionMode !== "bypassPermissions"
    ) {
      process.setPermissionMode("acceptEdits");
    }

    const pendingInputRequest = process.getPendingInputRequest();
    if (isApprovalAuditLogEnabled(deps)) {
      try {
        await appendApprovalAuditLog(deps.dataDir, {
          timestamp: new Date().toISOString(),
          sessionId,
          processId: process.id,
          provider: process.provider,
          requestId: body.requestId,
          request: requestBefore,
          response: body.response,
          normalizedResponse,
          answers: body.answers,
          feedback: body.feedback,
          accepted: true,
          permissionModeBefore,
          permissionModeAfter: process.permissionMode,
        });
      } catch (error) {
        console.warn("[approval-audit] Failed to append audit log:", error);
      }
    }

    return c.json({ accepted: true, pendingInputRequest });
  });

  // POST /api/sessions/:sessionId/mark-seen - Mark session as seen (read)
  routes.post("/sessions/:sessionId/mark-seen", async (c) => {
    const sessionId = c.req.param("sessionId");

    if (!deps.notificationService) {
      return c.json({ error: "Notification service not available" }, 503);
    }

    let body: {
      timestamp?: string;
      messageId?: string;
      nonHumanUserTurnMessageId?: string;
    } = {};
    try {
      body = await c.req.json();
    } catch {
      // Body is optional
    }

    let acknowledged: boolean | undefined;
    if (body.nonHumanUserTurnMessageId !== undefined) {
      if (
        typeof body.nonHumanUserTurnMessageId !== "string" ||
        !body.nonHumanUserTurnMessageId
      ) {
        return c.json({ error: "Invalid non-human user turn id" }, 400);
      }
      if (!deps.sessionMetadataService) {
        return c.json({ error: "Session metadata service not available" }, 503);
      }
      acknowledged =
        await deps.sessionMetadataService.acknowledgeNonHumanUserTurn(
          sessionId,
          body.nonHumanUserTurnMessageId,
        );
      deps.eventBus?.emit({
        type: "session-metadata-changed",
        sessionId,
        nonHumanUserTurn: nonHumanUserTurnField(
          deps.sessionMetadataService,
          sessionId,
        ),
        timestamp: new Date().toISOString(),
      });
    }

    await deps.notificationService.markSeen(
      sessionId,
      body.timestamp,
      body.messageId,
    );

    // A stale or unknown delivered-turn id leaves the receipt pending; the
    // client needs that answer to report the failed acknowledgement.
    return c.json(
      acknowledged === undefined
        ? { marked: true }
        : { marked: true, acknowledged },
    );
  });

  // DELETE /api/sessions/:sessionId/mark-seen - Mark session as unread
  routes.delete("/sessions/:sessionId/mark-seen", async (c) => {
    const sessionId = c.req.param("sessionId");

    if (!deps.notificationService) {
      return c.json({ error: "Notification service not available" }, 503);
    }

    await deps.notificationService.clearSession(sessionId);

    // Emit event so other tabs/clients can update
    if (deps.eventBus) {
      deps.eventBus.emit({
        type: "session-seen",
        sessionId,
        timestamp: SESSION_UNREAD_TIMESTAMP,
      });
    }

    return c.json({ marked: false });
  });

  // GET /api/notifications/last-seen - Get all last seen entries
  routes.get("/notifications/last-seen", async (c) => {
    if (!deps.notificationService) {
      return c.json({ error: "Notification service not available" }, 503);
    }

    return c.json({ lastSeen: deps.notificationService.getAllLastSeen() });
  });

  // GET /api/debug/metadata - Debug endpoint to inspect metadata service state
  routes.get("/debug/metadata", (c) => {
    if (!deps.sessionMetadataService) {
      return c.json(
        { error: "Session metadata service not available", available: false },
        503,
      );
    }

    const allMetadata = deps.sessionMetadataService.getAllMetadata();
    const sessionCount = Object.keys(allMetadata).length;
    const starredCount = Object.values(allMetadata).filter(
      (m) => m.isStarred,
    ).length;
    const archivedCount = Object.values(allMetadata).filter(
      (m) => m.isArchived,
    ).length;
    const filePath = deps.sessionMetadataService.getFilePath();

    return c.json({
      available: true,
      filePath,
      sessionCount,
      starredCount,
      archivedCount,
    });
  });

  // PUT /api/sessions/:sessionId/metadata - Update session metadata
  routes.put("/sessions/:sessionId/metadata", async (c) => {
    const sessionId = c.req.param("sessionId");

    if (!deps.sessionMetadataService) {
      return c.json({ error: "Session metadata service not available" }, 503);
    }

    let body: unknown = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = parseSessionMetadataPatch(body);
    if (!parsed.ok) {
      return c.json({ error: parsed.error }, parsed.status);
    }
    const { patch } = parsed;

    await deps.sessionMetadataService.updateMetadata(sessionId, patch);

    // Archive is a stop boundary, including for older clients that only know
    // the generic metadata route. Provider-owned background jobs can outlive a
    // graceful turn interrupt, so verify the whole owned process is gone.
    if (patch.archived === true) {
      await deps.supervisor.abortSessionWithVerification(sessionId);
    }

    if (patch.heartbeatTurnText) {
      const savedProjectId =
        deps.sessionMetadataService.getMetadata(sessionId)?.workingProjectId ??
        deps.supervisor.getProcessForSession(sessionId)?.projectId;
      if (savedProjectId) {
        await deps.projectMetadataService?.recordRecentHeartbeatTurnText(
          savedProjectId,
          patch.heartbeatTurnText,
        );
      }
    }

    if (
      patch.heartbeatTurnsEnabled !== undefined ||
      patch.heartbeatTurnsAfterMinutes !== undefined ||
      patch.heartbeatForceAfterMinutes !== undefined
    ) {
      // Heartbeat deadlines are scheduled, not polled, so a fresh opt-in has
      // to announce itself; otherwise an already-quiet session would wait for
      // some unrelated event to re-plan the timer.
      deps.supervisor.notifyHeartbeatScheduleChanged();
    }

    // Emit SSE event so sidebar and other clients can update
    if (deps.eventBus) {
      deps.eventBus.emit({
        type: "session-metadata-changed",
        sessionId,
        title: patch.title,
        archived: patch.archived,
        starred: patch.starred,
        sidebarCategory: patch.sidebarCategory,
        parentSessionId: patch.parentSessionId,
        parentSessionKind:
          patch.parentSessionId === undefined
            ? undefined
            : patch.parentSessionId
              ? "btw-aside"
              : null,
        heartbeatTurnsEnabled: patch.heartbeatTurnsEnabled,
        heartbeatTurnsAfterMinutes: patch.heartbeatTurnsAfterMinutes,
        heartbeatTurnText: patch.heartbeatTurnText,
        heartbeatForceAfterMinutes: patch.heartbeatForceAfterMinutes,
        promptSuggestionMode: patch.promptSuggestionMode ?? undefined,
        recapAfterSeconds: patch.recapAfterSeconds ?? undefined,
        timestamp: new Date().toISOString(),
      });
    }

    return c.json({ updated: true });
  });
}
