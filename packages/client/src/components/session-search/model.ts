import {
  getCollapsedSearchPreviewText,
  normalizeSearchPreviewText,
  type SessionContentMatch,
} from "@vibeallday/shared";
import type { GlobalSessionItem } from "../../api/client";
import { getSessionDisplayTitle } from "../../utils";

export type SearchField = "title" | "assistant" | "user";
export type TimeBasis = "turns" | "activity" | "created";
export const statuses = [
  "archived",
  "unarchived",
  "starred",
  "unstarred",
  "read",
  "unread",
] as const;
export type SearchStatus = (typeof statuses)[number];
export function matchesStatus(
  session: GlobalSessionItem,
  status: SearchStatus,
) {
  switch (status) {
    case "archived":
      return !!session.isArchived;
    case "unarchived":
      return !session.isArchived;
    case "starred":
      return !!session.isStarred;
    case "unstarred":
      return !session.isStarred;
    case "read":
      return !session.hasUnread;
    case "unread":
      return !!session.hasUnread;
  }
}
export function toggleStatus(
  previous: SearchStatus[],
  value: SearchStatus,
): SearchStatus[] {
  const group = Math.floor(statuses.indexOf(value) / 2);
  return previous.includes(value)
    ? previous.filter((s) => s !== value)
    : [
        ...previous.filter(
          (s) => Math.floor(statuses.indexOf(s) / 2) !== group,
        ),
        value,
      ];
}
/** Statuses the quick chips show; the Filters badge does not count them. */
export const chipStatuses = ["unread"] as const;
export type ChipStatus = (typeof chipStatuses)[number];
/** Toggles a quick status chip. */
export function toggleChipStatus(
  previous: SearchStatus[],
  value: ChipStatus,
): SearchStatus[] {
  return toggleStatus(previous, value);
}
/**
 * Live-state quick filters (URL `activity`). A session passes when it matches
 * any selected one; they are client-side views over existing session fields.
 */
export const activityFilters = ["attention", "running"] as const;
export type ActivityFilter = (typeof activityFilters)[number];
type ActivityFields = Pick<
  GlobalSessionItem,
  "pendingInputType" | "nonHumanUserTurn" | "activity"
>;
/** Same rule as the overview's "Needs you" tier. */
export function sessionNeedsYou(session: ActivityFields): boolean {
  return (
    !!session.pendingInputType ||
    !!session.nonHumanUserTurn ||
    session.activity === "waiting-input"
  );
}
export function matchesActivity(
  session: ActivityFields,
  filter: ActivityFilter,
): boolean {
  if (filter === "attention") return sessionNeedsYou(session);
  return !sessionNeedsYou(session) && session.activity === "in-turn";
}
export function parseActivityParam(text: string): ActivityFilter[] {
  return text
    .split(",")
    .filter((value): value is ActivityFilter =>
      (activityFilters as readonly string[]).includes(value),
    );
}
/** Totals the quick chips show, over sessions that are not archived. */
export interface QuickCounts {
  attention: number;
  running: number;
  unread: number;
}
export function countQuickViews(
  sessions: readonly GlobalSessionItem[],
): QuickCounts {
  const counts: QuickCounts = { attention: 0, running: 0, unread: 0 };
  for (const session of sessions) {
    if (session.isArchived) continue;
    if (matchesActivity(session, "attention")) counts.attention += 1;
    else if (matchesActivity(session, "running")) counts.running += 1;
    if (session.hasUnread) counts.unread += 1;
  }
  return counts;
}
export function toggleActivity(
  previous: readonly ActivityFilter[],
  value: ActivityFilter,
): ActivityFilter[] {
  return previous.includes(value)
    ? previous.filter((filter) => filter !== value)
    : [...previous, value];
}
export interface FilterSnapshot {
  fields: SearchField[];
  intersection: boolean;
  basis: TimeBasis;
  young: string;
  old: string;
  limit: string;
  project: string;
  providers: readonly string[];
  sources: readonly string[];
  executors: readonly string[];
  created: readonly string[];
  statuses: readonly SearchStatus[];
}
/** How many groups of the Filters sheet differ from their defaults. */
export function countActiveFilters(state: FilterSnapshot): number {
  const searchInChanged =
    state.fields.length !== 1 || state.fields[0] !== "title";
  const viewsSessions =
    state.statuses.includes("unarchived") ||
    state.statuses.includes("archived");
  const sheetStatuses = state.statuses.filter(
    (status) =>
      status !== "unarchived" &&
      !(chipStatuses as readonly string[]).includes(status),
  );
  return [
    searchInChanged,
    !state.intersection,
    state.basis !== "activity",
    !!(state.young || state.old),
    !!state.limit,
    !!state.project,
    state.providers.length > 0,
    state.sources.length > 0,
    state.executors.length > 0,
    state.created.length > 0,
    !viewsSessions,
  ]
    .map(Number)
    .reduce((sum, active) => sum + active, sheetStatuses.length);
}
export function durationMs(text: string, empty: number): number {
  if (!text.trim()) return empty;
  if (/^∞\s*d?$/i.test(text.trim()) && empty === Infinity) return Infinity;
  const match = /^(\d+(?:\.\d+)?)\s*([dhm]?)$/i.exec(text.trim());
  if (!match) return NaN;
  return (
    Number(match[1]) *
    ({ d: 86400000, h: 3600000, m: 60000 }[match[2]?.toLowerCase() || "d"] ??
      NaN)
  );
}
export function inTimeRange(
  timestamp: string | undefined,
  after?: number,
  before?: number,
) {
  if (after === undefined && before === undefined) return true;
  const value = Date.parse(timestamp ?? "");
  return (
    Number.isFinite(value) &&
    value >= (after ?? -Infinity) &&
    value <= (before ?? Infinity)
  );
}
export interface TitleMatch {
  id: string;
  role: "title";
  preview: string;
  fullText: string;
}
export type SearchMatch = SessionContentMatch | TitleMatch;
/** The preview budget applies independently to each selected turn type. */
export function limitTurnMatches(
  matches: SearchMatch[],
  limit: number,
): SessionContentMatch[] {
  const counts = { user: 0, assistant: 0 };
  return matches.filter(
    (match): match is SessionContentMatch =>
      match.role !== "title" && ++counts[match.role] <= limit,
  );
}
export function titleMatches(
  session: GlobalSessionItem,
  query: string,
  after?: number,
  before?: number,
  additionalNeedles: readonly string[] = [],
): TitleMatch[] {
  if (!query.trim()) return [];
  const title = getSessionDisplayTitle(session) ?? "";
  const prompt =
    session.initialPrompt || session.fullTitle || session.title || "";
  const candidates = [
    title,
    ...(prompt !== title && inTimeRange(session.createdAt, after, before)
      ? [prompt]
      : []),
  ];
  const needle = query.replace(/\s+/g, " ").trim().toLowerCase();
  const needles = [
    needle,
    ...additionalNeedles.map((term) =>
      term.replace(/\s+/g, " ").trim().toLowerCase(),
    ),
  ];
  const text = candidates.find((text) => {
    const normalized = normalizeSearchPreviewText(text)
      .replace(/\s+/g, " ")
      .toLowerCase();
    return needles.every((term) => normalized.includes(term));
  });
  return text
    ? [
        {
          id: "title",
          role: "title",
          fullText: text,
          preview: getCollapsedSearchPreviewText(text, query),
        },
      ]
    : [];
}
