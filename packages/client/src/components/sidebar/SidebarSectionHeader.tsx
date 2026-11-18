import { UI_KEYS } from "../../lib/storageKeys";
import sectionHeadingStyles from "../SidebarSectionHeading.module.css";

const DEFAULT_SECTION_EXPANSION = {
  projectQueue: true,
  starred: true,
  recentDay: true,
  older: true,
};

export type SidebarSectionKey = keyof typeof DEFAULT_SECTION_EXPANSION;

export type SidebarSectionExpansion = Record<SidebarSectionKey, boolean> & {
  /** Named sections (`category:…`, `user:…`) the reader closed; others open. */
  collapsedGroups?: readonly string[];
};

export const CATEGORY_SECTION_PREFIX = "category:";
export const CREATOR_SECTION_PREFIX = "user:";

function getLocalStorage(): Storage | null {
  return typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : null;
}

export function loadSidebarSectionExpansion(): SidebarSectionExpansion {
  const storage = getLocalStorage();
  if (!storage) {
    return DEFAULT_SECTION_EXPANSION;
  }

  try {
    const raw = storage.getItem(UI_KEYS.sidebarSectionExpansion);
    if (!raw) {
      return DEFAULT_SECTION_EXPANSION;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_SECTION_EXPANSION;
    }
    const value = parsed as Partial<
      Record<SidebarSectionKey | "collapsedGroups", unknown>
    >;
    const collapsedGroups = Array.isArray(value.collapsedGroups)
      ? value.collapsedGroups.filter(
          (key): key is string => typeof key === "string",
        )
      : [];
    return {
      collapsedGroups,
      projectQueue:
        typeof value.projectQueue === "boolean"
          ? value.projectQueue
          : DEFAULT_SECTION_EXPANSION.projectQueue,
      starred:
        typeof value.starred === "boolean"
          ? value.starred
          : DEFAULT_SECTION_EXPANSION.starred,
      recentDay:
        typeof value.recentDay === "boolean"
          ? value.recentDay
          : DEFAULT_SECTION_EXPANSION.recentDay,
      older:
        typeof value.older === "boolean"
          ? value.older
          : DEFAULT_SECTION_EXPANSION.older,
    };
  } catch {
    return DEFAULT_SECTION_EXPANSION;
  }
}

export function saveSidebarSectionExpansion(
  expansion: SidebarSectionExpansion,
): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(UI_KEYS.sidebarSectionExpansion, JSON.stringify(expansion));
  } catch {
    // localStorage is a UI convenience; in-memory state still applies.
  }
}

export interface SidebarSectionHeaderProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  controlsId: string;
  expandLabel: string;
  collapseLabel: string;
  /** Rows in the section, shown only while it is collapsed. */
  count?: number;
  /** More rows exist than are loaded, so `count` is a lower bound. */
  countIsPartial?: boolean;
  /** A limited user's section: marked with a person glyph, name as typed. */
  isPerson?: boolean;
}

/**
 * The whole header row toggles its section. A chevron after the name points
 * down while open and right while closed; a closed section shows its count.
 * Rows below are never indented, so every section keeps the same left edge.
 */
export function SidebarSectionHeader({
  title,
  expanded,
  onToggle,
  controlsId,
  expandLabel,
  collapseLabel,
  count,
  countIsPartial = false,
  isPerson = false,
}: SidebarSectionHeaderProps) {
  const actionLabel = expanded ? collapseLabel : expandLabel;

  return (
    <h3 className={sectionHeadingStyles.sectionHeading}>
      <button
        type="button"
        className={sectionHeadingStyles.sectionToggle}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={controlsId}
        aria-label={`${actionLabel}: ${title}`}
      >
        <span
          className={
            isPerson ? sectionHeadingStyles.sectionTitleAsTyped : undefined
          }
        >
          {title}
        </span>
        {isPerson && (
          <svg
            className={sectionHeadingStyles.sectionPersonGlyph}
            viewBox="0 0 10 10"
            aria-hidden="true"
          >
            <circle cx="5" cy="3.2" r="2" />
            <path d="M1.2 9.3C1.6 6.8 3.2 6 5 6s3.4.8 3.8 3.3" />
          </svg>
        )}
        <svg
          className={sectionHeadingStyles.sectionChevron}
          data-expanded={expanded}
          viewBox="0 0 8 8"
          aria-hidden="true"
        >
          <path d="M1 2.5 4 5.5 7 2.5" />
        </svg>
        {!expanded && count !== undefined && (
          <span
            className={sectionHeadingStyles.sectionCount}
            aria-hidden="true"
          >
            {count}
            {countIsPartial ? "+" : ""}
          </span>
        )}
      </button>
    </h3>
  );
}
