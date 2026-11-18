import {
  ALL_PERMISSION_MODES,
  type ContextUsage,
  type DurableRecapMessage,
  type DurableLocalCommandMessage,
  type DurableSyntheticDoneMessage,
  type PermissionRules,
  type PromptSuggestionMode,
  type ProviderName,
  type RecapMode,
  type SessionCreationProvenance,
  type SessionEffectiveModelSettings,
  type SessionSandboxLevel,
  type ShowThinking,
  type ThinkingOption,
  type UploadedFile,
  type UserQuestionAnswers,
  type UserMessageMetadata,
  type UrlProjectId,
  type WorkstreamId,
  agentHarness,
  getModelContextWindow,
  isThinkingOption,
  truncateSessionTitle,
  withKnownGoal,
} from "@vibeallday/shared";
import { isRealUserTurn } from "@vibeallday/shared/transcript/messageProjection";
import { collapseMessageSnapshots } from "@vibeallday/shared/transcript/message";
import type { ClearloopService } from "../services/ClearloopService.js";
import type { ISessionIndexService } from "../indexes/types.js";
import { getLogger } from "../logging/logger.js";
import type { ToolResultMediaStore } from "../media/ToolResultMediaStore.js";
import type {
  SessionMetadata,
  SessionMetadataService,
} from "../metadata/index.js";
import type { ProjectMetadataService } from "../metadata/index.js";
import { goalCommandOf } from "../metadata/SessionMetadataService.js";
import type { NotificationService } from "../notifications/index.js";
import type { CodexSessionScanner } from "../projects/codex-scanner.js";
import type { GeminiSessionScanner } from "../projects/gemini-scanner.js";
import type { ProjectScanner } from "../projects/scanner.js";
import type { PermissionMode, SDKMessage } from "../sdk/types.js";
import type { ModelInfoService } from "../services/ModelInfoService.js";
import type { ProjectQueueScheduler } from "../services/ProjectQueueScheduler.js";
import type { ServerSettingsService } from "../services/ServerSettingsService.js";
import type { SessionQueuePersistenceService } from "../services/SessionQueuePersistenceService.js";
import type { WorkstreamService } from "../services/WorkstreamService.js";
import type { CodexSessionReader } from "../sessions/codex-reader.js";
import type { GeminiSessionReader } from "../sessions/gemini-reader.js";
import type { GrokSessionReader } from "../sessions/grok-reader.js";
import type { PiSessionReader } from "../sessions/pi-reader.js";
import { getCodexProviderForkTurnId } from "../sessions/normalization.js";
import { hasEquivalentRecapMessage } from "../sessions/recap-overlays.js";
import { findSessionListSummaryAcrossProviders } from "../sessions/provider-resolution.js";
import type { ISessionReader } from "../sessions/types.js";
import { getProvider } from "../sdk/providers/index.js";
import { getStaticSlashCommandsForProvider } from "../sdk/providers/staticSlashCommands.js";
import type { ExternalSessionTracker } from "../supervisor/ExternalSessionTracker.js";
import type { ProviderForkBoundary } from "../sdk/providers/types.js";
import type { Process } from "../supervisor/Process.js";
import type {
  ModelSettings,
  QueueFullResponse,
  ResumeMode,
  Supervisor,
} from "../supervisor/Supervisor.js";
import type { QueuedResponse } from "../supervisor/WorkerQueue.js";
import type {
  ContentBlock,
  Message,
  Project,
  Session,
} from "../supervisor/types.js";
import { normalizeOptionalServiceTier } from "./session-request-helpers.js";
import {
  resolveCompactPercent,
  resolveCompactWindow,
} from "./session-compact-thresholds.js";
import {
  isClaudeSdkProviderName,
  isCodexProviderName,
  providerResolutionDeps,
} from "./session-provider-resolution.js";
import type { UserUsageService } from "../auth/UserUsageService.js";
import type { EventBus } from "../watcher/index.js";

export function effectiveModelSettingsFromMetadata(
  metadata: SessionMetadata | undefined,
): SessionEffectiveModelSettings | undefined {
  const settings = metadata?.effectiveLaunchSettings;
  if (!settings) return undefined;

  return {
    requestedModel: settings.requestedModel,
    thinking: settings.thinking,
    effort: settings.effort,
    ...(settings.ultracode === undefined
      ? {}
      : { ultracode: settings.ultracode }),
  };
}

export function permissionModeError(mode: unknown): string | undefined {
  if (
    mode !== undefined &&
    !ALL_PERMISSION_MODES.includes(mode as PermissionMode)
  ) {
    return "Invalid permission mode";
  }
  return undefined;
}

export async function getSessionSlashCommands(
  process: Process | undefined,
  provider: ProviderName | undefined,
  metadata: SessionMetadata | undefined,
) {
  let commands = getStaticSlashCommandsForProvider(provider);
  if (process?.supportsDynamicCommands) {
    try {
      commands = (await process.supportedCommands()) ?? commands;
    } catch (error) {
      getLogger().warn(
        {
          event: "session_dynamic_commands_unavailable",
          sessionId: process.sessionId,
          processId: process.id,
          provider,
          error: error instanceof Error ? error.message : String(error),
        },
        "Falling back to static commands for session read",
      );
    }
  }
  // A stopped session has no provider to ask, so the last observed goal stands
  // in for live state.
  return withKnownGoal(commands, goalCommandOf(metadata));
}

export function roundedMs(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Type guard to check if a result is a QueuedResponse
 */
export function isQueuedResponse(
  result: Process | QueuedResponse | QueueFullResponse,
): result is QueuedResponse {
  return "queued" in result && result.queued === true;
}

/**
 * Type guard to check if a result is a QueueFullResponse
 */
export function isQueueFullResponse(
  result: Process | QueuedResponse | QueueFullResponse,
): result is QueueFullResponse {
  return "error" in result && result.error === "queue_full";
}

export interface SessionsDeps {
  onIssueWindow?: (
    source: { sessionId: string; projectId: string },
    messages: readonly Message[],
  ) => void;
  supervisor: Supervisor;
  scanner: ProjectScanner;
  readerFactory: (project: Project) => ISessionReader;
  externalTracker?: ExternalSessionTracker;
  notificationService?: NotificationService;
  sessionIndexService?: ISessionIndexService;
  sessionMetadataService?: SessionMetadataService;
  /** Records who started each session and who sent each turn. */
  userUsageService?: UserUsageService;
  projectMetadataService?: ProjectMetadataService;
  projectQueueScheduler?: Pick<
    ProjectQueueScheduler,
    | "reserveUserSessionStart"
    | "sessionProjectChanged"
    | "setVibeAllDayCommandRunner"
  >;
  eventBus?: EventBus;
  codexScanner?: CodexSessionScanner;
  codexSessionsDir?: string;
  /** Optional shared Codex reader factory for cross-provider session lookups */
  codexReaderFactory?: (projectPath: string) => CodexSessionReader;
  geminiScanner?: GeminiSessionScanner;
  geminiSessionsDir?: string;
  /** Optional shared Gemini reader factory for cross-provider session lookups */
  geminiReaderFactory?: (projectPath: string) => GeminiSessionReader;
  /** Grok sessions directory (defaults to ~/.grok/sessions) */
  grokSessionsDir?: string;
  /** Optional shared Grok reader factory for cross-provider session lookups */
  grokReaderFactory?: (projectPath: string) => GrokSessionReader;
  /** pi sessions directory (defaults to ~/.pi/agent/sessions) */
  piSessionsDir?: string;
  /** Optional shared pi reader factory for cross-provider session lookups */
  piReaderFactory?: (projectPath: string) => PiSessionReader;
  /** ServerSettingsService for reading global instructions */
  serverSettingsService?: ServerSettingsService;
  /** WorkstreamService for resolving experimental checkout lanes */
  workstreamService?: WorkstreamService;
  /** ModelInfoService for context window lookups */
  modelInfoService?: ModelInfoService;
  /** Durable store for recovered patient queued messages */
  sessionQueuePersistenceService?: SessionQueuePersistenceService;
  /** Same-session `/clearloop` jobs; this module supplies its runner. */
  clearloopService?: ClearloopService;
  /** Materializes image-bearing tool results for authenticated session reads. */
  toolResultMediaStore?: ToolResultMediaStore;
  /** Data directory for local security/audit logs */
  dataDir?: string;
  /** Test-only session-detail augmentation delay for performance clock probes. */
  persistedAugmentDelayMs?: number;
  /** Authenticated exact probes for bare absolute-path viewer links. */
  resolveAbsoluteFilePaths?: (
    paths: readonly string[],
  ) => Promise<ReadonlySet<string>>;
}

export function resolveCompactModelSettings(
  deps: SessionsDeps,
  options: {
    provider?: ProviderName;
    vibeAllDayModelId?: string;
    modelCandidates?: (string | undefined)[];
  },
): Pick<
  ModelSettings,
  | "compactAtContextPercent"
  | "compactAtContextWindow"
  | "forceVibeAllDayOrchestratedCompaction"
  | "claudeAutoCompactPercentOverride"
> {
  const defaults = deps.serverSettingsService?.getSetting("clientDefaults");
  const compactAtContextPercent = resolveCompactPercent(
    defaults?.compactAtContextPercent,
    options.vibeAllDayModelId,
  );
  const modelInfoService = deps.modelInfoService;
  const resolveContextWindow = modelInfoService
    ? (model: string | undefined, provider?: ProviderName) =>
        modelInfoService.getContextWindow(model, provider)
    : getModelContextWindow;
  const compactAtContextWindow =
    compactAtContextPercent === undefined
      ? undefined
      : resolveCompactWindow(
          options.provider,
          options.modelCandidates ?? [options.vibeAllDayModelId],
          resolveContextWindow,
        );
  return {
    compactAtContextPercent,
    compactAtContextWindow,
    forceVibeAllDayOrchestratedCompaction:
      defaults?.forceVibeAllDayOrchestratedCompaction === true,
    claudeAutoCompactPercentOverride:
      options.provider === "claude"
        ? deps.serverSettingsService?.getSetting(
            "claudeAutoCompactPercentOverride",
          )
        : undefined,
  };
}

export function isApprovalAuditLogEnabled(deps: SessionsDeps): boolean {
  return (
    deps.serverSettingsService?.getSetting("approvalAuditLogEnabled") === true
  );
}

export async function resolveSessionReader({
  deps,
  project,
  sessionId,
  projectId,
}: {
  deps: SessionsDeps;
  project: Project;
  sessionId: string;
  projectId: UrlProjectId;
}): Promise<ISessionReader> {
  const metadataProvider = deps.sessionMetadataService?.getProvider(
    sessionId,
  ) as ProviderName | undefined;
  const resolved = await findSessionListSummaryAcrossProviders(
    project,
    sessionId,
    projectId,
    providerResolutionDeps(deps),
    metadataProvider,
  );

  return resolved?.source.reader ?? deps.readerFactory(project);
}

export interface StartSessionBody {
  routerAccountId?: string;
  routerPoolId?: string;
  routerPolicy?: string;
  creationProvenance?: SessionCreationProvenance;
  computerControl?: boolean;
  machineControl?: boolean;
  message: string;
  images?: string[];
  documents?: string[];
  attachments?: UploadedFile[];
  mode?: PermissionMode;
  model?: string;
  serviceTier?: string;
  thinking?: ThinkingOption;
  /** Display preference for thinking rows (default/on/off). */
  showThinking?: ShowThinking;
  /** Standing ultracode orchestration, orthogonal to the thinking option. */
  ultracode?: boolean;
  provider?: ProviderName;
  /** Browser-side timestamp for request latency tracking (epoch ms) */
  clientTimestamp?: number;
  /** VIBEALLDAY-internal submission timing and delivery-intent metadata. */
  messageMetadata?: UserMessageMetadata;
  /** Client-generated temp ID for optimistic UI tracking */
  tempId?: string;
  /** SSH host alias for remote execution (undefined = local) */
  executor?: string;
  /** Default-off VIBEALLDAY host filesystem confinement settled at session creation. */
  sandboxLevel?: SessionSandboxLevel;
  /** Public-only egress boundary for a project-write session. */
  sandboxNetworkFirewall?: boolean;
  /** Permission rules for tool filtering (deny/allow patterns) */
  permissions?: PermissionRules;
  /** Session recap behavior for future away-return triggers. */
  recapMode?: RecapMode;
  /** Browser-away duration before VIBEALLDAY asks this session for a recap. */
  recapAfterSeconds?: number;
  /** Prompt suggestion behavior for this session. */
  promptSuggestionMode?: PromptSuggestionMode;
  /** Session-level helper side model for simulated helper features. */
  helperSideModel?: string;
  /** Resume strategy for existing sessions. */
  resumeMode?: ResumeMode;
  /** Experimental workstream lane target for new project sessions. */
  workstreamId?: string;
}

export function hasSessionMessageContent(body: StartSessionBody): boolean {
  return (
    typeof body.message === "string" &&
    (body.message.length > 0 ||
      (Array.isArray(body.attachments) && body.attachments.length > 0))
  );
}

export interface CreateSessionBody {
  routerAccountId?: string;
  routerPoolId?: string;
  routerPolicy?: string;
  creationProvenance?: SessionCreationProvenance;
  computerControl?: boolean;
  machineControl?: boolean;
  mode?: PermissionMode;
  model?: string;
  serviceTier?: string;
  thinking?: ThinkingOption;
  /** Display preference for thinking rows (default/on/off). */
  showThinking?: ShowThinking;
  /** Standing ultracode orchestration, orthogonal to the thinking option. */
  ultracode?: boolean;
  provider?: ProviderName;
  /** SSH host alias for remote execution (undefined = local) */
  executor?: string;
  /** Default-off VIBEALLDAY host filesystem confinement settled at session creation. */
  sandboxLevel?: SessionSandboxLevel;
  /** Public-only egress boundary for a project-write session. */
  sandboxNetworkFirewall?: boolean;
  /** Permission rules for tool filtering (deny/allow patterns) */
  permissions?: PermissionRules;
  /** Session recap behavior for future away-return triggers. */
  recapMode?: RecapMode;
  /** Browser-away duration before VIBEALLDAY asks this session for a recap. */
  recapAfterSeconds?: number;
  /** Prompt suggestion behavior for this session. */
  promptSuggestionMode?: PromptSuggestionMode;
  /** Session-level helper side model for simulated helper features. */
  helperSideModel?: string;
  /** Experimental workstream lane target for new project sessions. */
  workstreamId?: string;
}

export function parseCreationProvenance(
  value: unknown,
): SessionCreationProvenance | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  if (input.surface !== "web" && input.surface !== "desktop") {
    return undefined;
  }
  const boundedString = (field: unknown): string | undefined => {
    if (typeof field !== "string") return undefined;
    const trimmed = field.trim();
    return trimmed && trimmed.length <= 120 ? trimmed : undefined;
  };
  let clientOrigin: string | undefined;
  if (
    typeof input.clientOrigin === "string" &&
    input.clientOrigin.length <= 512
  ) {
    try {
      const url = new URL(input.clientOrigin);
      if (url.protocol === "http:" || url.protocol === "https:") {
        clientOrigin = url.origin;
      }
    } catch {
      // Provenance is an optional hint; a malformed origin must not block launch.
    }
  }
  return {
    surface: input.surface,
    ...(clientOrigin ? { clientOrigin } : {}),
    ...(boundedString(input.clientVersion)
      ? { clientVersion: boundedString(input.clientVersion) }
      : {}),
    ...(boundedString(input.clientCommit)
      ? { clientCommit: boundedString(input.clientCommit) }
      : {}),
  };
}

export interface InputResponseBody {
  requestId: string;
  response: "approve" | "approve_accept_edits" | "deny" | string;
  answers?: UserQuestionAnswers;
  feedback?: string;
}

export function parseSessionSandboxLevel(
  value: unknown,
  networkFirewall: unknown = undefined,
  fallbackLevel: SessionSandboxLevel = "none",
  fallbackNetworkFirewall: boolean | undefined = undefined,
):
  | {
      sandboxLevel: SessionSandboxLevel;
      sandboxNetworkFirewall: boolean;
    }
  | { error: string } {
  const sandboxLevel =
    value === undefined || value === null || value === ""
      ? fallbackLevel
      : value;
  if (sandboxLevel !== "none" && sandboxLevel !== "project-write") {
    return { error: 'sandboxLevel must be "none" or "project-write"' };
  }
  if (
    networkFirewall !== undefined &&
    networkFirewall !== null &&
    typeof networkFirewall !== "boolean"
  ) {
    return { error: "sandboxNetworkFirewall must be a boolean" };
  }
  if (sandboxLevel !== "project-write" && networkFirewall === true) {
    return {
      error: "sandboxNetworkFirewall requires sandboxLevel project-write",
    };
  }
  const defaultNetworkFirewall =
    sandboxLevel === fallbackLevel && fallbackNetworkFirewall !== undefined
      ? fallbackNetworkFirewall
      : true;
  return {
    sandboxLevel,
    sandboxNetworkFirewall:
      sandboxLevel === "project-write" &&
      (networkFirewall === undefined || networkFirewall === null
        ? defaultNetworkFirewall
        : networkFirewall),
  };
}

export function persistedSandboxNetworkFirewall(
  metadata:
    | { sandboxLevel?: SessionSandboxLevel; sandboxNetworkFirewall?: boolean }
    | null
    | undefined,
): boolean {
  return (
    metadata?.sandboxLevel === "project-write" &&
    metadata.sandboxNetworkFirewall !== false
  );
}

/**
 * Launch choices one resume request makes for an existing session. An unset
 * field falls back to what the session saved, so a resume with no client body
 * (a `/clearloop` iteration, a body-less route call) keeps the session's
 * standing settings.
 */
export interface ResumeLaunchRequest {
  /** VIBEALLDAY model id the request names; absent recovers the saved one. */
  model?: string;
  serviceTier?: ModelSettings["serviceTier"];
  thinking?: ModelSettings["thinking"];
  effort?: ModelSettings["effort"];
  ultracode?: ModelSettings["ultracode"];
  /** SSH host alias the request names; absent recovers the saved one. */
  executor?: string;
  permissions?: ModelSettings["permissions"];
  recapMode?: ModelSettings["recapMode"];
  recapAfterSeconds?: number;
  promptSuggestionMode?: ModelSettings["promptSuggestionMode"];
  helperSideModel?: string;
  resumeMode: NonNullable<ModelSettings["resumeMode"]>;
  resumeSessionAt?: string;
}

export function inheritedSandboxSettings(
  metadata:
    | {
        sandboxLevel?: SessionSandboxLevel;
        sandboxNetworkFirewall?: boolean;
        sandboxStateKey?: string;
      }
    | null
    | undefined,
):
  | {
      sandboxLevel: "project-write";
      sandboxNetworkFirewall: boolean;
      sandboxStateKey?: string;
    }
  | Record<string, never> {
  if (metadata?.sandboxLevel !== "project-write") return {};
  return {
    sandboxLevel: "project-write",
    sandboxNetworkFirewall: metadata.sandboxNetworkFirewall !== false,
    sandboxStateKey: metadata.sandboxStateKey,
  };
}

export interface RestartSessionBody extends CreateSessionBody {
  reason?: string;
  /**
   * "handoff" (default): start a fresh session seeded with a bounded
   * transcript summary. "fork": copy the provider transcript into a new
   * session (real prefix fork; provider must support it — Claude today)
   * and continue there.
   */
  restartMode?: "handoff" | "fork";
  /**
   * Fork slice point: transcript message UUID (inclusive). Omit for a
   * full-transcript fork. Only meaningful with restartMode "fork".
   */
  forkUpToMessageId?: string;
  /**
   * The client URL the user was viewing when they triggered the handoff.
   * Surfaced in the handoff's Source Session block as a self-documenting,
   * clickable pointer back to the source session. Validated server-side.
   */
  sourceUrl?: string;
  /**
   * The handoff message to seed the successor with, replacing the text this
   * route would otherwise build. Set when the user edited the draft the
   * preview route returned. Ignored by "fork", which copies the real
   * transcript instead of sending a message.
   */
  handoffText?: string;
}

function parseOptionalJsonObjectBody(
  rawBody: string,
): { body: Record<string, unknown> } | { error: string } {
  if (rawBody.trim().length === 0) return { body: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { error: "Invalid JSON body" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "Invalid JSON body" };
  }
  return { body: parsed as Record<string, unknown> };
}

const REACTIVATE_SHOW_THINKING_OPTIONS: ReadonlySet<unknown> = new Set([
  "default",
  "on",
  "off",
]);

function isPermissionRules(value: unknown): value is PermissionRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const rules = value as Record<string, unknown>;
  return ["allow", "deny"].every((field) => {
    const patterns = rules[field];
    return (
      patterns === undefined ||
      (Array.isArray(patterns) &&
        patterns.every((pattern) => typeof pattern === "string"))
    );
  });
}

export function parseOptionalReactivateSessionBody(
  rawBody: string,
): { body: CreateSessionBody } | { error: string } {
  const parsed = parseOptionalJsonObjectBody(rawBody);
  if ("error" in parsed) return parsed;
  const body = parsed.body;

  if (Object.hasOwn(body, "model") && typeof body.model !== "string") {
    return { error: "model must be a string" };
  }
  if (
    Object.hasOwn(body, "provider") &&
    (typeof body.provider !== "string" ||
      !getProvider(body.provider as ProviderName))
  ) {
    return { error: "Invalid provider" };
  }
  if (
    Object.hasOwn(body, "serviceTier") &&
    body.serviceTier !== undefined &&
    body.serviceTier !== null &&
    body.serviceTier !== "" &&
    normalizeOptionalServiceTier(body.serviceTier) === undefined
  ) {
    return { error: "serviceTier must be a valid tier name" };
  }
  if (Object.hasOwn(body, "thinking") && !isThinkingOption(body.thinking)) {
    return { error: "Invalid thinking option" };
  }
  if (
    Object.hasOwn(body, "showThinking") &&
    !REACTIVATE_SHOW_THINKING_OPTIONS.has(body.showThinking)
  ) {
    return { error: "Invalid showThinking option" };
  }
  if (
    Object.hasOwn(body, "permissions") &&
    body.permissions !== undefined &&
    body.permissions !== null &&
    !isPermissionRules(body.permissions)
  ) {
    return { error: "permissions must contain string allow/deny arrays" };
  }

  return { body: body as unknown as CreateSessionBody };
}

export function parseOptionalRestartSessionBody(
  rawBody: string,
): { body: RestartSessionBody } | { error: string } {
  const parsed = parseOptionalJsonObjectBody(rawBody);
  if ("error" in parsed) return parsed;
  const body = parsed.body;
  if (
    body.restartMode !== undefined &&
    body.restartMode !== "handoff" &&
    body.restartMode !== "fork"
  ) {
    return { error: 'restartMode must be "handoff" or "fork"' };
  }
  for (const [field, label] of [
    ["reason", "reason"],
    ["forkUpToMessageId", "forkUpToMessageId"],
    ["sourceUrl", "sourceUrl"],
    ["model", "model"],
  ] as const) {
    if (body[field] !== undefined && typeof body[field] !== "string") {
      return { error: `${label} must be a string` };
    }
  }
  if (
    body.provider !== undefined &&
    (typeof body.provider !== "string" ||
      !getProvider(body.provider as ProviderName))
  ) {
    return { error: "Invalid provider" };
  }

  return { body: body as RestartSessionBody };
}

const RESTART_HANDOFF_MAX_CHARS = 40_000;
const RESTART_HANDOFF_JSON_MAX_CHARS = 2_000;
const RESTART_HANDOFF_COMPACT_MAX_CHARS = 10_000;
const RESTART_HANDOFF_USER_TURNS_MAX_CHARS = 28_000;
const RESTART_HANDOFF_ACTIVITY_MAX_CHARS = 14_000;
const RESTART_HANDOFF_USER_TURN_MAX_CHARS = 4_000;
const RESTART_HANDOFF_ACTIVITY_ITEM_MAX_CHARS = 900;
const RESTART_HANDOFF_QUEUED_MAX_CHARS = 4_000;
const RESTART_HANDOFF_RECENT_USER_TURNS = 10;
const RESTART_HANDOFF_RECENT_ACTIVITY_ITEMS = 24;
const RESTART_COMPACT_WAIT_MS = 12_000;

export function parseRestartHandoffText(
  value: unknown,
): { handoffText?: string } | { error: string } {
  if (value === undefined) return { handoffText: undefined };
  if (typeof value !== "string") {
    return { error: "handoffText must be a string" };
  }
  if (value.length > RESTART_HANDOFF_MAX_CHARS) {
    return {
      error: `handoffText must be at most ${RESTART_HANDOFF_MAX_CHARS} characters`,
    };
  }
  return { handoffText: value };
}

function truncateForRestart(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  const omitted = text.length - maxChars;
  return `${text.slice(0, maxChars).trimEnd()}\n[truncated ${omitted} chars]`;
}

function formatRestartBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}\u202fb`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}\u202fkb`;
  if (bytes < 1024 * 1024 * 1024)
    return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}\u202fmb`;
  return `${Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10}\u202fgb`;
}

function stringifyForRestart(value: unknown, maxChars: number): string {
  if (typeof value === "string") {
    return truncateForRestart(value, maxChars);
  }
  try {
    return truncateForRestart(JSON.stringify(value, null, 2), maxChars);
  } catch {
    return "[unserializable content]";
  }
}

function renderRestartContent(content: unknown): string {
  if (content === undefined || content === null) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return stringifyForRestart(content, RESTART_HANDOFF_JSON_MAX_CHARS);
  }

  return content
    .map((block) => {
      if (typeof block === "string") {
        return block;
      }
      if (!block || typeof block !== "object") {
        return "";
      }

      const typed = block as ContentBlock;
      switch (typed.type) {
        case "text":
          return typed.text ?? "";
        case "thinking":
          return typed.thinking
            ? `[thinking]\n${typed.thinking}`
            : "[thinking]";
        case "tool_use":
          return `[tool_use ${typed.name ?? "unknown"}]\n${stringifyForRestart(
            typed.input,
            RESTART_HANDOFF_JSON_MAX_CHARS,
          )}`;
        case "tool_result":
          return `[tool_result${typed.is_error ? " error" : ""} ${
            typed.tool_use_id ?? ""
          }]\n${renderRestartContent(typed.content)}`;
        case "image":
        case "input_image":
          return "[image]";
        case "document":
          return "[document]";
        default:
          return `[${typed.type}]\n${stringifyForRestart(
            typed,
            RESTART_HANDOFF_JSON_MAX_CHARS,
          )}`;
      }
    })
    .filter((part) => part.trim().length > 0)
    .join("\n\n");
}

function compactRestartLine(text: string, maxChars: number): string {
  return truncateForRestart(text.replace(/\s+/g, " ").trim(), maxChars);
}

function messageRole(message: Message): string {
  const nested = message.message as { role?: unknown } | undefined;
  return (
    (typeof nested?.role === "string" && nested.role) ||
    (typeof message.role === "string" && message.role) ||
    message.type ||
    "message"
  );
}

function messageContent(message: Message): unknown {
  const nested = message.message as { content?: unknown } | undefined;
  return nested?.content ?? (message as { content?: unknown }).content;
}

export function messageId(message: Message | undefined): string | undefined {
  if (!message) {
    return undefined;
  }
  return (
    (typeof message.uuid === "string" && message.uuid) ||
    (typeof message.id === "string" && message.id) ||
    undefined
  );
}

type DurableSessionOverlayMessage =
  | DurableRecapMessage
  | DurableLocalCommandMessage
  | DurableSyntheticDoneMessage;

export function findDurableOverlayCursor(
  afterMessageId: string | undefined,
  overlays: readonly DurableSessionOverlayMessage[],
): DurableSessionOverlayMessage | undefined {
  if (!afterMessageId) {
    return undefined;
  }
  return overlays.find(
    (overlay) =>
      overlay.uuid === afterMessageId || overlay.id === afterMessageId,
  );
}

export function sliceAfterDurableOverlayCursor(params: {
  messages: Message[];
  overlay: DurableSessionOverlayMessage;
  cursorId: string;
}): { messages: Message[]; found: boolean } {
  const index = params.messages.findIndex((message) => {
    const id = messageId(message);
    return (
      id === params.cursorId ||
      id === params.overlay.uuid ||
      id === params.overlay.id ||
      (params.overlay.type === "system" &&
        params.overlay.subtype === "away_summary" &&
        hasEquivalentRecapMessage([message], params.overlay))
    );
  });
  if (index < 0) {
    return { messages: params.messages, found: false };
  }
  return { messages: params.messages.slice(index + 1), found: true };
}

function messageHasToolResult(message: Message): boolean {
  if (message.toolUseResult !== undefined) {
    return true;
  }
  const content = messageContent(message);
  return (
    Array.isArray(content) &&
    content.some(
      (block) =>
        !!block &&
        typeof block === "object" &&
        (block as ContentBlock).type === "tool_result",
    )
  );
}

function isRestartInternalCompactCommand(message: Message): boolean {
  if (messageRole(message) !== "user" || messageHasToolResult(message)) {
    return false;
  }
  const content = renderRestartContent(messageContent(message)).trim();
  return /^\/(?:compact|compress)\b/i.test(content);
}

function toolInputSummary(input: unknown): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return compactRestartLine(stringifyForRestart(input, 400), 400);
  }

  const record = input as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of [
    "file_path",
    "path",
    "command",
    "query",
    "pattern",
    "old_string",
    "new_string",
  ]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      parts.push(`${key}=${compactRestartLine(value, 180)}`);
    }
  }

  return parts.length > 0
    ? parts.join("; ")
    : compactRestartLine(stringifyForRestart(input, 400), 400);
}

function shellCommandFromInput(input: unknown): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return "";
  }
  const command = (input as Record<string, unknown>).command;
  if (typeof command === "string") {
    return command.trim();
  }
  if (Array.isArray(command)) {
    return command
      .filter((part): part is string => typeof part === "string")
      .join(" ")
      .trim();
  }
  return "";
}

// Only shell/bash commands survive in the activity log: they are the one tool
// class whose intent is legible without the (dropped) output, and the source
// session's jsonl holds everything else for grep. Non-shell tool calls, tool
// results, and thinking are omitted entirely.
// See topics/restart-handoff-template.md.
function summarizeToolUse(name: string | undefined, input: unknown): string {
  if (!/bash|shell/i.test(name ?? "")) {
    return "";
  }
  const command = shellCommandFromInput(input) || toolInputSummary(input);
  return command ? `$ ${compactRestartLine(command, 800)}` : "";
}

function renderRestartActivityContent(message: Message): string {
  if (message.toolUse) {
    return summarizeToolUse(message.toolUse.name, message.toolUse.input);
  }
  if (message.toolUseResult !== undefined) {
    // Tool output is recovered from the source jsonl, not carried here.
    return "";
  }

  const content = messageContent(message);
  if (!Array.isArray(content)) {
    return renderRestartContent(content);
  }

  return content
    .map((block) => {
      if (typeof block === "string") {
        return block;
      }
      if (!block || typeof block !== "object") {
        return "";
      }

      const typed = block as ContentBlock;
      switch (typed.type) {
        case "tool_use":
          return summarizeToolUse(typed.name, typed.input);
        case "tool_result":
        case "thinking":
          return "";
        default:
          return renderRestartContent([typed]);
      }
    })
    .filter((part) => part.trim().length > 0)
    .join("\n");
}

function formatRestartMessage(message: Message): string | null {
  if (isRestartInternalCompactCommand(message)) {
    return null;
  }

  const isUser = isHumanUserMessage(message);
  const content = isUser
    ? renderRestartContent(messageContent(message))
    : renderRestartActivityContent(message);
  const trimmed = content.trim();

  if (!trimmed) {
    return null;
  }

  const body = truncateForRestart(
    trimmed,
    isUser
      ? RESTART_HANDOFF_USER_TURN_MAX_CHARS
      : RESTART_HANDOFF_ACTIVITY_ITEM_MAX_CHARS,
  );
  // User directions retain a divider. Assistant prose and shell commands are
  // self-delimiting within the activity section.
  return isUser ? `### user\n\n${body}` : body;
}

function formatRestartQueuedMessage(
  message: {
    tempId?: string;
    content: string;
    timestamp: string;
    attachments?: UploadedFile[];
    attachmentCount?: number;
  },
  index: number,
): string {
  const attachmentLines =
    message.attachments?.length && message.attachments.length > 0
      ? `\n\nUser uploaded files:\n${message.attachments
          .map(
            (file) =>
              `- [${file.originalName.replaceAll("[", "\\[").replaceAll("]", "\\]")}](<${file.path}>) (${formatRestartBytes(file.size)}, ${file.mimeType}${file.width && file.height ? `, ${file.width}x${file.height}` : ""})`,
          )
          .join("\n")}`
      : message.attachmentCount && message.attachmentCount > 0
        ? `\nAttachments queued: ${message.attachmentCount}`
        : "";
  const tempIdLine = message.tempId ? `\nTemp ID: ${message.tempId}` : "";
  return `### queued user ${index + 1}\n\n${truncateForRestart(
    message.content.trim() || "[empty queued turn]",
    RESTART_HANDOFF_QUEUED_MAX_CHARS,
  )}${attachmentLines}${tempIdLine}`;
}

type RestartQueuedMessage = {
  tempId?: string;
  content: string;
  timestamp: string;
  attachments?: UploadedFile[];
  attachmentCount?: number;
};

function getRestartQueuedMessages(
  process: Process | undefined,
): RestartQueuedMessage[] {
  return process?.getDeferredQueueSummary?.() ?? [];
}

type RestartCompactAttempt =
  | { status: "unavailable"; reason: string }
  | { status: "skipped"; reason: string }
  | { status: "completed"; command: string }
  | { status: "timed-out"; command: string }
  | { status: "failed"; command?: string; reason: string };

function isCompactBoundaryMessage(message: SDKMessage | Message): boolean {
  return message.type === "system" && message.subtype === "compact_boundary";
}

async function waitForRestartCompactBoundary(
  process: Process,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    let finished = false;
    let unsubscribe: (() => void) | undefined;
    const finish = (completed: boolean) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeout);
      unsubscribe?.();
      resolve(completed);
    };
    const timeout = setTimeout(() => finish(false), timeoutMs);

    unsubscribe = process.subscribe((event) => {
      if (event.type === "message" && isCompactBoundaryMessage(event.message)) {
        finish(true);
        return;
      }
      if (event.type === "terminated" || event.type === "error") {
        finish(false);
      }
    });
  });
}

export async function tryRestartCompact(
  process: Process | undefined,
): Promise<RestartCompactAttempt> {
  if (!process) {
    return { status: "unavailable", reason: "no active source process" };
  }
  if (process.state.type !== "idle") {
    return {
      status: "skipped",
      reason: `source process was ${process.state.type}`,
    };
  }
  if (!process.supportsDynamicCommands) {
    return {
      status: "unavailable",
      reason: "source process does not advertise slash commands",
    };
  }

  let command: string | undefined;
  try {
    const commands = await process.supportedCommands();
    command =
      commands?.find((candidate) => candidate.name === "compact")?.name ??
      commands?.find((candidate) => candidate.name === "compress")?.name;
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  if (!command) {
    return {
      status: "unavailable",
      reason: "no compact/compress slash command advertised",
    };
  }

  const waitForCompact = waitForRestartCompactBoundary(
    process,
    RESTART_COMPACT_WAIT_MS,
  );
  const queued = process.queueMessage({ text: `/${command}` });
  if (!queued.success) {
    return {
      status: "failed",
      command,
      reason: queued.error ?? "compact command was not accepted",
    };
  }

  return (await waitForCompact)
    ? { status: "completed", command }
    : { status: "timed-out", command };
}

function latestCompactSummary(messages: Message[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message?.type !== "system" ||
      (message as { subtype?: unknown }).subtype !== "compact_boundary"
    ) {
      continue;
    }

    const summary = renderRestartContent(messageContent(message)).trim();
    if (summary && !/^context compacted\.?$/i.test(summary)) {
      return truncateForRestart(summary, RESTART_HANDOFF_COMPACT_MAX_CHARS);
    }
  }
  return null;
}

function selectRestartMessages(params: {
  messages: Message[];
  maxItems: number;
  maxChars: number;
  predicate: (message: Message) => boolean;
  selectedIndexes: Set<number>;
}): string[] {
  const selected: string[] = [];
  let used = 0;

  for (let index = params.messages.length - 1; index >= 0; index -= 1) {
    const message = params.messages[index];
    if (!message || !params.predicate(message)) {
      continue;
    }
    const formatted = formatRestartMessage(message);
    if (!formatted) {
      continue;
    }
    const nextSize = formatted.length + 2;
    if (
      selected.length >= params.maxItems ||
      (selected.length > 0 && used + nextSize > params.maxChars)
    ) {
      break;
    }
    selected.push(formatted);
    params.selectedIndexes.add(index);
    used += nextSize;
  }

  return selected.reverse();
}

export function buildRestartTranscript(messages: Message[]): {
  transcript: string;
  omittedCount: number;
} {
  const selectedIndexes = new Set<number>();
  const compactSummary = latestCompactSummary(messages);
  const userTurns = selectRestartMessages({
    messages,
    maxItems: RESTART_HANDOFF_RECENT_USER_TURNS,
    maxChars: RESTART_HANDOFF_USER_TURNS_MAX_CHARS,
    predicate: isHumanUserMessage,
    selectedIndexes,
  });
  const activity = selectRestartMessages({
    messages,
    maxItems: RESTART_HANDOFF_RECENT_ACTIVITY_ITEMS,
    maxChars: RESTART_HANDOFF_ACTIVITY_MAX_CHARS,
    predicate: (message) =>
      !isHumanUserMessage(message) &&
      !(
        message.type === "system" &&
        (message as { subtype?: unknown }).subtype === "compact_boundary" &&
        compactSummary
      ),
    selectedIndexes,
  });

  const sections = [
    compactSummary
      ? `## Provider-Native Compact Summary\n\n${compactSummary}`
      : undefined,
    userTurns.length > 0
      ? `## Recent User Turns\n\n${userTurns.join("\n\n")}`
      : undefined,
    activity.length > 0
      ? `## Recent Agent and Tool Activity\n\n${activity.join("\n\n")}`
      : undefined,
  ].filter((section): section is string => Boolean(section));

  return {
    transcript: truncateForRestart(
      sections.join("\n\n"),
      RESTART_HANDOFF_MAX_CHARS,
    ),
    omittedCount: Math.max(0, messages.length - selectedIndexes.size),
  };
}

function compactRestartTitleText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripMarkdownHeading(text: string): string {
  return text.replace(/^#+\s*/, "");
}

function isGeneratedRestartHandoffTitle(text: string): boolean {
  const title = stripMarkdownHeading(compactRestartTitleText(text));
  return (
    /^Restart Handoff\b/i.test(title) ||
    /^Handoff:\s*Restart Handoff\b/i.test(title) ||
    /^Handoff:\s*VibeAllDay is starting this as a fresh agent session\b/i.test(
      title,
    ) ||
    /^VibeAllDay is starting this as a fresh agent session\b/i.test(title)
  );
}

export function normalizeRestartTitleCandidate(
  title: string | null | undefined,
): string | undefined {
  if (!title) {
    return undefined;
  }
  const candidate = stripMarkdownHeading(compactRestartTitleText(title));
  if (!candidate || isGeneratedRestartHandoffTitle(candidate)) {
    return undefined;
  }
  return candidate;
}

function isHumanUserMessage(message: Message): boolean {
  const nested = message.message as { role?: unknown } | undefined;
  const role =
    (typeof nested?.role === "string" && nested.role) ||
    (typeof message.role === "string" && message.role) ||
    message.type;
  return role === "user" && !messageHasToolResult(message);
}

export function completedPublicShareMessageCount(options: {
  messages: Message[];
  process?: Process;
  sourceIsExternal: boolean;
  sourceUpdatedAt: string;
  hasDurableHistory: boolean;
}): number {
  const { messages, process } = options;
  const sourceIsBusy =
    options.sourceIsExternal ||
    process?.state.type === "in-turn" ||
    process?.state.type === "waiting-input";
  if (!sourceIsBusy) {
    return messages.length;
  }

  // Replay-only messages are a live catch-up buffer, not a durable completed
  // turn. Before the provider creates its transcript, the stable prefix is
  // therefore empty.
  if (!options.hasDurableHistory) {
    return 0;
  }

  // A newly resumed process can be active before its first input reaches the
  // existing transcript. In that window, every persisted row predates the
  // active turn and is already safe to capture.
  const sourceUpdatedAt = Date.parse(options.sourceUpdatedAt);
  if (
    process &&
    !Number.isNaN(sourceUpdatedAt) &&
    sourceUpdatedAt < process.startedAt.getTime()
  ) {
    return messages.length;
  }

  // Provider transcripts are append-only within a turn. While a source is
  // busy, the latest user-authored request begins the only incomplete suffix;
  // retaining everything before it captures every completed turn.
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message && isRealUserTurn(message)) {
      return index;
    }
  }
  return 0;
}

export type SessionForkKind =
  | "clone-latest-complete"
  | "before-user-turn"
  | "after-user-turn";

function providerForkBoundaryForMessage(
  providerName: ProviderName,
  message: Message,
): ProviderForkBoundary | null {
  const retainedThroughMessageId = messageId(message);
  if (!retainedThroughMessageId) return null;

  if (isClaudeSdkProviderName(providerName)) {
    return {
      kind: "message",
      provider: providerName,
      messageId: retainedThroughMessageId,
    };
  }
  if (isCodexProviderName(providerName)) {
    const turnId = getCodexProviderForkTurnId(message);
    return turnId ? { kind: "turn", provider: providerName, turnId } : null;
  }
  if (providerName === "pi") {
    return {
      kind: "entry",
      provider: "pi",
      entryId: retainedThroughMessageId,
    };
  }
  return null;
}

export function resolveForkAfterBoundary(
  messages: Message[],
  sourceMessageId: string,
  sourceIsBusy: boolean,
  providerName?: ProviderName,
):
  | {
      placementAfterMessageId: string;
      retainedThroughMessageId: string;
      retainedThroughContext?: string;
      providerBoundary?: ProviderForkBoundary;
    }
  | { error: string; status: 400 | 404 | 409 } {
  const sourceIndex = messages.findIndex(
    (message) => messageId(message) === sourceMessageId,
  );
  const sourceMessage = messages[sourceIndex];
  if (sourceIndex < 0 || !sourceMessage) {
    return { error: "Selected source message was not found", status: 404 };
  }
  if (!isRealUserTurn(sourceMessage)) {
    return {
      error: "sourceMessageId must identify a user-authored request",
      status: 400,
    };
  }

  const chain = sourceChainMessages(messages, sourceMessage);
  const chainIndex = chain.indexOf(sourceMessage);
  let nextUserIndex = -1;
  for (let index = chainIndex + 1; index < chain.length; index += 1) {
    const candidate = chain[index];
    if (candidate && isRealUserTurn(candidate)) {
      nextUserIndex = index;
      break;
    }
  }
  if (nextUserIndex < 0 && sourceIsBusy) {
    return {
      error: "The selected turn is still in progress",
      status: 409,
    };
  }

  const searchEnd = nextUserIndex >= 0 ? nextUserIndex - 1 : chain.length - 1;
  let hasAssistantResponse = false;
  for (let index = chainIndex + 1; index <= searchEnd; index += 1) {
    const candidate = chain[index];
    if (candidate && messageRole(candidate) === "assistant") {
      hasAssistantResponse = true;
      break;
    }
  }
  if (!hasAssistantResponse) {
    return {
      error: "The selected request has no completed assistant response",
      status: 409,
    };
  }

  let boundary: Message | undefined;
  for (let index = searchEnd; index > chainIndex; index -= 1) {
    const candidate = chain[index];
    const role = candidate ? messageRole(candidate) : undefined;
    if (
      candidate &&
      messageId(candidate) &&
      (role === "user" || role === "assistant")
    ) {
      boundary = candidate;
      break;
    }
  }
  const retainedThroughMessageId = messageId(boundary);
  if (!boundary || !retainedThroughMessageId) {
    return { error: "Completed turn boundary has no message id", status: 409 };
  }

  const placementAfterMessageId =
    [...messages].reverse().map(messageId).find(Boolean) ??
    retainedThroughMessageId;
  const rendered = renderRestartContent(messageContent(boundary)).trim();
  const providerBoundary = providerName
    ? providerForkBoundaryForMessage(providerName, boundary)
    : undefined;
  if (
    providerName &&
    (isClaudeSdkProviderName(providerName) ||
      isCodexProviderName(providerName) ||
      providerName === "pi") &&
    !providerBoundary
  ) {
    return {
      error:
        "The selected completed turn cannot be addressed safely. No new session was created and the source is unchanged.",
      status: 409,
    };
  }
  return {
    placementAfterMessageId,
    retainedThroughMessageId,
    retainedThroughContext: rendered
      ? truncateForRestart(rendered, 1200)
      : undefined,
    ...(providerBoundary ? { providerBoundary } : {}),
  };
}

/**
 * The rows on a source turn's own provider chain. A cleared span is a dead
 * branch: a live turn neither continues from nor is answered by its rows,
 * while a cleared turn's chain is its own span, the spans enclosing it, and
 * the live prefix before them (topics/session-rewind.md § Vocabulary).
 */
function sourceChainMessages(messages: Message[], source: Message): Message[] {
  const groupOf = (message: Message): string | undefined =>
    typeof message.rewoundGroupId === "string"
      ? message.rewoundGroupId
      : undefined;
  const enclosingGroup = new Map<string, string>();
  for (const message of messages) {
    const group = groupOf(message);
    const parent = message.rewoundParentGroupId;
    if (group && typeof parent === "string") enclosingGroup.set(group, parent);
  }
  const chainGroups = new Set<string>();
  for (
    let group = groupOf(source);
    group && !chainGroups.has(group);
    group = enclosingGroup.get(group)
  ) {
    chainGroups.add(group);
  }
  return messages.filter((message) => {
    const group = groupOf(message);
    return !group || chainGroups.has(group);
  });
}

/**
 * The turn a "before this turn" cut keeps: the previous real turn on the
 * source's chain, which is turn N−1 only when no clear dropped the turns
 * between.
 */
export function precedingChainTurn(
  messages: Message[],
  source: Message,
): Message | undefined {
  const chain = sourceChainMessages(messages, source);
  for (let index = chain.indexOf(source) - 1; index >= 0; index -= 1) {
    const candidate = chain[index];
    if (candidate && messageId(candidate) && isRealUserTurn(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function resolveForkBeforeBoundary(
  messages: Message[],
  sourceMessageId: string,
  providerName: ProviderName,
): ReturnType<typeof resolveForkAfterBoundary> {
  const sourceMessage = messages.find(
    (message) => messageId(message) === sourceMessageId,
  );
  if (!sourceMessage) {
    return { error: "Selected source message was not found", status: 404 };
  }
  if (!isRealUserTurn(sourceMessage)) {
    return {
      error: "sourceMessageId must identify a user-authored request",
      status: 400,
    };
  }

  const keptTurnId = messageId(precedingChainTurn(messages, sourceMessage));
  if (!keptTurnId) {
    return {
      error: "There is no completed turn before the selected request",
      status: 409,
    };
  }
  return resolveForkAfterBoundary(messages, keptTurnId, false, providerName);
}

export function forkSummaryTitleCandidate(summary: string): string | undefined {
  const firstLine = summary
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  const candidate = firstLine
    ?.replace(/^#{1,6}\s*/u, "")
    .replace(/^title:\s*/iu, "")
    .trim()
    .replace(/[.!?]+$/u, "");
  return candidate || undefined;
}

/** An existing fork/clone prefix is replaced by the new one, never stacked. */
const FORK_TITLE_PREFIX_PATTERN = /^(?:fork|clone)(?:\s+\d+)?:\s*/iu;

/**
 * Title a fork so repeated forks of one session are told apart: the first is
 * `Fork: <source>`, the next `Fork 2: <source>`. `ordinal` is the source
 * session's fork count from `nextForkOrdinal`, which counts forks created, so
 * deleting a fork does not hand its number to a later one.
 */
export function forkTitleWithOrdinal(
  base: string,
  ordinal: number,
  prefix: "Fork" | "Clone" = "Fork",
): string {
  const core = base.replace(FORK_TITLE_PREFIX_PATTERN, "").trim() || base;
  return truncateSessionTitle(
    ordinal > 1 ? `${prefix} ${ordinal}: ${core}` : `${prefix}: ${core}`,
  );
}

export function generatedRetitleCandidate(title: string): string | undefined {
  const firstLine = title
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return undefined;
  }
  const candidate = normalizeRestartTitleCandidate(
    firstLine
      .replace(/^title:\s*/iu, "")
      .replace(/^["'“”‘’]+|["'“”‘’]+$/gu, "")
      .replace(/[.!?]+$/u, "")
      .trim(),
  );
  return candidate ? truncateSessionTitle(candidate) : undefined;
}

function messageTitleCandidate(message: Message): string | undefined {
  if (
    !isHumanUserMessage(message) ||
    isRestartInternalCompactCommand(message)
  ) {
    return undefined;
  }

  const nested = message.message as { content?: unknown } | undefined;
  const content =
    renderRestartContent(nested?.content) ||
    renderRestartContent((message as { content?: unknown }).content);
  const candidate = normalizeRestartTitleCandidate(content);

  if (
    !candidate ||
    /^\[(tool_result|tool_use|thinking|image|document)\]/i.test(candidate)
  ) {
    return undefined;
  }
  return candidate;
}

function latestUserTitleCandidate(messages: Message[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }
    const candidate = messageTitleCandidate(message);
    if (candidate) {
      return candidate;
    }
  }
  return undefined;
}

function truncateRestartTitle(title: string): string {
  return truncateSessionTitle(title);
}

export function deriveRestartTitle(params: {
  preferredTitle?: string | null;
  sourceSession: Session;
}): string {
  const candidates = [
    params.preferredTitle,
    params.sourceSession.customTitle,
    params.sourceSession.title,
    latestUserTitleCandidate(params.sourceSession.messages),
  ];
  const base =
    candidates.map(normalizeRestartTitleCandidate).find(Boolean) ??
    "restarted session";
  const title = /^Handoff:/i.test(base) ? base : `Handoff: ${base}`;
  return truncateRestartTitle(title);
}

export function deriveForkTitle(params: {
  preferredTitle?: string | null;
  sourceSession: Session;
  ordinal: number;
}): string {
  const candidates = [
    params.preferredTitle,
    params.sourceSession.customTitle,
    params.sourceSession.title,
    latestUserTitleCandidate(params.sourceSession.messages),
  ];
  const base =
    candidates.map(normalizeRestartTitleCandidate).find(Boolean) ??
    "forked session";
  return forkTitleWithOrdinal(base, params.ordinal);
}

export function buildRestartHandoff(params: {
  handoffTitle: string;
  sourceSession: Session;
  sourceProvider?: ProviderName;
  sourceModel?: string;
  sourceProcess?: Process;
  sourceUrl?: string;
  sourceTranscriptPath?: string;
  sourceTranscriptHost?: string;
  targetExecutor?: string;
  projectPath: string;
  omittedCount: number;
  transcript: string;
  /**
   * Why the successor exists. A restart continues the source's work; a
   * cold-session redirect carries a new user message that may be unrelated
   * to it (topics/limited-users.md § Freshness).
   */
  purpose?: "restart" | "cold-session";
}): string {
  const {
    handoffTitle,
    sourceSession,
    sourceProvider,
    sourceModel,
    sourceProcess,
    sourceUrl,
    sourceTranscriptPath,
    sourceTranscriptHost,
    targetExecutor,
    projectPath,
    omittedCount,
    transcript,
  } = params;
  const urlLine = formatRestartSourceUrl(sourceUrl);
  const transcriptPathLine = formatRestartTranscriptPath({
    path: sourceTranscriptPath,
    host: sourceTranscriptHost,
    targetExecutor,
  });
  const sessionTurnLine = formatRestartSessionTurnHint({
    provider: sourceProvider ?? sourceSession.provider,
    sessionId: sourceSession.id,
  });
  const transcriptBlock = [
    omittedCount > 0
      ? `_${omittedCount} older rendered messages were omitted to keep this handoff bounded._`
      : undefined,
    transcript || "[No textual transcript was available.]",
  ]
    .filter((part): part is string => part !== undefined)
    .join("\n\n");
  const queuedMessages = getRestartQueuedMessages(sourceProcess);
  const queuedSection =
    queuedMessages.length > 0
      ? [
          "## Queued User Turns (Not Yet Processed)",
          "",
          "These user turns were accepted by VIBEALLDAY's deferred queue after the source transcript. No agent response in the source session has processed them yet.",
          "",
          queuedMessages.map(formatRestartQueuedMessage).join("\n\n"),
        ].join("\n")
      : undefined;

  const intro =
    params.purpose === "cold-session"
      ? [
          "VibeAllDay is starting this as a fresh agent session because the user sent a new message to an earlier session that had been idle too long to resume cheaply.",
          "The user's new message is at the end, under **New Message**. It may be a new, independent request: answer it on its own terms, and use the earlier session below only when the message refers to something it explains. Do not resume or repeat the earlier session's work unless the new message asks for that.",
        ]
      : [
          "VibeAllDay is starting this as a fresh agent session because the previous process became unhealthy or was manually restarted.",
          "Treat the transcript below as context, not as a new request to repeat. Prefer any provider-native compact summary when present, then use the recent user turns and summarized activity to continue the user's latest unresolved work after checking the live repository state.",
        ];

  return [
    `# ${handoffTitle}`,
    "",
    ...intro,
    "",
    "## Source Session",
    "",
    `- Session ID: ${sourceSession.id}`,
    urlLine,
    `- Project path: ${projectPath}`,
    `- Provider: ${sourceProvider ?? sourceSession.provider}`,
    `- Model: ${sourceModel ?? sourceSession.model ?? "unknown"}`,
    transcriptPathLine,
    sessionTurnLine,
    "",
    transcriptBlock,
    queuedSection,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

// Keep the resumable source URL to one http(s) token so it cannot inject lines.
function formatRestartSourceUrl(url: string | undefined): string | undefined {
  const trimmed = (url ?? "").trim().split(/\s/)[0] ?? "";
  if (!/^https?:\/\//i.test(trimmed)) {
    return undefined;
  }
  return `- URL: ${compactRestartLine(trimmed, 400)}`;
}

function formatRestartTranscriptPath(params: {
  path: string | undefined;
  host?: string;
  targetExecutor?: string;
}): string | undefined {
  const trimmed = (params.path ?? "").trim().split(/[\r\n]/)[0] ?? "";
  if (!trimmed) {
    return undefined;
  }
  const host = compactRestartLine(
    params.host?.trim() || "VIBEALLDAY server",
    160,
  );
  const executorNote = params.targetExecutor
    ? `; successor executor: ${compactRestartLine(params.targetExecutor, 160)}`
    : "";
  return `- Full transcript on ${host}${executorNote} (read or grep there for detail beyond this summary): ${compactRestartLine(
    trimmed,
    400,
  )}`;
}

// A claude/codex source session can answer one more turn in place through the
// optional session-turn helper (VIBEALLDAY provider-host protocol; the incumbent
// worker keeps ownership, so no second writer or transcript fork). Offer that
// alongside the transcript path; other providers have no helper harness.
function formatRestartSessionTurnHint(params: {
  provider: string | undefined;
  sessionId: string;
}): string | undefined {
  const harness = agentHarness(params.provider ?? "");
  if (harness !== "claude" && harness !== "codex") {
    return undefined;
  }
  return `- Ask the source session itself (non-forking; needs the optional session-turn helper on PATH): echo '<question>' | session-turn ${harness} ${compactRestartLine(params.sessionId, 200)}`;
}

export function isRestartReplacementActivity(message: SDKMessage): boolean {
  return message.type === "assistant";
}

/**
 * Convert SDK messages to client Message format.
 * Used for mock SDK sessions where messages aren't persisted to disk.
 */
export function sdkMessagesToClientMessages(
  sdkMessages: SDKMessage[],
): Message[] {
  const messages: Message[] = [];
  for (const msg of sdkMessages) {
    const rawFields = msg as Record<string, unknown>;
    if (isCompactBoundaryMessage(msg)) {
      const content =
        (typeof msg.message?.content === "string"
          ? msg.message.content
          : undefined) ??
        (typeof msg.content === "string" ? msg.content : "Context compacted");
      messages.push({
        ...rawFields,
        id: msg.uuid ?? `msg-${Date.now()}-${messages.length}`,
        type: "system",
        role: "system",
        subtype: "compact_boundary",
        content,
        message: { role: "system", content },
        timestamp:
          typeof msg.timestamp === "string" && msg.timestamp.trim().length > 0
            ? msg.timestamp
            : new Date().toISOString(),
      });
      continue;
    }

    // Only include user and assistant messages with content
    if (
      (msg.type === "user" || msg.type === "assistant") &&
      msg.message?.content
    ) {
      const rawContent = msg.message.content;
      // Both user and assistant messages can have string or array content.
      // User messages with tool_result blocks have array content that must be preserved.
      // Assistant messages need ContentBlock[] for transcript projection.
      let content: string | ContentBlock[];
      if (typeof rawContent === "string") {
        // String content: keep as-is for user messages, wrap in text block for assistant
        content =
          msg.type === "user"
            ? rawContent
            : [{ type: "text" as const, text: rawContent }];
      } else if (Array.isArray(rawContent)) {
        // Array content: pass through as ContentBlock[] for both user and assistant
        content = rawContent as ContentBlock[];
      } else {
        // Unknown content type - skip this message
        continue;
      }

      messages.push({
        ...rawFields,
        id: msg.uuid ?? `msg-${Date.now()}-${messages.length}`,
        type: msg.type,
        role: msg.type as "user" | "assistant",
        content,
        timestamp:
          typeof msg.timestamp === "string" && msg.timestamp.trim().length > 0
            ? msg.timestamp
            : new Date().toISOString(),
      });
    }
  }
  return collapseMessageSnapshots(messages);
}

/**
 * Extract context usage from SDK messages.
 * Finds the last assistant message with usage data.
 *
 * @param sdkMessages - SDK messages to search
 * @param model - Model ID for determining context window size
 * @param provider - Provider for model-less context-window fallback
 */
export function extractContextUsageFromSDKMessages(
  sdkMessages: SDKMessage[],
  model: string | undefined,
  provider?: ProviderName,
  resolveContextWindow?: (
    model: string | undefined,
    provider?: ProviderName,
  ) => number,
): ContextUsage | undefined {
  const contextWindowSize = resolveContextWindow
    ? resolveContextWindow(model, provider)
    : getModelContextWindow(model, provider);

  const isCodexProvider = provider === "codex" || provider === "codex-oss";

  // Find the last assistant message with usage data (iterate backwards)
  for (let i = sdkMessages.length - 1; i >= 0; i--) {
    const msg = sdkMessages[i];
    if (msg && msg.type === "assistant" && msg.usage) {
      const usage = msg.usage as {
        input_tokens?: number;
        output_tokens?: number;
        cached_input_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };

      // Codex context meter is based on fresh input tokens from the latest turn.
      // Claude/OpenCode/Gemini paths continue to include cached+creation tokens.
      const rawInputTokens = isCodexProvider
        ? (usage.input_tokens ?? 0)
        : (usage.input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0);

      // Skip messages with zero input tokens (incomplete streaming messages)
      if (rawInputTokens === 0) {
        continue;
      }

      const percentage = Math.round((rawInputTokens / contextWindowSize) * 100);

      const result: ContextUsage = {
        inputTokens: rawInputTokens,
        percentage,
        contextWindow: contextWindowSize,
      };

      // Add optional fields if available
      if (usage.output_tokens !== undefined && usage.output_tokens > 0) {
        result.outputTokens = usage.output_tokens;
      }
      if (isCodexProvider) {
        if (
          usage.cached_input_tokens !== undefined &&
          usage.cached_input_tokens > 0
        ) {
          result.cacheReadTokens = usage.cached_input_tokens;
        }
      } else if (
        usage.cache_read_input_tokens !== undefined &&
        usage.cache_read_input_tokens > 0
      ) {
        result.cacheReadTokens = usage.cache_read_input_tokens;
      }
      if (
        usage.cache_creation_input_tokens !== undefined &&
        usage.cache_creation_input_tokens > 0
      ) {
        result.cacheCreationTokens = usage.cache_creation_input_tokens;
      }

      return result;
    }
  }
  return undefined;
}

export type PersistLaunchMetadataFn = (
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
) => Promise<void>;

export type LoadRestartSourceSessionFn = (
  project: Project,
  sessionId: string,
  projectId: UrlProjectId,
  preferredProvider?: ProviderName,
  process?: Process,
) => Promise<Session | null>;
