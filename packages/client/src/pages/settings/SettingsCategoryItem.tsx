import { useEffect, useRef } from "react";
import { ChevronRightIcon } from "../../components/garden/icons";
import { StatusDot } from "../../components/garden/StatusDot";
import { useI18n } from "../../i18n";
import { SettingsCategoryIcon } from "./SettingsCategoryIcons";
import styles from "./SettingsCategoryItem.module.css";
import { renderSettingsSearchHighlight } from "./SettingsSearchContext";
import type { SettingsCategorySummary } from "./useSettingsOverview";
import type { SettingsCategory } from "./types";

export interface SettingsCategoryItemProps {
  category: SettingsCategory;
  isActive: boolean;
  onClick: () => void;
  /** When set, highlight query-token matches in the label/description. */
  highlightQuery?: string;
  /** Side-rail row: no hint or chevron; the active row is raised. */
  rail?: boolean;
  /** Status line shown instead of the description (overview only). */
  summary?: SettingsCategorySummary;
  /** Rail: mark the row as needing attention. */
  attention?: boolean;
}

const CHEVRON_SIZE = 16;

function hintText(
  category: SettingsCategory,
  summary: SettingsCategorySummary | undefined,
  highlightQuery: string | undefined,
) {
  if (summary) {
    return summary.attn ? (
      <>
        {summary.text} · <span className={styles.attn}>{summary.attn}</span>
      </>
    ) : (
      summary.text
    );
  }
  return highlightQuery
    ? renderSettingsSearchHighlight(category.description, highlightQuery)
    : category.description;
}

/** One settings row: icon tile, label, one-line hint, chevron. The rail row
 * is a compact nav item: icon and label, the hint moves to a tooltip. */
export function SettingsCategoryItem({
  category,
  isActive,
  onClick,
  highlightQuery,
  rail = false,
  summary,
  attention = false,
}: SettingsCategoryItemProps) {
  const { t } = useI18n();
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
      <SettingsCategoryIcon id={category.id} className={styles.icon} />
      <span className={styles.text}>
        <span className={styles.label}>
          {highlightQuery
            ? renderSettingsSearchHighlight(category.label, highlightQuery)
            : category.label}
        </span>
        {rail ? null : (
          <span className={styles.hint}>
            {hintText(category, summary, highlightQuery)}
          </span>
        )}
      </span>
      {rail && attention ? (
        <StatusDot
          state="attn"
          label={t("settingsRailNeedsAttention")}
          className={styles.dot}
        />
      ) : null}
      {rail ? null : (
        <ChevronRightIcon size={CHEVRON_SIZE} className={styles.chevron} />
      )}
    </button>
  );
}
