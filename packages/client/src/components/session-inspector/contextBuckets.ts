import type { ContextBreakdown } from "@vibeallday/shared";

/** The inspector's three-way split of what fills the context window. */
export interface ContextBuckets {
  system: number;
  files: number;
  conversation: number;
  total: number;
  max: number;
  autoCompactAt?: number;
}

const PERCENT = 100;

/**
 * Bucket a provider breakdown into system (prompt, tool and agent
 * definitions, skills), files (memory files plus tool calls and results) and
 * conversation (the remaining message text). Free, buffer and deferred rows
 * do not occupy the window and are left out.
 */
export function bucketContext(breakdown: ContextBreakdown): ContextBuckets {
  let system = 0;
  let files = 0;
  let conversation = 0;
  for (const category of breakdown.categories) {
    if (category.kind !== "used") continue;
    if (category.key === "memoryFiles") {
      files += category.tokens;
    } else if (category.key === "messages") {
      const parts = category.messageParts;
      const toolTokens = parts
        ? Math.min(
            category.tokens,
            parts.toolCallTokens + parts.toolResultTokens,
          )
        : 0;
      files += toolTokens;
      conversation += category.tokens - toolTokens;
    } else {
      system += category.tokens;
    }
  }
  return {
    system,
    files,
    conversation,
    total: breakdown.totalTokens,
    max: breakdown.maxTokens,
    autoCompactAt: breakdown.autoCompactAtTokens,
  };
}

/** Whole-number share of the window; 0 when the window size is unknown. */
export function percentOf(tokens: number, max: number): number {
  if (!(max > 0) || !(tokens > 0)) return 0;
  return Math.min(PERCENT, Math.round((tokens / max) * PERCENT));
}
