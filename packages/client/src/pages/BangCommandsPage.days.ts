import type { BangCommandTranscriptDisplayObject } from "@vibeallday/shared";
import type { StatusState } from "../components/garden/StatusDot";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface BangHistoryEntry {
  sessionId: string;
  projectId?: string;
  object: BangCommandTranscriptDisplayObject;
}

export interface BangHistoryDay {
  /** Local calendar day, `YYYY-M-D`; stable React key and heading id. */
  key: string;
  /** Local midnight of the day. */
  start: Date;
  entries: BangHistoryEntry[];
  failed: number;
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** A finished run that exited non-zero, or errored or was killed. */
export function isFailedRun(object: BangCommandTranscriptDisplayObject) {
  if (object.status === "error" || object.status === "killed") return true;
  return (
    object.status === "done" &&
    object.exitCode !== undefined &&
    object.exitCode !== 0
  );
}

/** Timeline node: running = run, failed = err, success = ok, else idle. */
export function runStatus(
  object: BangCommandTranscriptDisplayObject,
): StatusState {
  if (object.status === "running") return "run";
  if (isFailedRun(object)) return "err";
  return object.exitCode === 0 ? "ok" : "idle";
}

/**
 * Groups entries by local calendar day, keeping the server's order. Entries
 * with an unparseable time fall into the group of their neighbour.
 */
export function groupByDay(entries: readonly BangHistoryEntry[]) {
  const days: BangHistoryDay[] = [];
  for (const entry of entries) {
    const created = new Date(entry.object.createdAt);
    const valid = !Number.isNaN(created.getTime());
    const last = days.at(-1);
    const key = valid ? localDayKey(created) : (last?.key ?? "unknown");
    if (!last || last.key !== key) {
      days.push({
        key,
        start: localMidnight(valid ? created : new Date()),
        entries: [],
        failed: 0,
      });
    }
    const day = days.at(-1) as BangHistoryDay;
    day.entries.push(entry);
    if (isFailedRun(entry.object)) day.failed += 1;
  }
  return days;
}

/** Whole local days between `start` and today's midnight. */
export function daysAgo(start: Date, now: Date = new Date()): number {
  return Math.round(
    (localMidnight(now).getTime() - start.getTime()) / MS_PER_DAY,
  );
}
