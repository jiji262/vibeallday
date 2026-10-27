import type { Message } from "../types";
import type { RenderItem } from "@vibeallday/shared/transcript/items";
import { getCachedTranscriptProjection } from "./transcriptProjection/cache";
import { compileTranscriptProjection } from "@vibeallday/shared/transcript/compiler";
import type { MessageProjectionDiagnostics } from "@vibeallday/shared/transcript/messageProjection";
import type { TranscriptProjectionAugments } from "@vibeallday/shared/transcript/types";
import { applyRecentProjectPathLinks } from "./recentProjectPathLinks";

const webProjectionDiagnostics: MessageProjectionDiagnostics = {
  onAssistantMessage(details) {
    // Preserve the historical debug label across the structural refactor.
    console.log("[preprocessMessages] Processing assistant message:", details);
  },
};

function compileWebTranscriptProjectionBase(
  messages: Message[],
  augments?: TranscriptProjectionAugments,
): RenderItem[] {
  const diagnostics =
    typeof window !== "undefined" && window.__STREAMING_DEBUG__
      ? webProjectionDiagnostics
      : undefined;
  return compileTranscriptProjection(messages, augments, diagnostics);
}

function compileWebTranscriptProjectionWithRecentLinks(
  messages: Message[],
  augments?: TranscriptProjectionAugments,
): RenderItem[] {
  return applyRecentProjectPathLinks(
    compileWebTranscriptProjectionBase(messages, augments),
  );
}

export function compileWebTranscriptProjection(
  messages: Message[],
  augments?: TranscriptProjectionAugments,
  recentProjectPathLinksEnabled = false,
): RenderItem[] {
  return recentProjectPathLinksEnabled
    ? compileWebTranscriptProjectionWithRecentLinks(messages, augments)
    : compileWebTranscriptProjectionBase(messages, augments);
}

export function getCachedWebTranscriptProjection(
  messages: Message[],
  augments?: TranscriptProjectionAugments,
  recentProjectPathLinksEnabled = false,
): RenderItem[] {
  return getCachedTranscriptProjection(
    messages,
    augments,
    recentProjectPathLinksEnabled
      ? compileWebTranscriptProjectionWithRecentLinks
      : compileWebTranscriptProjectionBase,
  );
}
