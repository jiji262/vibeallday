import type { KeyboardEvent } from "react";
import { Count } from "../components/garden/Count";
import { TabList, tabClassName } from "../components/garden/Tabs";
import type { MessageKey, TranslationFn } from "../i18n";
import styles from "./SourceModeTabs.module.css";

/**
 * Source-control body modes, as written to `?tab=` (topic:
 * source-review-to-session): `changes` owns the working tree and commit
 * history, `files` is the all-files blame browser, `comments` the pending
 * review list, and `reviews` the submitted history.
 */
export type SourceTab = "changes" | "files" | "comments" | "reviews";

/**
 * The tab strip over those modes: Changes, Commit history (Changes with its
 * revision list), Files, and Review (pending comments plus submissions).
 */
export type SourceViewTab = "changes" | "history" | "files" | "review";

const ARROW_STEP: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

/** Arrow keys move between the mode tabs (wrapping), Home/End jump. */
function moveTabFocus(event: KeyboardEvent<HTMLDivElement>) {
  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
  const current = tabs.indexOf(event.target as HTMLButtonElement);
  if (current < 0) return;
  const step = ARROW_STEP[event.key];
  const next =
    step !== undefined
      ? (current + step + tabs.length) % tabs.length
      : event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : null;
  if (next === null) return;
  event.preventDefault();
  tabs[next]?.focus();
  tabs[next]?.click();
}

export function SourceModeTabs({
  tab,
  tabs,
  counts,
  fileTabLabelKey,
  onSelect,
  variant = "header",
  t,
}: {
  tab: SourceViewTab;
  tabs: readonly SourceViewTab[];
  /** Optional per-tab count chip (changed files, pending review comments). */
  counts?: Partial<Record<SourceViewTab, number>>;
  fileTabLabelKey?: MessageKey;
  onSelect: (tab: SourceViewTab) => void;
  /**
   * `header` is the plain underline strip. `stacked` is the page-intro
   * layout, where the strip spans its row and splits evenly on phones.
   */
  variant?: "header" | "stacked";
  t: TranslationFn;
}) {
  return (
    <TabList
      className={`${styles.tabs} ${
        variant === "stacked" ? styles.stacked : ""
      }`.trimEnd()}
      role="tablist"
      aria-label={t("gitStatusTitle")}
      onKeyDown={moveTabFocus}
    >
      {tabs.map((key) => (
        <SourceModeTab
          key={key}
          tab={key}
          active={tab === key}
          count={counts?.[key]}
          label={t(
            key === "files" && fileTabLabelKey
              ? fileTabLabelKey
              : sourceTabLabelKey(key),
          )}
          onSelect={onSelect}
        />
      ))}
    </TabList>
  );
}

function SourceModeTab({
  tab,
  active,
  count,
  label,
  onSelect,
}: {
  tab: SourceViewTab;
  active: boolean;
  count?: number;
  label: string;
  onSelect: (tab: SourceViewTab) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      data-tab={tab}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      className={tabClassName(active, styles.tab)}
      onClick={() => onSelect(tab)}
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <Count className={styles.count}>{count}</Count>
      )}
    </button>
  );
}

function sourceTabLabelKey(tab: SourceViewTab): MessageKey {
  switch (tab) {
    case "changes":
      return "sourceTabChanges";
    case "history":
      return "sourceCommitHistory";
    case "files":
      return "sourceTabFiles";
    case "review":
      return "sourceTabReviews";
  }
}
