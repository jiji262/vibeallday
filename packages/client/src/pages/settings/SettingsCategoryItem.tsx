import { useEffect, useRef } from "react";
import { SettingsCategoryIcon } from "./SettingsCategoryIcons";
import styles from "./SettingsCategoryItem.module.css";
import { renderSettingsSearchHighlight } from "./SettingsSearchContext";
import type { SettingsCategory } from "./types";

export interface SettingsCategoryItemProps {
  category: SettingsCategory;
  isActive: boolean;
  onClick: () => void;
  /** When set, highlight query-token matches in the label/description. */
  highlightQuery?: string;
  /** Side-rail row: no chevron, the active row is marked with an indigo bar. */
  rail?: boolean;
}

const CHEVRON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

/** One 56px settings row: icon tile, label, one-line hint, chevron. */
export function SettingsCategoryItem({
  category,
  isActive,
  onClick,
  highlightQuery,
  rail = false,
}: SettingsCategoryItemProps) {
  const ref = useRef<HTMLButtonElement>(null);
  // The rail scrolls on its own: bring the open category into view.
  useEffect(() => {
    if (rail && isActive) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [rail, isActive]);
  const classes = [
    "settings-category-item",
    styles.row,
    rail ? styles.rail : "",
    isActive ? `active ${styles.active}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
    >
      <SettingsCategoryIcon id={category.id} />
      <span className={styles.text}>
        <span className={styles.label}>
          {highlightQuery
            ? renderSettingsSearchHighlight(category.label, highlightQuery)
            : category.label}
        </span>
        <span className={styles.hint}>
          {highlightQuery
            ? renderSettingsSearchHighlight(
                category.description,
                highlightQuery,
              )
            : category.description}
        </span>
      </span>
      {rail ? null : <span className={styles.chevron}>{CHEVRON}</span>}
    </button>
  );
}
