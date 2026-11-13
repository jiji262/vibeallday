import { open } from "node:fs/promises";
import {
  classifyLaunchSource,
  type LaunchSource,
  type LaunchSourceFacts,
} from "@vibeallday/shared";
import { readFirstLine } from "../utils/jsonl.js";
import { CODEX_META_READ_MAX_BYTES } from "./codex-discovery.js";
import type { ProviderCatalogFamily } from "./provider-catalog-family.js";

/** Scheduled-task prompts measured ≤ 60 KB in; a Claude head past this only
 * loses the scheduled/desktop distinction, never the entrypoint. */
const CLAUDE_HEAD_MAX_BYTES = 256 * 1024;

type JsonRecord = Record<string, unknown>;

function parseRecord(line: string): JsonRecord | undefined {
  try {
    const value: unknown = JSON.parse(line);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonRecord)
      : undefined;
  } catch {
    return undefined;
  }
}

function firstText(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  for (const block of content) {
    const text = (block as { type?: unknown; text?: unknown } | null)?.text;
    if (
      (block as { type?: unknown })?.type === "text" &&
      typeof text === "string"
    )
      return text;
  }
  return undefined;
}

function userText(entry: JsonRecord): string | undefined {
  if (entry.type !== "user" || entry.isMeta === true) return undefined;
  const message = entry.message as { content?: unknown } | undefined;
  return firstText(message?.content);
}

async function readHeadLines(filePath: string, maxBytes: number) {
  const file = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await file.read(buffer, 0, maxBytes, 0);
    const lines = buffer.subarray(0, bytesRead).toString("utf8").split("\n");
    // A full buffer usually ends mid-line.
    if (bytesRead === maxBytes) lines.pop();
    return lines;
  } finally {
    await file.close();
  }
}

async function readClaudeFacts(filePath: string): Promise<LaunchSourceFacts> {
  const facts: LaunchSourceFacts = { family: "claude" };
  for (const line of await readHeadLines(filePath, CLAUDE_HEAD_MAX_BYTES)) {
    if (!line.trim()) continue;
    const entry = parseRecord(line);
    if (!entry) continue;
    if (facts.entrypoint === undefined && typeof entry.entrypoint === "string")
      facts.entrypoint = entry.entrypoint;
    const text = userText(entry);
    if (text !== undefined) {
      facts.firstUserText = text;
      break;
    }
  }
  return facts;
}

function codexSourceLabel(source: unknown): string | undefined {
  if (typeof source === "string") return source.trim() || undefined;
  if (source && typeof source === "object" && "subagent" in source)
    return "subagent";
  return undefined;
}

async function readCodexFacts(filePath: string): Promise<LaunchSourceFacts> {
  const line = await readFirstLine(filePath, CODEX_META_READ_MAX_BYTES);
  const entry = line ? parseRecord(line) : undefined;
  const payload =
    entry?.type === "session_meta" ? (entry.payload as JsonRecord) : undefined;
  return {
    family: "codex",
    ...(typeof payload?.originator === "string"
      ? { originator: payload.originator }
      : {}),
    ...(codexSourceLabel(payload?.source) !== undefined
      ? { source: codexSourceLabel(payload?.source) }
      : {}),
  };
}

/**
 * Classify a transcript file by what launched it, from its head alone.
 * Undefined for families `classifyLaunchSource` does not tell apart.
 */
export async function readLaunchSource(
  filePath: string,
  family: ProviderCatalogFamily,
): Promise<LaunchSource | undefined> {
  if (family === "claude")
    return classifyLaunchSource(await readClaudeFacts(filePath));
  if (family === "codex")
    return classifyLaunchSource(await readCodexFacts(filePath));
  return undefined;
}
