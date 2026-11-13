import type { ComponentType } from "react";
import type { IconProps } from "../garden/icons";

export type PaletteGroup =
  | "search"
  | "jump"
  | "projects"
  | "recent"
  | "settings"
  | "actions";

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  hint?: string;
  /** App path without the remote base path; navigated to when chosen. */
  to?: string;
  /** Runs instead of navigating, for commands such as the skin toggle. */
  run?: () => void;
  Icon?: ComponentType<IconProps>;
}

export interface PaletteSection {
  group: PaletteGroup;
  items: PaletteItem[];
}

/** Rows each group shows; the jump list is short enough to show whole. */
export const PALETTE_GROUP_LIMIT: Record<PaletteGroup, number> = {
  search: 1,
  jump: Number.POSITIVE_INFINITY,
  projects: 6,
  recent: 6,
  settings: 6,
  actions: Number.POSITIVE_INFINITY,
};

const GROUP_ORDER: readonly PaletteGroup[] = [
  "jump",
  "projects",
  "recent",
  "settings",
  "actions",
];

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Every whitespace-separated term must appear in the label or hint. */
export function itemMatches(item: PaletteItem, normalized: string): boolean {
  if (!normalized) return true;
  const haystack = `${item.label} ${item.hint ?? ""}`.toLowerCase();
  return normalized.split(/\s+/).every((term) => haystack.includes(term));
}

export function sessionsSearchPath(query: string): string {
  const trimmed = query.trim();
  return trimmed ? `/sessions?q=${encodeURIComponent(trimmed)}` : "/sessions";
}

/**
 * Filters candidates into ordered, capped sections. The caller puts the
 * search row first, so Enter on an unmatched query still searches sessions.
 */
export function buildPaletteSections(
  candidates: readonly PaletteItem[],
  query: string,
): PaletteSection[] {
  const normalized = normalizeQuery(query);
  const byGroup = new Map<PaletteGroup, PaletteItem[]>();
  for (const item of candidates) {
    if (!itemMatches(item, normalized)) continue;
    const list = byGroup.get(item.group) ?? [];
    if (list.length >= PALETTE_GROUP_LIMIT[item.group]) continue;
    list.push(item);
    byGroup.set(item.group, list);
  }
  return GROUP_ORDER.flatMap((group) => {
    const items = byGroup.get(group);
    return items && items.length > 0 ? [{ group, items }] : [];
  });
}

/** Wraps the active row index within the visible rows. */
export function stepIndex(current: number, delta: number, count: number) {
  if (count <= 0) return 0;
  return (current + delta + count) % count;
}

/** Index of each section's first row in the flattened row list. */
export function sectionStarts(sections: readonly PaletteSection[]): number[] {
  const starts: number[] = [];
  let index = 0;
  for (const section of sections) {
    starts.push(index);
    index += section.items.length;
  }
  return starts;
}

/** First row of the next or previous group, wrapping at either end. */
export function stepGroup(
  starts: readonly number[],
  current: number,
  delta: number,
): number {
  if (starts.length === 0) return 0;
  let owner = 0;
  starts.forEach((start, group) => {
    if (start <= current) owner = group;
  });
  const target = (owner + Math.sign(delta) + starts.length) % starts.length;
  return starts[target] ?? 0;
}
