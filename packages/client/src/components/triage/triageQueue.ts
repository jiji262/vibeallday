/**
 * One-by-one triage over the live needs-you rows. The live list is the
 * truth: an item leaves the queue when the server stops reporting it, so
 * "handled" is every item seen during this visit that is no longer live.
 * Skipping moves an item behind the unskipped ones without dropping it.
 */

export interface TriageProgress {
  /** Every session id that has been in the queue during this visit. */
  seen: readonly string[];
  /** Skipped ids, oldest skip first; they follow the unskipped items. */
  skipped: readonly string[];
}

export const EMPTY_TRIAGE_PROGRESS: TriageProgress = { seen: [], skipped: [] };

/** `seen` plus any live id not yet in it; the same array when unchanged. */
export function mergeSeen(
  seen: readonly string[],
  liveIds: readonly string[],
): readonly string[] {
  const known = new Set(seen);
  const added = liveIds.filter((id) => !known.has(id));
  return added.length === 0 ? seen : [...seen, ...added];
}

/** Live ids in handling order: unskipped first, then skipped by skip age. */
export function triageOrder(
  liveIds: readonly string[],
  skipped: readonly string[],
): string[] {
  const live = new Set(liveIds);
  const skippedSet = new Set(skipped);
  return [
    ...liveIds.filter((id) => !skippedSet.has(id)),
    ...skipped.filter((id) => live.has(id)),
  ];
}

/** Move `id` to the back of the queue. */
export function skipItem(progress: TriageProgress, id: string): TriageProgress {
  return {
    ...progress,
    skipped: [...progress.skipped.filter((other) => other !== id), id],
  };
}

export interface TriageCounts {
  total: number;
  handled: number;
  /** 1-based position of the current item; 0 when nothing is left. */
  current: number;
}

export function triageCounts(
  seen: readonly string[],
  liveIds: readonly string[],
): TriageCounts {
  const live = new Set(liveIds);
  const handled = seen.filter((id) => !live.has(id)).length;
  const total = seen.length;
  return { total, handled, current: liveIds.length > 0 ? handled + 1 : 0 };
}

/** Progress carried in the /triage history entry across a session visit. */
export function readTriageProgress(state: unknown): TriageProgress {
  if (!state || typeof state !== "object") return EMPTY_TRIAGE_PROGRESS;
  const value = (state as { triage?: unknown }).triage;
  if (!value || typeof value !== "object") return EMPTY_TRIAGE_PROGRESS;
  const { seen, skipped } = value as Record<string, unknown>;
  return {
    seen: stringList(seen),
    skipped: stringList(skipped),
  };
}

/** Where a session opened from Triage goes back to, with that progress. */
export interface TriageReturn {
  to: string;
  progress: TriageProgress;
}

/** One leading slash and no backslash: never `//host` or `/\host`. */
const IN_APP_PATH = /^\/(?!\/)[^\\]*$/;

/**
 * The Triage page puts its own path and progress in the state of the
 * session entry it opens; anything else is not a way back.
 */
export function readTriageReturn(state: unknown): TriageReturn | null {
  if (!state || typeof state !== "object") return null;
  const to = (state as { triageReturnTo?: unknown }).triageReturnTo;
  if (typeof to !== "string" || !IN_APP_PATH.test(to)) return null;
  return { to, progress: readTriageProgress(state) };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
