import { useEffect, useRef } from "react";
import { ChevronRightIcon } from "../../components/garden/icons";
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

const CHEVRON_SIZE = 16;

/** One settings row: icon tile, label, one-line hint, chevron. The rail row
 * is a sidebar nav item: bare icon and label, the hint moves to a tooltip. */
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
      title={rail ? category.description : undefined}
    >
      <SettingsCategoryIcon
        id={category.id}
        className={rail ? styles.railIcon : undefined}
      />
      <span className={styles.text}>
        <span className={styles.label}>
          {highlightQuery
            ? renderSettingsSearchHighlight(category.label, highlightQuery)
            : category.label}
        </span>
        {rail ? null : (
          <span className={styles.hint}>
            {highlightQuery
              ? renderSettingsSearchHighlight(
                  category.description,
                  highlightQuery,
                )
              : category.description}
          </span>
        )}
      </span>
      {rail ? null : (
        <ChevronRightIcon size={CHEVRON_SIZE} className={styles.chevron} />
      )}
    </button>
  );
}
