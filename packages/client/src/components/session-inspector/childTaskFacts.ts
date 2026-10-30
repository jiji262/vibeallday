import type { AppContentBlock } from "@vibeallday/shared";
import type { AgentSession, Message } from "../../types";
import type { StatusState } from "../garden";

/** Child agent status as the design's status shape and colour. */
export const CHILD_STATUS: Record<AgentSession["status"], StatusState> = {
  pending: "queued",
  running: "run",
  completed: "ok",
  failed: "err",
};

export const CHILD_STATUS_LABEL = {
  pending: "providerChildStatusPending",
  running: "providerChildStatusRunning",
  completed: "providerChildStatusCompleted",
  failed: "providerChildStatusFailed",
} as const;

function blocksOf(message: Message): string | readonly AppContentBlock[] {
  return message.message?.content ?? message.content ?? [];
}

function textOf(content: string | readonly AppContentBlock[]): string {
  if (typeof content === "string") return content.trim();
  return content
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .join("\n")
    .trim();
}

function isUser(message: Message): boolean {
  return message.type === "user" || message.message?.role === "user";
}

/**
 * The task the parent handed over: the child's first user message, which
 * providers record as the prompt they launched it with. Undefined when the
 * transcript has no such text.
 */
export function childTaskPrompt(
  messages: readonly Message[],
): string | undefined {
  const first = messages.find(isUser);
  const text = first ? textOf(blocksOf(first)) : "";
  return text || undefined;
}

/** Tool calls the child made, counted from its own transcript. */
export function countChildToolCalls(messages: readonly Message[]): number {
  let count = 0;
  for (const message of messages) {
    const content = blocksOf(message);
    if (typeof content === "string") continue;
    for (const block of content) {
      if (block.type === "tool_use") count += 1;
    }
  }
  return count;
}
