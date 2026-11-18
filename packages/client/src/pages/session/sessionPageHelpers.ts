import {
  isClaudeProviderName,
  type ProjectQueueItemSummary,
  type ProviderName,
} from "@vibeallday/shared";
import type { SessionLoadProgress } from "../../hooks/useSessionMessages";
import type { useI18n } from "../../i18n";
import type { GeneratedRetitleInsertion } from "../../lib/sessionTitleHelpers";
import type { Message } from "../../types";

export const CLAUDE_HANDOFF_REQUIRED_MESSAGE =
  "Claude session cannot be safely resumed because the Claude SDK recorded an API-error response as the latest assistant message. Start a handoff session instead.";
export const EMPTY_PROJECT_QUEUE_PROJECT_IDS: readonly string[] = [];
export const EMPTY_PROJECT_QUEUE_ITEMS: readonly ProjectQueueItemSummary[] = [];

export const SESSION_LOADING_PROGRESS_DETAILS_DELAY_MS = 1500;
export const SESSION_TITLE_SKELETON_WIDTH = 160;
export const SESSION_TITLE_SKELETON_HEIGHT = 16;

export type TitleEditMode = "manual" | "retitle";

export interface GeneratedRetitleState {
  requestId: number;
  status: "generating" | "ready" | "error";
  submittedTurnText: string;
  title?: string;
  error?: string;
  deferredInsertion?: GeneratedRetitleInsertion;
}

export interface SessionPageRouteLocation {
  pathname: string;
  search: string;
  state: unknown;
  /** Router history entry id; distinguishes repeat navigations to one path. */
  key?: string;
}

export interface SessionPageProps {
  projectId?: string;
  sessionId?: string;
  routeLocation?: SessionPageRouteLocation;
  isDomLingerParked?: boolean;
  progressiveRenderPauseSignal?: {
    readonly current: boolean;
    supportsCompaction?: boolean;
  };
}

export function messageKey(message: Message | undefined): string | undefined {
  return message?.uuid ?? message?.id;
}

export function isMissingDeferredQueueEntryError(error: unknown): boolean {
  if ((error as { status?: number } | null)?.status === 404) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("No active process") ||
    message.includes("Deferred message not found")
  );
}

export function requiresHandoffAfterClaudeResumeError(
  error: unknown,
  provider: ProviderName | undefined,
): boolean {
  if ((error as { status?: number } | null)?.status !== 409) {
    return false;
  }
  if (!isClaudeProviderName(provider)) {
    return false;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Start a handoff session") ||
    message.includes("API error: 409")
  );
}

export function parsePositiveIntegerParam(
  value: string | null,
): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function getSessionLoadingProgressText(
  progress: SessionLoadProgress,
  t: ReturnType<typeof useI18n>["t"],
): string | null {
  switch (progress.stage) {
    case "fetching":
      return null;
    case "rendering":
      return t("sessionLoadingRenderingTranscript", {
        count: progress.messageCount ?? 0,
      });
    case "idle":
    case "complete":
    case "error":
      return null;
  }
}
