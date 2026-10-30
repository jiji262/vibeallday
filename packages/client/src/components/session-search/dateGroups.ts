/** Last-activity buckets the Sessions list heads its rows with. */
export type DateGroup = "today" | "yesterday" | "week" | "earlier";

const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;
/** `Date#getDay()` numbers Sunday 0; weeks here start on Monday. */
const MONDAY = 1;

interface DateGroupBounds {
  today: number;
  yesterday: number;
  week: number;
}

/** Local midnights that open today, yesterday and the current week. */
export function dateGroupBounds(now: number): DateGroupBounds {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const today = midnight.getTime();
  const sinceMonday =
    (midnight.getDay() - MONDAY + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return {
    today,
    yesterday: today - DAY_MS,
    week: today - sinceMonday * DAY_MS,
  };
}

/** Unparseable timestamps fall into "earlier" rather than "today". */
export function dateGroupOf(
  timestamp: string | undefined,
  bounds: DateGroupBounds,
): DateGroup {
  const value = Date.parse(timestamp ?? "");
  if (!Number.isFinite(value)) return "earlier";
  if (value >= bounds.today) return "today";
  if (value >= bounds.yesterday) return "yesterday";
  if (value >= bounds.week) return "week";
  return "earlier";
}

export interface DateGroupHeader {
  group: DateGroup;
  /** Rows in this run, including ones not yet rendered. */
  count: number;
}

/**
 * Marks the first row of every consecutive same-bucket run. Runs rather than
 * sorted buckets: the list keeps its own order, and an out-of-order row only
 * starts another run instead of moving.
 */
export function dateGroupHeaders(
  rows: readonly { id: string; updatedAt: string }[],
  now: number,
): ReadonlyMap<string, DateGroupHeader> {
  const bounds = dateGroupBounds(now);
  const headers = new Map<string, DateGroupHeader>();
  let current: DateGroupHeader | undefined;
  for (const row of rows) {
    const group = dateGroupOf(row.updatedAt, bounds);
    if (current?.group === group) {
      current.count += 1;
      continue;
    }
    current = { group, count: 1 };
    headers.set(row.id, current);
  }
  return headers;
}
