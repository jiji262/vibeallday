import type { KeyboardEvent } from "react";
import { TabList, tabClassName } from "../components/garden/Tabs";
import type { MessageKey, TranslationFn } from "../i18n";
import styles from "./SourceModeTabs.module.css";

/**
 * The source-control mode selector (topic: source-review-to-session, stage 3):
 * one surface, several navigation modes that all feed the same review
 * accumulator. `changes` owns both the current working tree and explicitly
 * opened commit history, `files` is the all-files blame browser, and
 * `comments` is the pending-review list, and `reviews` is submitted history.
 */
export type SourceTab = "changes" | "files" | "comments" | "reviews";

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
  tab: SourceTab;
  tabs: readonly SourceTab[];
  /** Optional per-tab count chip (e.g. pending review comments). */
  counts?: Partial<Record<SourceTab, number>>;
  fileTabLabelKey?: MessageKey;
  onSelect: (tab: SourceTab) => void;
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
  tab: SourceTab;
  active: boolean;
  count?: number;
  label: string;
  onSelect: (tab: SourceTab) => void;
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
        <span
          className={`${styles.count} ${active ? styles.activeCount : ""}`.trimEnd()}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function sourceTabLabelKey(tab: SourceTab): MessageKey {
  switch (tab) {
    case "changes":
      return "sourceTabChanges";
    case "files":
      return "sourceTabFiles";
    case "comments":
      return "sourceTabComments";
    case "reviews":
      return "sourceTabReviews";
  }
}
