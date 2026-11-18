import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ContextUsage } from "@vibeallday/shared";
import { canonicalizeProjectPath } from "../../projects/paths.js";

/** Grok Build default context window when `models_cache.json` has no entry. */
export const GROK_DEFAULT_CONTEXT_WINDOW = 512_000;

/**
 * Disjoint token counters attached to Grok `type: "result"` SDK messages.
 *
 * Matches VIBEALLDAY's `cachedReadsInInput: false` convention (`opencode`, `pi`):
 * `input_tokens` is fresh (non-cached) input, `cache_read_input_tokens` is
 * cached prompt reads, and `output_tokens` is total billed output (including
 * reasoning tokens).
 *
 * xAI publishes no separate cache-write rate (`VENDORED_MODEL_PRICES.xai` has
 * `cacheWrite: 0`); pre-1.0 Grok included cache writes inside `inputTokens`,
 * while Grok 1.0's `usage.json` ledger splits `cacheCreationTokens` out. We
 * fold `cacheCreationTokens` into `input_tokens` (leaving
 * `cache_creation_input_tokens: 0`), matching `vibe-usage/src/parsers/grok.js`
 * (`ledgerRecordUsage`).
 */
export interface GrokNormalizedUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

interface RawGrokUsageSnapshot {
  freshInputTokens: number;
  cachedReadTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  promptTokens: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonNegativeInt(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
}

function snapshotFromSingleEntry(
  entry: Record<string, unknown>,
): RawGrokUsageSnapshot {
  const input = nonNegativeInt(entry.inputTokens);
  const cachedRead = nonNegativeInt(entry.cachedReadTokens);
  const cacheCreation = nonNegativeInt(entry.cacheCreationTokens);
  const output = nonNegativeInt(entry.outputTokens);
  const reasoning = nonNegativeInt(entry.reasoningTokens);

  const totalPrompt = Math.max(input + cacheCreation, cachedRead);
  const freshInputTokens = Math.max(0, totalPrompt - cachedRead);
  const outputTokens = Math.max(output, reasoning);

  return {
    freshInputTokens,
    cachedReadTokens: cachedRead,
    cacheCreationTokens: cacheCreation,
    outputTokens,
    promptTokens: totalPrompt,
  };
}

function parseRawGrokUsageSnapshot(
  raw: unknown,
): RawGrokUsageSnapshot | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;

  const modelUsage = asRecord(record.modelUsage);
  const modelEntries = modelUsage
    ? Object.values(modelUsage)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null)
    : [];

  const snapshots =
    modelEntries.length > 0
      ? modelEntries.map((entry) => snapshotFromSingleEntry(entry))
      : [snapshotFromSingleEntry(record)];

  const combined: RawGrokUsageSnapshot = {
    freshInputTokens: 0,
    cachedReadTokens: 0,
    cacheCreationTokens: 0,
    outputTokens: 0,
    promptTokens: 0,
  };

  for (const item of snapshots) {
    combined.freshInputTokens += item.freshInputTokens;
    combined.cachedReadTokens += item.cachedReadTokens;
    combined.cacheCreationTokens += item.cacheCreationTokens;
    combined.outputTokens += item.outputTokens;
    combined.promptTokens += item.promptTokens;
  }

  if (combined.promptTokens === 0 && combined.outputTokens === 0) {
    return undefined;
  }
  return combined;
}

export function addGrokNormalizedUsage(
  left: GrokNormalizedUsage | undefined,
  right: GrokNormalizedUsage | undefined,
): GrokNormalizedUsage | undefined {
  if (!left) return right;
  if (!right) return left;
  return {
    input_tokens: left.input_tokens + right.input_tokens,
    output_tokens: left.output_tokens + right.output_tokens,
    cache_read_input_tokens:
      left.cache_read_input_tokens + right.cache_read_input_tokens,
    cache_creation_input_tokens:
      left.cache_creation_input_tokens + right.cache_creation_input_tokens,
  };
}

/**
 * Normalize a Grok usage record (`turn_completed.usage` or `usage.json` entry)
 * into VIBEALLDAY's disjoint `result.usage` counters.
 */
export function normalizeGrokRawUsage(
  raw: unknown,
): GrokNormalizedUsage | undefined {
  const snapshot = parseRawGrokUsageSnapshot(raw);
  if (!snapshot) return undefined;
  return {
    input_tokens: snapshot.freshInputTokens,
    output_tokens: snapshot.outputTokens,
    cache_read_input_tokens: snapshot.cachedReadTokens,
    cache_creation_input_tokens: 0,
  };
}

/**
 * Extract per-turn usage from a Grok 0.2.x `turn_completed` ACP session update,
 * when inline `usage` is present.
 */
export function extractGrokTurnUsageFromUpdate(
  update: unknown,
): GrokNormalizedUsage | undefined {
  const record = asRecord(update);
  if (record?.sessionUpdate !== "turn_completed") return undefined;
  return normalizeGrokRawUsage(record.usage);
}

/**
 * Resolve the on-disk Grok session directory `<grokHome>/sessions/<encoded-cwd>/<sessionId>`.
 */
export function resolveGrokSessionDir(
  grokHome: string,
  cwd: string,
  sessionId: string,
): string {
  const sessionsRoot = join(grokHome, "sessions");
  const direct = join(sessionsRoot, encodeURIComponent(cwd), sessionId);
  if (existsSync(direct)) return direct;

  const canonical = canonicalizeProjectPath(cwd);
  if (canonical !== cwd) {
    const canonicalDir = join(
      sessionsRoot,
      encodeURIComponent(canonical),
      sessionId,
    );
    if (existsSync(canonicalDir)) return canonicalDir;
  }
  return direct;
}

interface GrokUsageLedger {
  session: Record<string, unknown> | null;
  turns: Record<string, unknown>[];
}

function readGrokUsageLedger(sessionDir: string): GrokUsageLedger | null {
  const ledgerPath = join(sessionDir, "usage.json");
  if (!existsSync(ledgerPath)) return null;
  try {
    const parsed = asRecord(JSON.parse(readFileSync(ledgerPath, "utf-8")));
    if (!parsed) return null;
    const turns = Array.isArray(parsed.turns)
      ? parsed.turns
          .map((item) => asRecord(item))
          .filter((item): item is Record<string, unknown> => item !== null)
      : [];
    const session = asRecord(parsed.session);
    if (turns.length === 0 && !session) return null;
    return { session, turns };
  } catch {
    return null;
  }
}

/**
 * Current number of recorded turns in Grok 1.0+'s `<sessionDir>/usage.json`
 * ledger, used as a pre-prompt watermark so a live `session/prompt` turn bills
 * only the newly appended turn(s).
 */
export function readGrokLedgerTurnCount(sessionDir: string): number {
  return readGrokUsageLedger(sessionDir)?.turns.length ?? 0;
}

/**
 * Read usage appended to `<sessionDir>/usage.json` since `previousTurnCount`.
 * Consulted by `GrokACPProvider` when Grok 1.0+ omits inline `usage` from ACP
 * `turn_completed` updates.
 */
export function readGrokLedgerUsageSince(
  sessionDir: string,
  previousTurnCount: number,
): GrokNormalizedUsage | undefined {
  const ledger = readGrokUsageLedger(sessionDir);
  if (!ledger) return undefined;

  const start = Math.max(0, previousTurnCount);
  const newTurns =
    ledger.turns.length > start
      ? ledger.turns.slice(start)
      : start === 0 && ledger.turns.length === 0 && ledger.session
        ? [ledger.session]
        : [];

  let total: GrokNormalizedUsage | undefined;
  for (const turn of newTurns) {
    total = addGrokNormalizedUsage(total, normalizeGrokRawUsage(turn));
  }
  return total;
}

function lookupGrokCachedContextWindow(
  grokHome: string | undefined,
  model: string | undefined,
): number | undefined {
  if (!grokHome || !model) return undefined;
  try {
    const raw = asRecord(
      JSON.parse(readFileSync(join(grokHome, "models_cache.json"), "utf-8")),
    );
    const models = raw?.models;
    const entries: Array<[string | undefined, unknown]> = Array.isArray(models)
      ? models.map((item) => [undefined, item])
      : Object.entries(asRecord(models) ?? {});
    for (const [key, item] of entries) {
      const wrapper = asRecord(item);
      const info = asRecord(wrapper?.info) ?? wrapper;
      const id =
        (typeof info?.id === "string" && info.id.trim()) ||
        (typeof info?.model === "string" && info.model.trim()) ||
        key;
      if (id !== model) continue;
      const cw = info?.context_window;
      if (typeof cw === "number" && Number.isFinite(cw) && cw > 0) {
        return cw;
      }
    }
  } catch {
    // ignore missing or malformed models_cache.json
  }
  return undefined;
}

function findLastUpdatesSnapshot(
  rawUpdates: string | undefined,
): RawGrokUsageSnapshot | undefined {
  if (!rawUpdates) return undefined;
  const lines = rawUpdates.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (!line) continue;
    try {
      const parsed = asRecord(JSON.parse(line));
      const params = asRecord(parsed?.params);
      const update = asRecord(params?.update);
      if (update?.sessionUpdate !== "turn_completed") continue;
      const snapshot = parseRawGrokUsageSnapshot(update.usage);
      if (snapshot) return snapshot;
    } catch {
      // ignore malformed line
    }
  }
  return undefined;
}

/**
 * Derive `ContextUsage` for a Grok session from Grok 1.0+'s `usage.json`
 * ledger (latest turn) or Grok 0.2.x's `updates.jsonl` (`turn_completed.usage`).
 */
export function extractGrokSessionContextUsage(options: {
  sessionDir: string;
  rawUpdates?: string;
  model?: string;
  grokHome?: string;
}): ContextUsage | undefined {
  const ledger = readGrokUsageLedger(options.sessionDir);
  const lastLedgerRecord =
    ledger && ledger.turns.length > 0
      ? ledger.turns[ledger.turns.length - 1]
      : ledger?.session;

  const snapshot =
    (lastLedgerRecord
      ? parseRawGrokUsageSnapshot(lastLedgerRecord)
      : undefined) ?? findLastUpdatesSnapshot(options.rawUpdates);
  if (!snapshot || snapshot.promptTokens <= 0) return undefined;

  const inferredGrokHome =
    options.grokHome ?? dirname(dirname(dirname(options.sessionDir)));
  const contextWindow =
    lookupGrokCachedContextWindow(inferredGrokHome, options.model) ??
    GROK_DEFAULT_CONTEXT_WINDOW;

  const result: ContextUsage = {
    inputTokens: snapshot.promptTokens,
    percentage: Math.round((snapshot.promptTokens / contextWindow) * 100),
    contextWindow,
  };
  if (snapshot.outputTokens > 0) {
    result.outputTokens = snapshot.outputTokens;
  }
  if (snapshot.cachedReadTokens > 0) {
    result.cacheReadTokens = snapshot.cachedReadTokens;
  }
  if (snapshot.cacheCreationTokens > 0) {
    result.cacheCreationTokens = snapshot.cacheCreationTokens;
  }
  return result;
}
