import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchOpenCodeGoSubscriptionUsage,
  normalizeClaudeSubscriptionUsage,
  normalizeCodexSubscriptionUsage,
  normalizeGrokBillingLogSubscriptionUsage,
  normalizeOpenCodeGoSubscriptionUsage,
  readGrokSubscriptionUsage,
  readOpenCodeGoApiKey,
} from "../../../src/sdk/providers/provider-subscription-usage.js";

const nodeRequire = createRequire(import.meta.url);
type DatabaseSyncCtor = typeof import("node:sqlite").DatabaseSync;
let DatabaseSync: DatabaseSyncCtor | undefined;
try {
  ({ DatabaseSync } = nodeRequire(
    "node:sqlite",
  ) as typeof import("node:sqlite"));
} catch {
  DatabaseSync = undefined;
}

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("provider subscription usage normalization", () => {
  it("keeps Claude account windows and resolves model-specific buckets", () => {
    const usage = normalizeClaudeSubscriptionUsage(
      {
        subscription_type: "max",
        rate_limits_available: true,
        rate_limits: {
          five_hour: {
            utilization: 0,
            resets_at: "2026-07-29T01:00:00Z",
          },
          seven_day: {
            utilization: 72,
            resets_at: "2026-08-02T00:00:00Z",
          },
          model_scoped: [
            {
              display_name: "Fable",
              utilization: 100,
              resets_at: "2026-08-03T00:00:00Z",
            },
          ],
        },
      },
      [
        { id: "fable", name: "Fable" },
        { id: "sonnet", name: "Sonnet" },
      ],
      new Date("2026-07-29T00:00:00Z"),
    );

    expect(usage).toEqual({
      provider: "claude",
      fetchedAt: "2026-07-29T00:00:00.000Z",
      windows: [
        expect.objectContaining({
          id: "claude:five-hour",
          usedPercent: 0,
          scope: { type: "provider" },
        }),
        expect.objectContaining({
          id: "claude:seven-day",
          usedPercent: 72,
          scope: { type: "provider" },
        }),
        expect.objectContaining({
          id: "claude:model:fable",
          usedPercent: 100,
          scope: {
            type: "models",
            modelIds: ["fable"],
            label: "Fable",
          },
        }),
      ],
    });
  });

  it("returns no Claude usage for API-key-style sessions", () => {
    expect(
      normalizeClaudeSubscriptionUsage(
        {
          subscription_type: null,
          rate_limits_available: false,
          rate_limits: null,
        },
        [],
      ),
    ).toBeNull();
  });

  it("maps Codex named buckets to catalog model ids", () => {
    const usage = normalizeCodexSubscriptionUsage(
      {
        rateLimits: {
          limitId: "codex",
          limitName: null,
          primary: null,
          secondary: {
            usedPercent: 15,
            windowDurationMins: 10_080,
            resetsAt: 1_775_000_000,
          },
        },
        rateLimitsByLimitId: {
          codex: {
            limitId: "codex",
            limitName: null,
            primary: null,
            secondary: {
              usedPercent: 15,
              windowDurationMins: 10_080,
              resetsAt: 1_775_000_000,
            },
          },
          codex_bengalfox: {
            limitId: "codex_bengalfox",
            limitName: "GPT-5.3-Codex-Spark",
            primary: null,
            secondary: {
              usedPercent: 100,
              windowDurationMins: 10_080,
              resetsAt: 1_775_000_000,
            },
          },
        },
      },
      [
        { id: "gpt-5.6-sol", name: "GPT-5.6-Sol" },
        { id: "gpt-5.3-codex-spark", name: "GPT-5.3-Codex-Spark" },
      ],
      new Date("2026-07-29T00:00:00Z"),
    );

    expect(usage?.windows).toEqual([
      expect.objectContaining({
        id: "codex:codex:secondary",
        usedPercent: 15,
        scope: { type: "provider" },
      }),
      expect.objectContaining({
        id: "codex:codex_bengalfox:secondary",
        usedPercent: 100,
        scope: {
          type: "models",
          modelIds: ["gpt-5.3-codex-spark"],
          label: "GPT-5.3-Codex-Spark",
        },
      }),
    ]);
  });

  it("drops unknown Codex model buckets instead of applying them globally", () => {
    const usage = normalizeCodexSubscriptionUsage(
      {
        rateLimits: {
          limitId: "unknown-model",
          limitName: "Future Model",
          primary: {
            usedPercent: 90,
            windowDurationMins: 300,
            resetsAt: null,
          },
          secondary: null,
        },
      },
      [{ id: "known", name: "Known" }],
    );

    expect(usage).toBeNull();
  });

  it("normalizes OpenCode Go rolling windows and scopes to opencode-go models", () => {
    const now = new Date("2026-09-01T12:00:00Z");
    const usage = normalizeOpenCodeGoSubscriptionUsage(
      {
        usage: {
          rolling: { percent: 25, resetsAt: "2026-09-01T13:00:00Z" },
          weekly: { percent: 60, resetsAt: "2026-09-02T12:00:00Z" },
          monthly: { percent: 80, resetsAt: "2026-09-08T12:00:00Z" },
        },
      },
      [
        { id: "opencode-go/kimi-k2.5", name: "Kimi K2.5 (Go)" },
        { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      ],
      now,
    );

    expect(usage).toEqual({
      provider: "opencode",
      fetchedAt: "2026-09-01T12:00:00.000Z",
      windows: [
        {
          id: "opencode:go:rolling",
          usedPercent: 25,
          windowDurationMinutes: 300,
          resetsAt: "2026-09-01T13:00:00.000Z",
          scope: {
            type: "models",
            modelIds: ["opencode-go/kimi-k2.5"],
            label: "OpenCode Go",
          },
        },
        {
          id: "opencode:go:weekly",
          usedPercent: 60,
          windowDurationMinutes: 10_080,
          resetsAt: "2026-09-02T12:00:00.000Z",
          scope: {
            type: "models",
            modelIds: ["opencode-go/kimi-k2.5"],
            label: "OpenCode Go",
          },
        },
        {
          id: "opencode:go:monthly",
          usedPercent: 80,
          windowDurationMinutes: 43_200,
          resetsAt: "2026-09-08T12:00:00.000Z",
          scope: {
            type: "models",
            modelIds: ["opencode-go/kimi-k2.5"],
            label: "OpenCode Go",
          },
        },
      ],
    });
  });

  it("reads OpenCode Go credential from opencode.db before auth.json and fetches usage", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "opencode-go-quota-"));
    tempDirs.push(dataDir);
    writeFileSync(
      join(dataDir, "auth.json"),
      JSON.stringify({ opencode: { key: "legacy-auth-key" } }),
    );

    if (DatabaseSync) {
      const db = new DatabaseSync(join(dataDir, "opencode.db"));
      db.exec(
        "CREATE TABLE credential (id TEXT PRIMARY KEY, integration_id TEXT, active INTEGER, time_updated INTEGER, value TEXT)",
      );
      db.prepare("INSERT INTO credential VALUES (?, ?, ?, ?, ?)").run(
        "cred_1",
        "opencode-go",
        1,
        2_000,
        JSON.stringify({ key: "sqlite-go-key" }),
      );
      db.close();
      expect(readOpenCodeGoApiKey({ dataDir })).toBe("sqlite-go-key");
    } else {
      expect(readOpenCodeGoApiKey({ dataDir })).toBe("legacy-auth-key");
    }

    const expectedKey = DatabaseSync ? "sqlite-go-key" : "legacy-auth-key";
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        expect((init?.headers as Record<string, string>)?.Authorization).toBe(
          `Bearer ${expectedKey}`,
        );
        return new Response(
          JSON.stringify({
            usage: {
              rolling: { percent: 42, resetsAt: "2026-09-01T12:30:00Z" },
            },
          }),
          { status: 200 },
        );
      },
    );

    const usage = await fetchOpenCodeGoSubscriptionUsage([], {
      dataDir,
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: new Date("2026-09-01T12:00:00Z"),
    });
    expect(usage?.windows).toEqual([
      expect.objectContaining({
        id: "opencode:go:rolling",
        usedPercent: 42,
        scope: { type: "provider" },
      }),
    ]);
  });

  it("returns null when OpenCode Go endpoint rejects non-subscriber keys", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "opencode-go-403-"));
    tempDirs.push(dataDir);
    writeFileSync(
      join(dataDir, "auth.json"),
      JSON.stringify({ opencode: { key: "zen-only-key" } }),
    );
    const fetchMock = vi.fn(
      async () => new Response("Forbidden", { status: 403 }),
    );

    await expect(
      fetchOpenCodeGoSubscriptionUsage([], {
        dataDir,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).resolves.toBeNull();
  });

  it("parses active Grok billing log windows and drops expired periods", () => {
    const grokHome = mkdtempSync(join(tmpdir(), "grok-quota-"));
    tempDirs.push(grokHome);
    mkdirSync(join(grokHome, "logs"), { recursive: true });

    const logLines = [
      JSON.stringify({
        ts: "2026-09-01T10:00:00Z",
        msg: "billing: fetched credits config",
        ctx: {
          config: {
            creditUsagePercent: 12,
            billingPeriodStart: "2026-08-01T00:00:00Z",
            billingPeriodEnd: "2026-09-01T00:00:00Z",
          },
        },
      }),
      JSON.stringify({
        ts: "2026-09-10T10:00:00Z",
        msg: "billing: fetched credits config",
        ctx: {
          config: {
            creditUsagePercent: 37.5,
            currentPeriod: {
              start: "2026-09-01T00:00:00Z",
              end: "2026-10-01T00:00:00Z",
            },
          },
        },
      }),
    ].join("\n");
    writeFileSync(join(grokHome, "logs", "unified.jsonl"), `${logLines}\n`);

    const active = readGrokSubscriptionUsage({
      grokHome,
      now: new Date("2026-09-15T00:00:00Z"),
    });
    expect(active).toEqual({
      provider: "grok",
      fetchedAt: "2026-09-15T00:00:00.000Z",
      windows: [
        {
          id: "grok:subscription-credits",
          usedPercent: 37.5,
          windowDurationMinutes: 43_200,
          resetsAt: "2026-10-01T00:00:00.000Z",
          scope: { type: "provider" },
        },
      ],
    });

    // Once past the period end, the stale log snapshot is ignored.
    expect(
      normalizeGrokBillingLogSubscriptionUsage(
        logLines,
        new Date("2026-10-02T00:00:00Z"),
      ),
    ).toBeNull();
  });
});
