import { formatCommandDuration } from "@vibeallday/shared/transcript/shellToolOutput";
import {
  getEarliestMessageTimestampMs,
  getLatestMessageTimestampMs,
} from "../../lib/messageAge";
import type { ExplorationParent } from "../../lib/sessionDetail/explorationProjection";
import { canonicalizeToolName, getExplorationKind } from "../../lib/toolNames";

/** Counts shown in a work-log fold head: 探索 N · 修改 N · 运行 N. */
export interface WorkLogCounts {
  explore: number;
  edit: number;
  run: number;
}

const EDIT_TOOL_NAMES: ReadonlySet<string> = new Set([
  "edit",
  "multiedit",
  "write",
  "notebookedit",
]);
const MS_PER_SECOND = 1000;
/** Below this a group finished within one event; a "0s" duration says nothing. */
const MIN_DISPLAYED_DURATION_MS = MS_PER_SECOND;

function isEditTool(toolName: string): boolean {
  return EDIT_TOOL_NAMES.has(canonicalizeToolName(toolName).toLowerCase());
}

/**
 * Every exploration entry counts as explored. A parent that is neither an
 * exploration tool nor an edit (a shell command whose display actions were
 * projected into entries) also counts once as a run.
 */
export function countWorkLog(
  parents: readonly ExplorationParent[],
): WorkLogCounts {
  const counts: WorkLogCounts = { explore: 0, edit: 0, run: 0 };
  for (const parent of parents) {
    const toolName = parent.item.toolName;
    if (getExplorationKind(toolName) !== null) {
      counts.explore += parent.entries.length;
    } else if (isEditTool(toolName)) {
      counts.edit += 1;
    } else {
      counts.explore += parent.entries.length;
      counts.run += 1;
    }
  }
  return counts;
}

/**
 * Wall time from the first source message to the last one, or null when the
 * transcript carries no timestamps (or the span is too short to be useful).
 */
export function getWorkLogDurationLabel(
  parents: readonly ExplorationParent[],
): string | null {
  let earliest: number | null = null;
  let latest: number | null = null;
  for (const parent of parents) {
    const start = getEarliestMessageTimestampMs(parent.item.sourceMessages);
    const end = getLatestMessageTimestampMs(parent.item.sourceMessages);
    if (start !== null)
      earliest = earliest === null ? start : Math.min(earliest, start);
    if (end !== null) latest = latest === null ? end : Math.max(latest, end);
  }
  if (earliest === null || latest === null) return null;
  const spanMs = latest - earliest;
  if (spanMs < MIN_DISPLAYED_DURATION_MS) return null;
  return formatCommandDuration(Math.round(spanMs / MS_PER_SECOND)) || null;
}
