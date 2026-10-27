import {
  AUTOMATION_LAUNCH_SOURCES,
  classifyLaunchSource,
  isLaunchSource,
  LAUNCH_SOURCES,
  type LaunchSource,
} from "@vibeallday/shared";

/** i18n key per source; labels are product names, so most stay untranslated. */
export const LAUNCH_SOURCE_LABEL_KEYS = {
  "claude-desktop": "launchSource_claude-desktop",
  "claude-scheduled": "launchSource_claude-scheduled",
  "claude-cli": "launchSource_claude-cli",
  "claude-sdk": "launchSource_claude-sdk",
  "codex-desktop": "launchSource_codex-desktop",
  "codex-exec": "launchSource_codex-exec",
  "codex-other": "launchSource_codex-other",
  unknown: "launchSource_unknown",
} as const satisfies Record<LaunchSource, string>;

interface LiveSummaryFacts {
  launchSource?: unknown;
  provider?: string;
  originator?: string;
  source?: string;
  title?: string | null;
  fullTitle?: string | null;
}

/**
 * A label for a summary that arrived on a live event, before the catalog read
 * the transcript head. Codex summaries carry their originator; for Claude only
 * a scheduled task's prompt is telling, so anything else waits for the catalog.
 */
export function launchSourceOfSummary(
  session: LiveSummaryFacts,
): LaunchSource | undefined {
  if (isLaunchSource(session.launchSource)) return session.launchSource;
  if (session.provider === "codex") {
    return classifyLaunchSource({
      family: "codex",
      originator: session.originator,
      source: session.source,
    });
  }
  if (session.provider === "claude") {
    const firstUserText = session.fullTitle ?? session.title ?? undefined;
    const source = classifyLaunchSource({ family: "claude", firstUserText });
    return source === "claude-scheduled" ? source : undefined;
  }
  return undefined;
}

/** Sessions from providers that are not told apart file under unknown. */
export function effectiveLaunchSource(session: {
  launchSource?: LaunchSource;
}): LaunchSource {
  return session.launchSource ?? "unknown";
}

export function isAutomationLaunchSource(
  source: LaunchSource | undefined,
): boolean {
  return source !== undefined && AUTOMATION_LAUNCH_SOURCES.has(source);
}

/**
 * Whether the hide-automation preference keeps a session out of a list. A
 * session waiting on its reader is never hidden: hiding it would hide the ask.
 */
export function isHiddenAutomation(
  session: { launchSource?: LaunchSource; pendingInputType?: unknown },
  hideAutomation: boolean,
): boolean {
  return (
    hideAutomation &&
    !session.pendingInputType &&
    isAutomationLaunchSource(session.launchSource)
  );
}

/** The `source=` URL parameter: comma-separated, unknown values dropped. */
export function parseLaunchSourceParam(value: string): LaunchSource[] {
  return value.split(",").filter(isLaunchSource);
}

/** Display order for pickers: the fixed vocabulary order. */
export function sortLaunchSources(
  sources: Iterable<LaunchSource>,
): LaunchSource[] {
  const present = new Set(sources);
  return LAUNCH_SOURCES.filter((source) => present.has(source));
}
