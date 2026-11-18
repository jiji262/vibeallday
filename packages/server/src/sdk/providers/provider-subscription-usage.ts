import {
  closeSync,
  existsSync,
  fstatSync,
  openSync,
  readFileSync,
  readSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ModelInfo,
  ProviderSubscriptionUsage,
  ProviderSubscriptionUsageScope,
  ProviderSubscriptionUsageWindow,
} from "@vibeallday/shared";
import { resolveGrokHome } from "../../projects/paths.js";

type UnknownRecord = Record<string, unknown>;

interface SqliteReadStatement {
  get(...params: unknown[]): unknown;
}
interface SqliteReadDatabase {
  prepare(sql: string): SqliteReadStatement;
  close(): void;
}
type SqliteReadCtor = new (
  path: string,
  options?: { readOnly?: boolean },
) => SqliteReadDatabase;

const nodeRequire = createRequire(import.meta.url);
let cachedSqliteCtor: SqliteReadCtor | null | undefined;

function getSqliteReadCtor(): SqliteReadCtor | null {
  if (cachedSqliteCtor === undefined) {
    try {
      cachedSqliteCtor =
        (nodeRequire("node:sqlite") as { DatabaseSync?: SqliteReadCtor })
          .DatabaseSync ?? null;
    } catch {
      cachedSqliteCtor = null;
    }
  }
  return cachedSqliteCtor;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function usedPercent(value: unknown): number | null {
  const number = finiteNumber(value);
  return number === null ? null : Math.min(100, Math.max(0, number));
}

function positiveMinutes(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? Math.round(number) : undefined;
}

function isoTimestamp(value: unknown): string | undefined {
  const text = nonEmptyString(value);
  if (!text) return undefined;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : undefined;
}

function unixTimestamp(value: unknown): string | undefined {
  const seconds = finiteNumber(value);
  if (seconds === null || seconds <= 0) return undefined;
  const timestamp = seconds * 1000;
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : undefined;
}

function normalizedModelLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function modelFamilyMatches(model: ModelInfo, family: string): boolean {
  const id = model.id.toLowerCase();
  const name = model.name.toLowerCase();
  const tokenPattern = new RegExp(`(?:^|[^a-z0-9])${family}(?:[^a-z0-9]|$)`);
  if (tokenPattern.test(id) || tokenPattern.test(name)) return true;
  if (model.id === "opusplan") {
    return family === "opus" || family === "sonnet";
  }
  return false;
}

function modelIdsForFamily(
  models: readonly ModelInfo[],
  family: string,
): string[] {
  return models
    .filter((model) => modelFamilyMatches(model, family))
    .map((model) => model.id);
}

function resolveModelBucket(
  label: string,
  models: readonly ModelInfo[],
): string[] {
  const normalizedLabel = normalizedModelLabel(label);
  const exact = models
    .filter(
      (model) =>
        normalizedModelLabel(model.id) === normalizedLabel ||
        normalizedModelLabel(model.name) === normalizedLabel,
    )
    .map((model) => model.id);
  if (exact.length > 0) return exact;

  const lowerLabel = label.toLowerCase();
  for (const family of ["fable", "opus", "sonnet", "haiku"]) {
    if (
      new RegExp(`(?:^|[^a-z0-9])${family}(?:[^a-z0-9]|$)`).test(lowerLabel)
    ) {
      return modelIdsForFamily(models, family);
    }
  }
  return [];
}

function addWindow(
  windows: ProviderSubscriptionUsageWindow[],
  window: ProviderSubscriptionUsageWindow | null,
): void {
  if (!window) return;
  windows.push(window);
}

function claudeWindow(
  id: string,
  value: unknown,
  durationMinutes: number,
  scope: ProviderSubscriptionUsageScope,
): ProviderSubscriptionUsageWindow | null {
  const record = asRecord(value);
  const percent = usedPercent(record?.utilization);
  if (!record || percent === null) return null;
  return {
    id,
    usedPercent: percent,
    windowDurationMinutes: durationMinutes,
    resetsAt: isoTimestamp(record.resets_at),
    scope,
  };
}

export function normalizeClaudeSubscriptionUsage(
  value: unknown,
  models: readonly ModelInfo[],
  fetchedAt = new Date(),
): ProviderSubscriptionUsage | null {
  const response = asRecord(value);
  if (response?.rate_limits_available !== true) return null;
  const limits = asRecord(response.rate_limits);
  if (!limits) return null;

  const windows: ProviderSubscriptionUsageWindow[] = [];
  addWindow(
    windows,
    claudeWindow("claude:five-hour", limits.five_hour, 300, {
      type: "provider",
    }),
  );
  addWindow(
    windows,
    claudeWindow("claude:seven-day", limits.seven_day, 10_080, {
      type: "provider",
    }),
  );
  addWindow(
    windows,
    claudeWindow(
      "claude:seven-day-oauth-apps",
      limits.seven_day_oauth_apps,
      10_080,
      { type: "provider", category: "oauthApps" },
    ),
  );

  for (const [key, family] of [
    ["seven_day_opus", "opus"],
    ["seven_day_sonnet", "sonnet"],
  ] as const) {
    const modelIds = modelIdsForFamily(models, family);
    if (modelIds.length === 0) continue;
    addWindow(
      windows,
      claudeWindow(`claude:${key.replaceAll("_", "-")}`, limits[key], 10_080, {
        type: "models",
        modelIds,
        label: family[0]?.toUpperCase() + family.slice(1),
      }),
    );
  }

  if (Array.isArray(limits.model_scoped)) {
    for (const [index, entry] of limits.model_scoped.entries()) {
      const record = asRecord(entry);
      const label = nonEmptyString(record?.display_name);
      if (!record || !label) continue;
      const modelIds = resolveModelBucket(label, models);
      if (modelIds.length === 0) continue;
      addWindow(
        windows,
        claudeWindow(
          `claude:model:${normalizedModelLabel(label) || index}`,
          record,
          10_080,
          { type: "models", modelIds, label },
        ),
      );
    }
  }

  return windows.length > 0
    ? {
        provider: "claude",
        windows,
        fetchedAt: fetchedAt.toISOString(),
      }
    : null;
}

function codexWindow(
  id: string,
  value: unknown,
  scope: ProviderSubscriptionUsageScope,
): ProviderSubscriptionUsageWindow | null {
  const record = asRecord(value);
  const percent = usedPercent(record?.usedPercent);
  if (!record || percent === null) return null;
  return {
    id,
    usedPercent: percent,
    windowDurationMinutes: positiveMinutes(record.windowDurationMins),
    resetsAt: unixTimestamp(record.resetsAt),
    scope,
  };
}

export function normalizeCodexSubscriptionUsage(
  value: unknown,
  models: readonly ModelInfo[],
  fetchedAt = new Date(),
): ProviderSubscriptionUsage | null {
  const response = asRecord(value);
  if (!response) return null;

  const snapshots = new Map<
    string,
    { snapshot: UnknownRecord; fallback: boolean }
  >();
  const byLimitId = asRecord(response.rateLimitsByLimitId);
  if (byLimitId) {
    for (const [key, rawSnapshot] of Object.entries(byLimitId)) {
      const snapshot = asRecord(rawSnapshot);
      if (snapshot) snapshots.set(key, { snapshot, fallback: false });
    }
  }

  const fallback = asRecord(response.rateLimits);
  if (fallback) {
    const fallbackId = nonEmptyString(fallback.limitId) ?? "codex";
    const alreadyPresent = [...snapshots.values()].some(
      ({ snapshot }) => (nonEmptyString(snapshot.limitId) ?? "") === fallbackId,
    );
    if (!alreadyPresent) {
      snapshots.set(fallbackId, { snapshot: fallback, fallback: true });
    }
  }

  const windows: ProviderSubscriptionUsageWindow[] = [];
  for (const [mapKey, { snapshot, fallback: isFallback }] of snapshots) {
    const limitId = nonEmptyString(snapshot.limitId) ?? mapKey;
    const label = nonEmptyString(snapshot.limitName);
    const providerWide =
      limitId.toLowerCase() === "codex" ||
      (isFallback && snapshots.size === 1 && !label);
    let scope: ProviderSubscriptionUsageScope;
    if (providerWide) {
      scope = { type: "provider" };
    } else {
      if (!label) continue;
      const modelIds = resolveModelBucket(label, models);
      if (modelIds.length === 0) continue;
      scope = { type: "models", modelIds, label };
    }

    addWindow(
      windows,
      codexWindow(`codex:${limitId}:primary`, snapshot.primary, scope),
    );
    addWindow(
      windows,
      codexWindow(`codex:${limitId}:secondary`, snapshot.secondary, scope),
    );
  }

  return windows.length > 0
    ? {
        provider: "codex",
        windows,
        fetchedAt: fetchedAt.toISOString(),
      }
    : null;
}

const OPENCODE_GO_INTEGRATION_ID = "opencode-go";
const DEFAULT_OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
const OPENCODE_GO_WINDOWS = [
  ["rolling", "opencode:go:rolling", 300],
  ["weekly", "opencode:go:weekly", 10_080],
  ["monthly", "opencode:go:monthly", 43_200],
] as const;

function resolveOpenCodeGoScope(
  models: readonly ModelInfo[],
): ProviderSubscriptionUsageScope {
  const goModelIds = models
    .filter((model) => model.id.toLowerCase().startsWith("opencode-go/"))
    .map((model) => model.id);
  return goModelIds.length > 0
    ? {
        type: "models",
        modelIds: goModelIds,
        label: "OpenCode Go",
      }
    : { type: "provider" };
}

export function normalizeOpenCodeGoSubscriptionUsage(
  value: unknown,
  models: readonly ModelInfo[],
  fetchedAt = new Date(),
): ProviderSubscriptionUsage | null {
  const response = asRecord(value);
  const usage = asRecord(response?.usage);
  if (!usage) return null;

  const scope = resolveOpenCodeGoScope(models);
  const windows: ProviderSubscriptionUsageWindow[] = [];
  for (const [key, id, durationMinutes] of OPENCODE_GO_WINDOWS) {
    const item = asRecord(usage[key]);
    const percent = usedPercent(item?.percent);
    if (!item || percent === null) continue;
    const resetsAt = isoTimestamp(item.resetsAt);
    windows.push({
      id,
      usedPercent: percent,
      windowDurationMinutes: durationMinutes,
      ...(resetsAt ? { resetsAt } : {}),
      scope,
    });
  }

  return windows.length > 0
    ? {
        provider: "opencode",
        windows,
        fetchedAt: fetchedAt.toISOString(),
      }
    : null;
}

function readOpenCodeGoCredentialTableKey(dataDir: string): string | null {
  const dbPath = join(dataDir, "opencode.db");
  if (!existsSync(dbPath)) return null;
  const Ctor = getSqliteReadCtor();
  if (!Ctor) return null;

  let db: SqliteReadDatabase | null = null;
  try {
    db = new Ctor(dbPath, { readOnly: true });
    const row = db
      .prepare(
        "SELECT value FROM credential WHERE integration_id = ? ORDER BY coalesce(active, 1) DESC, time_updated DESC LIMIT 1",
      )
      .get(OPENCODE_GO_INTEGRATION_ID) as { value?: unknown } | undefined;
    const raw = nonEmptyString(row?.value);
    if (!raw) return null;
    const parsed = asRecord(JSON.parse(raw));
    return nonEmptyString(parsed?.key);
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
      // ignore
    }
  }
}

function readOpenCodeGoAuthFileKey(dataDir: string): string | null {
  try {
    const raw = readFileSync(join(dataDir, "auth.json"), "utf-8");
    const parsed = asRecord(JSON.parse(raw));
    const goEntry = asRecord(parsed?.[OPENCODE_GO_INTEGRATION_ID]);
    const openCodeEntry = asRecord(parsed?.opencode);
    return nonEmptyString(goEntry?.key) ?? nonEmptyString(openCodeEntry?.key);
  } catch {
    return null;
  }
}

export interface OpenCodeGoSubscriptionUsageOptions {
  /** Override OpenCode data directory (defaults to $XDG_DATA_HOME/opencode or ~/.local/share/opencode). */
  dataDir?: string;
  env?: NodeJS.ProcessEnv;
  home?: string;
  fetchImpl?: typeof fetch;
  usageUrl?: string;
  timeoutMs?: number;
  now?: Date;
}

/**
 * Resolve OpenCode Go's API key from `opencode.db` (`credential` table) with
 * pre-2.x `auth.json` fallback, ported from `vibe-usage/src/quotas/providers/opencode-go.js`.
 * Never logs or persists the credential.
 */
export function readOpenCodeGoApiKey(
  options: Pick<
    OpenCodeGoSubscriptionUsageOptions,
    "dataDir" | "env" | "home"
  > = {},
): string | null {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  const dataDir =
    options.dataDir ??
    join(
      env.XDG_DATA_HOME?.trim() || join(home, ".local", "share"),
      "opencode",
    );
  return (
    readOpenCodeGoCredentialTableKey(dataDir) ??
    readOpenCodeGoAuthFileKey(dataDir)
  );
}

export async function fetchOpenCodeGoSubscriptionUsage(
  models: readonly ModelInfo[],
  options: OpenCodeGoSubscriptionUsageOptions = {},
): Promise<ProviderSubscriptionUsage | null> {
  const token = readOpenCodeGoApiKey(options);
  if (!token) return null;

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const usageUrl = options.usageUrl ?? DEFAULT_OPENCODE_GO_USAGE_URL;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const now = options.now ?? new Date();

  try {
    const response = await fetchImpl(usageUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return normalizeOpenCodeGoSubscriptionUsage(payload, models, now);
  } catch {
    return null;
  }
}

const DEFAULT_GROK_LOG_TAIL_BYTES = 256 * 1024;

function readBoundedLogTail(path: string, maxBytes: number): string {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const length = Math.min(size, maxBytes);
    if (length <= 0) return "";
    const buffer = Buffer.allocUnsafe(length);
    const offset = size - length;
    let total = 0;
    while (total < length) {
      const count = readSync(fd, buffer, total, length - total, offset + total);
      if (count <= 0) break;
      total += count;
    }
    let text = buffer.subarray(0, total).toString("utf-8");
    if (offset > 0) {
      const newline = text.indexOf("\n");
      text = newline < 0 ? "" : text.slice(newline + 1);
    }
    return text;
  } finally {
    closeSync(fd);
  }
}

/**
 * Parse Grok CLI's non-secret `billing: fetched credits config` log entries
 * from `<GROK_HOME>/logs/unified.jsonl` (ported from `vibe-usage/src/quotas/providers/grok.js`).
 */
export function normalizeGrokBillingLogSubscriptionUsage(
  text: string,
  now = new Date(),
): ProviderSubscriptionUsage | null {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (!line) continue;
    let event: UnknownRecord | null = null;
    try {
      event = asRecord(JSON.parse(line));
    } catch {
      continue;
    }
    if (event?.msg !== "billing: fetched credits config") continue;
    const ctx = asRecord(event.ctx);
    const config = asRecord(ctx?.config);
    if (!config) continue;

    const percent = usedPercent(config.creditUsagePercent);
    const dataAsOf = isoTimestamp(event.ts);
    const currentPeriod = asRecord(config.currentPeriod);
    const startsAt = isoTimestamp(
      currentPeriod?.start ?? config.billingPeriodStart,
    );
    const resetsAt = isoTimestamp(
      currentPeriod?.end ?? config.billingPeriodEnd,
    );
    if (percent === null || !dataAsOf || !startsAt || !resetsAt) continue;

    const startsAtMs = Date.parse(startsAt);
    const resetsAtMs = Date.parse(resetsAt);
    const windowDurationMinutes = positiveMinutes(
      (resetsAtMs - startsAtMs) / 60_000,
    );
    if (!windowDurationMinutes) continue;

    // Expired billing periods are no longer authoritative.
    if (resetsAtMs <= now.getTime()) {
      return null;
    }

    return {
      provider: "grok",
      windows: [
        {
          id: "grok:subscription-credits",
          usedPercent: percent,
          windowDurationMinutes,
          resetsAt,
          scope: { type: "provider" },
        },
      ],
      fetchedAt: now.toISOString(),
    };
  }
  return null;
}

export interface GrokSubscriptionUsageOptions {
  grokHome?: string;
  env?: NodeJS.ProcessEnv;
  home?: string;
  now?: Date;
  maxLogBytes?: number;
}

export function readGrokSubscriptionUsage(
  options: GrokSubscriptionUsageOptions = {},
): ProviderSubscriptionUsage | null {
  const grokHome =
    options.grokHome ?? resolveGrokHome(options.env, options.home);
  const logPath = join(grokHome, "logs", "unified.jsonl");
  try {
    const tail = readBoundedLogTail(
      logPath,
      options.maxLogBytes ?? DEFAULT_GROK_LOG_TAIL_BYTES,
    );
    return normalizeGrokBillingLogSubscriptionUsage(tail, options.now);
  } catch {
    return null;
  }
}
