import type { InboxItem } from "../../contexts/InboxContext";
import type { MessageKey } from "../../i18n";
import type { PendingNewSessionProjectQueueItem } from "./InboxQueueItem";

/** Status blocks double as filters; null shows every section. */
export type InboxFilter = "needs" | "running" | "unread" | "queued";

export type InboxSectionKey =
  | "needsAttention"
  | "active"
  | "unread"
  | "queued"
  | "recentActivity";

/** Where a section's trailing link goes, when it has one. */
export type InboxSectionLink = "allSessions" | "allUnread" | "manageQueue";

export interface InboxSectionModel {
  key: InboxSectionKey;
  titleKey: MessageKey;
  items: InboxItem[];
  queueItems: PendingNewSessionProjectQueueItem[];
  link?: InboxSectionLink;
}

export interface InboxTiers {
  needsAttention: InboxItem[];
  active: InboxItem[];
  unread: InboxItem[];
  recentActivity: InboxItem[];
}

export interface InboxSectionInput {
  tiers: InboxTiers;
  pending: PendingNewSessionProjectQueueItem[];
  queuedSessionIds: ReadonlySet<string>;
  /** Overview mode: no unread tier, recent rows are "recently participated". */
  overview: boolean;
}

/** Id of a section; filters and summary links address it. */
export function inboxSectionId(key: InboxSectionKey): string {
  return `now-tier-${key}`;
}

function uniqueRows(rows: readonly InboxItem[]): InboxItem[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.sessionId)) return false;
    seen.add(row.sessionId);
    return true;
  });
}

function everyRow(tiers: InboxTiers): InboxItem[] {
  return uniqueRows([
    ...tiers.needsAttention,
    ...tiers.active,
    ...tiers.unread,
    ...tiers.recentActivity,
  ]);
}

function section(
  key: InboxSectionKey,
  titleKey: MessageKey,
  items: InboxItem[],
  extra: Partial<Pick<InboxSectionModel, "queueItems" | "link">> = {},
): InboxSectionModel {
  return { key, titleKey, items, queueItems: [], ...extra };
}

function unfilteredSections(input: InboxSectionInput): InboxSectionModel[] {
  const { tiers, pending, overview } = input;
  const sections = [
    section("needsAttention", "inboxTierNeedsAttention", tiers.needsAttention),
    section("active", "inboxTierActive", tiers.active, { queueItems: pending }),
  ];
  if (!overview) {
    sections.push(section("unread", "inboxTierUnread", tiers.unread));
  }
  sections.push(
    section("recentActivity", "inboxTierRecentActivity", tiers.recentActivity, {
      link: overview ? "allSessions" : undefined,
    }),
  );
  return sections;
}

/**
 * The sections the page renders, in reading order. A filter narrows the page
 * to one section; unread and queued gather their rows across every tier.
 */
export function buildInboxSections(
  input: InboxSectionInput,
  filter: InboxFilter | null,
): InboxSectionModel[] {
  const { tiers, pending, queuedSessionIds } = input;
  switch (filter) {
    case "needs":
      return [
        section(
          "needsAttention",
          "inboxTierNeedsAttention",
          tiers.needsAttention,
        ),
      ];
    case "running":
      return [
        section("active", "inboxTierActive", tiers.active, {
          queueItems: pending,
        }),
      ];
    case "unread":
      return [
        section(
          "unread",
          "inboxTierUnread",
          everyRow(tiers).filter((row) => row.hasUnread),
          { link: "allUnread" },
        ),
      ];
    case "queued":
      return [
        section(
          "queued",
          "consoleQueued",
          everyRow(tiers).filter((row) => queuedSessionIds.has(row.sessionId)),
          { queueItems: pending, link: "manageQueue" },
        ),
      ];
    default:
      return unfilteredSections(input);
  }
}

/** Approval and question counts behind the Needs-you block. */
export function needsBreakdown(rows: readonly InboxItem[]): {
  approvals: number;
  questions: number;
} {
  let approvals = 0;
  let questions = 0;
  for (const row of rows) {
    if (row.pendingInputType === "tool-approval") approvals += 1;
    if (row.pendingInputType === "user-question") questions += 1;
  }
  return { approvals, questions };
}

/** Last model the summary saw; overview rows carry the catalog record. */
export function inboxRowModel(row: InboxItem): string | undefined {
  return "model" in row && typeof row.model === "string"
    ? row.model
    : undefined;
}
