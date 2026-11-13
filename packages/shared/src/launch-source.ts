/**
 * What launched a session, normalized across providers so lists can filter
 * people's own conversations from scripted or scheduled runs. Read from facts
 * fixed at the head of the transcript, so it never changes under append.
 */
export const LAUNCH_SOURCES = [
  "claude-desktop",
  "claude-scheduled",
  "claude-cli",
  "claude-sdk",
  "codex-desktop",
  "codex-exec",
  "codex-other",
  "unknown",
] as const;

export type LaunchSource = (typeof LAUNCH_SOURCES)[number];

/** Sessions no person started: Codex `exec` runs and Claude scheduled tasks. */
export const AUTOMATION_LAUNCH_SOURCES: ReadonlySet<LaunchSource> = new Set([
  "codex-exec",
  "claude-scheduled",
]);

const LAUNCH_SOURCE_SET: ReadonlySet<string> = new Set(LAUNCH_SOURCES);

export function isLaunchSource(value: unknown): value is LaunchSource {
  return typeof value === "string" && LAUNCH_SOURCE_SET.has(value);
}

export interface LaunchSourceFacts {
  /** Catalog family of the provider that wrote the transcript. */
  family: string;
  /** Claude: the first recorded `entrypoint` (e.g. "claude-desktop", "cli"). */
  entrypoint?: string;
  /** Claude: the first non-meta user message's text. */
  firstUserText?: string;
  /** Codex: `session_meta.originator` (e.g. "Codex Desktop", "codex_exec"). */
  originator?: string;
  /** Codex: `session_meta.source` label (e.g. "vscode", "exec", "subagent"). */
  source?: string;
}

const SCHEDULED_TASK_PREFIX = "<scheduled-task";
/** "Codex Desktop", and variants such as "codex_work_desktop". */
const CODEX_DESKTOP_ORIGINATOR = /desktop/i;
const CODEX_EXEC_ORIGINATOR = "codex_exec";
const CODEX_EXEC_SOURCE = "exec";

function classifyClaude(facts: LaunchSourceFacts): LaunchSource {
  if (facts.firstUserText?.trimStart().startsWith(SCHEDULED_TASK_PREFIX)) {
    return "claude-scheduled";
  }
  const entrypoint = facts.entrypoint;
  if (entrypoint === "claude-desktop") return "claude-desktop";
  if (entrypoint === "cli") return "claude-cli";
  if (entrypoint?.startsWith("sdk-")) return "claude-sdk";
  return "unknown";
}

/** An `exec` run is automation even when Codex Desktop launched it. */
function classifyCodex(facts: LaunchSourceFacts): LaunchSource {
  if (
    facts.originator === CODEX_EXEC_ORIGINATOR ||
    facts.source === CODEX_EXEC_SOURCE
  ) {
    return "codex-exec";
  }
  if (facts.originator && CODEX_DESKTOP_ORIGINATOR.test(facts.originator))
    return "codex-desktop";
  return "codex-other";
}

/** Undefined for providers whose launchers are not told apart. */
export function classifyLaunchSource(
  facts: LaunchSourceFacts,
): LaunchSource | undefined {
  if (facts.family === "claude") return classifyClaude(facts);
  if (facts.family === "codex") return classifyCodex(facts);
  return undefined;
}
