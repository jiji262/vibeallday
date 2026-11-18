import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SessionNotification } from "@agentclientprotocol/sdk";
import type { ACPClient } from "../../../src/sdk/providers/acp/client.js";
import { GrokACPProvider } from "../../../src/sdk/providers/grok-acp.js";
import {
  extractGrokSessionContextUsage,
  extractGrokTurnUsageFromUpdate,
  normalizeGrokRawUsage,
  readGrokLedgerTurnCount,
  readGrokLedgerUsageSince,
} from "../../../src/sdk/providers/grok-usage.js";
import type { SDKMessage } from "../../../src/sdk/types.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Grok usage & ledger normalization", () => {
  it("folds cacheCreationTokens into fresh input_tokens and subtracts cachedReadTokens", () => {
    expect(
      normalizeGrokRawUsage({
        inputTokens: 1_000,
        cachedReadTokens: 700,
        cacheCreationTokens: 200,
        outputTokens: 150,
        reasoningTokens: 60,
      }),
    ).toEqual({
      input_tokens: 500,
      output_tokens: 150,
      cache_read_input_tokens: 700,
      cache_creation_input_tokens: 0,
    });
  });

  it("aggregates multi-model modelUsage maps on turn_completed updates", () => {
    expect(
      extractGrokTurnUsageFromUpdate({
        sessionUpdate: "turn_completed",
        usage: {
          modelUsage: {
            "grok-4.6": {
              inputTokens: 800,
              cachedReadTokens: 500,
              outputTokens: 120,
            },
            "grok-4.5-fast": {
              inputTokens: 200,
              cachedReadTokens: 50,
              cacheCreationTokens: 40,
              outputTokens: 30,
            },
          },
        },
      }),
    ).toEqual({
      input_tokens: 490,
      output_tokens: 150,
      cache_read_input_tokens: 550,
      cache_creation_input_tokens: 0,
    });
  });

  it("slices newly appended turns from Grok 1.0 usage.json ledger", () => {
    const sessionDir = mkdtempSync(join(tmpdir(), "grok-ledger-"));
    tempDirs.push(sessionDir);

    writeFileSync(
      join(sessionDir, "usage.json"),
      JSON.stringify({
        turns: [
          {
            inputTokens: 400,
            cachedReadTokens: 100,
            cacheCreationTokens: 50,
            outputTokens: 40,
          },
          {
            inputTokens: 900,
            cachedReadTokens: 600,
            cacheCreationTokens: 100,
            outputTokens: 85,
          },
        ],
      }),
    );

    expect(readGrokLedgerTurnCount(sessionDir)).toBe(2);
    expect(readGrokLedgerUsageSince(sessionDir, 1)).toEqual({
      input_tokens: 400,
      output_tokens: 85,
      cache_read_input_tokens: 600,
      cache_creation_input_tokens: 0,
    });

    const contextUsage = extractGrokSessionContextUsage({
      sessionDir,
      model: "grok-4.6",
    });
    expect(contextUsage).toEqual({
      inputTokens: 1_000,
      percentage: 0,
      contextWindow: 512_000,
      outputTokens: 85,
      cacheReadTokens: 600,
      cacheCreationTokens: 100,
    });
  });

  it("attaches Grok 1.0 usage.json ledger totals and subscription quota on GrokACPProvider", async () => {
    const grokHome = mkdtempSync(join(tmpdir(), "grok-home-"));
    const cwd = mkdtempSync(join(tmpdir(), "grok-cwd-"));
    tempDirs.push(grokHome, cwd);

    const binDir = join(grokHome, "bin");
    const logsDir = join(grokHome, "logs");
    const sessionId = "grok-live-1";
    const sessionDir = join(
      grokHome,
      "sessions",
      encodeURIComponent(cwd),
      sessionId,
    );
    mkdirSync(binDir, { recursive: true });
    mkdirSync(logsDir, { recursive: true });
    mkdirSync(sessionDir, { recursive: true });
    const fakeBin = join(binDir, "grok");
    writeFileSync(fakeBin, "#!/bin/sh\n");
    writeFileSync(
      join(logsDir, "unified.jsonl"),
      `${JSON.stringify({
        ts: "2099-01-02T00:00:00Z",
        msg: "billing: fetched credits config",
        ctx: {
          config: {
            creditUsagePercent: 22,
            currentPeriod: {
              start: "2099-01-01T00:00:00Z",
              end: "2099-02-01T00:00:00Z",
            },
          },
        },
      })}\n`,
    );

    let onUpdate: ((n: SessionNotification) => void) | undefined;
    const fakeClient = {
      pid: 4242,
      setSessionUpdateCallback: (cb: (n: SessionNotification) => void) => {
        onUpdate = cb;
      },
      setPermissionRequestCallback: () => {},
      setExtensionMethodCallback: () => {},
      connect: async () => {},
      initialize: async () => ({}),
      newSession: async () => sessionId,
      prompt: async () => {
        onUpdate?.({
          sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "done" },
          },
        } as SessionNotification);
        writeFileSync(
          join(sessionDir, "usage.json"),
          JSON.stringify({
            turns: [
              {
                inputTokens: 1_200,
                cachedReadTokens: 800,
                cacheCreationTokens: 100,
                outputTokens: 64,
              },
            ],
          }),
        );
        return {};
      },
      close: () => {},
    } as unknown as ACPClient;

    const provider = new GrokACPProvider({
      grokPath: fakeBin,
      grokHome,
      createClient: () => fakeClient,
    });

    const quota = await provider.getSubscriptionUsage();
    expect(quota?.windows[0]).toMatchObject({
      id: "grok:subscription-credits",
      usedPercent: 22,
    });

    const session = await provider.startSession({
      cwd,
      initialMessage: { text: "hello" },
    });
    const emitted: SDKMessage[] = [];
    for await (const msg of session.iterator) {
      emitted.push(msg);
      if (msg.type === "result") {
        session.abort();
        break;
      }
    }

    const resultFrame = emitted.find((msg) => msg.type === "result");
    expect(resultFrame).toMatchObject({
      type: "result",
      session_id: sessionId,
      usage: {
        input_tokens: 500,
        output_tokens: 64,
        cache_read_input_tokens: 800,
        cache_creation_input_tokens: 0,
      },
    });
  });
});
