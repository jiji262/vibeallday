import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as zlib from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readLaunchSource } from "../../src/sessions/launch-source-head.js";
import { isZstdJsonlSupported } from "../../src/utils/jsonl.js";

const zstdCompressSync = (
  zlib as typeof zlib & {
    zstdCompressSync?: (buffer: Buffer) => Buffer;
  }
).zstdCompressSync;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "launch-source-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeJsonl(name: string, entries: readonly object[]) {
  const path = join(dir, name);
  await writeFile(path, entries.map((e) => `${JSON.stringify(e)}\n`).join(""));
  return path;
}

describe("readLaunchSource (Claude)", () => {
  it("takes the entrypoint from setup rows before the first user turn", async () => {
    const path = await writeJsonl("desktop.jsonl", [
      { type: "queue-operation", operation: "enqueue" },
      { type: "attachment", entrypoint: "claude-desktop" },
      {
        type: "user",
        entrypoint: "claude-desktop",
        message: { content: "look at the relay" },
      },
    ]);
    expect(await readLaunchSource(path, "claude")).toBe("claude-desktop");
  });

  it("recognizes a scheduled task from the first user message", async () => {
    const path = await writeJsonl("scheduled.jsonl", [
      { type: "attachment", entrypoint: "claude-desktop" },
      {
        type: "user",
        isMeta: true,
        message: { content: "<local-command-caveat>x</local-command-caveat>" },
      },
      {
        type: "user",
        entrypoint: "claude-desktop",
        message: {
          content: [
            {
              type: "text",
              text: '<scheduled-task name="job">go</scheduled-task>',
            },
          ],
        },
      },
    ]);
    expect(await readLaunchSource(path, "claude")).toBe("claude-scheduled");
  });

  it("classifies a CLI session that has no user turn yet", async () => {
    const path = await writeJsonl("cli.jsonl", [
      { type: "attachment", entrypoint: "cli" },
    ]);
    expect(await readLaunchSource(path, "claude")).toBe("claude-cli");
  });

  it("skips unparseable lines", async () => {
    const path = join(dir, "broken.jsonl");
    await writeFile(
      path,
      `not json\n${JSON.stringify({ type: "user", entrypoint: "sdk-ts", message: { content: "hi" } })}\n`,
    );
    expect(await readLaunchSource(path, "claude")).toBe("claude-sdk");
  });
});

describe("readLaunchSource (Codex)", () => {
  const meta = (payload: object) => ({
    type: "session_meta",
    payload: {
      id: "s",
      cwd: "/tmp",
      timestamp: "2026-10-24T00:00:00Z",
      ...payload,
    },
  });

  it("reads originator and source from session_meta", async () => {
    const exec = await writeJsonl("rollout-exec.jsonl", [
      meta({ originator: "codex_exec", source: "exec" }),
    ]);
    const desktop = await writeJsonl("rollout-desktop.jsonl", [
      meta({
        originator: "Codex Desktop",
        source: { subagent: { kind: "x" } },
      }),
    ]);
    expect(await readLaunchSource(exec, "codex")).toBe("codex-exec");
    expect(await readLaunchSource(desktop, "codex")).toBe("codex-desktop");
  });

  it.skipIf(!zstdCompressSync || !isZstdJsonlSupported())(
    "reads a zstd-compressed rollout",
    async () => {
      const path = join(dir, "rollout-old.jsonl.zst");
      const line = `${JSON.stringify(meta({ originator: "codex_exec" }))}\n`;
      await writeFile(path, zstdCompressSync!(Buffer.from(line)));
      expect(await readLaunchSource(path, "codex")).toBe("codex-exec");
    },
  );

  it("falls back to other when the head is unreadable", async () => {
    const path = join(dir, "rollout-empty.jsonl");
    await writeFile(path, "");
    expect(await readLaunchSource(path, "codex")).toBe("codex-other");
  });
});

describe("readLaunchSource (other providers)", () => {
  it("does not read files it cannot classify", async () => {
    expect(
      await readLaunchSource(join(dir, "missing.json"), "gemini"),
    ).toBeUndefined();
  });
});
