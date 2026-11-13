import { type ComponentProps, type ReactNode, useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeftIcon, OverviewIcon } from "../../components/garden/icons";
import { DEFAULT_UI_FONT_SCALE_PERCENT } from "../../hooks/useFontSize";
import { useRemoteBasePath } from "../../hooks/useRemoteBasePath";
import { useI18n } from "../../i18n";
import catStyles from "./SettingsCategoryItem.module.css";
import { SettingsGroupList } from "./SettingsGroupList";
import { SettingsHostCard } from "./SettingsHostCard";
import styles from "./SettingsLayout.module.css";
import type { SettingsGroup } from "./settingsGroups";
import { useSettingsOverview } from "./useSettingsOverview";

const BACK_ICON_SIZE = 16;
const OVERVIEW_ICON_SIZE = 15;
// The only category the overview can flag today (providers waiting on sign-in).
const ATTENTION_CATEGORY_IDS = ["providers"];

interface SettingsLayoutRailProps {
  searchBar: ReactNode;
  groups: SettingsGroup[];
  /** Open category id; undefined on the overview. */
  activeId?: string;
  /** True on the overview (the settings index). */
  overviewActive: boolean;
  searchActive: boolean;
  onSelect: (categoryId: string) => void;
  onOverview: () => void;
  extras: ReactNode;
}

/** The rail's first entry: the settings overview. */
function OverviewEntry({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const classes = [
    "settings-category-item",
    catStyles.row,
    catStyles.rail,
    styles.overviewEntry,
    active ? `active ${catStyles.active}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span className={`${catStyles.icon} ${styles.overviewIcon}`}>
        <OverviewIcon size={OVERVIEW_ICON_SIZE} />
      </span>
      <span className={catStyles.text}>
        <span className={catStyles.label}>{t("settingsOverviewTitle")}</span>
      </span>
    </button>
  );
}

type RailListProps = ComponentProps<typeof SettingsGroupList> & {
  searchActive: boolean;
};

/**
 * The rail's categories with the overview's attention dots (design `.dot.attn`
 * on the row and its group). Mounted only when a flaggable category is
 * visible, so a principal who cannot open it never asks for its state; the
 * dots step aside while a search query is active.
 */
function AttentionRailList({ searchActive, ...props }: RailListProps) {
  const overview = useSettingsOverview({
    visibleCategoryIds: ATTENTION_CATEGORY_IDS,
    // Only the appearance summary reads these, and it is not requested.
    theme: "auto",
    fontSizePercent: DEFAULT_UI_FONT_SCALE_PERCENT,
  });
  const attentionIds = useMemo(
    () => new Set(overview.attention.map((item) => item.categoryId)),
    [overview.attention],
  );
  return (
    <SettingsGroupList
      {...props}
      attentionIds={searchActive ? undefined : attentionIds}
    />
  );
}

/**
 * Desktop settings rail (design `.side`): it replaces the app sidebar, so it
 * leads with a way back to the app, then host, search and the categories.
 */
export function SettingsLayoutRail({
  searchBar,
  groups,
  activeId,
  overviewActive,
  searchActive,
  onSelect,
  onOverview,
  extras,
}: SettingsLayoutRailProps) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const watchesAttention = groups.some((group) =>
    group.categories.some((c) => ATTENTION_CATEGORY_IDS.includes(c.id)),
  );
  const list: ComponentProps<typeof SettingsGroupList> = {
    groups,
    variant: "rail",
    activeId: searchActive ? undefined : activeId,
    expandAll: searchActive,
    onSelect,
    extras,
  };
  return (
    <aside className={styles.rail} aria-label={t("pageTitleSettings")}>
      <Link to={`${basePath}/inbox`} className={styles.back}>
        <ChevronLeftIcon size={BACK_ICON_SIZE} />
        {t("shellNavBackToApp")}
      </Link>
      <div className={styles.railHead}>
        <p className={styles.railTitle}>{t("pageTitleSettings")}</p>
        <SettingsHostCard compact />
        {searchBar}
      </div>
      <nav
        className={`settings-category-nav ${styles.nav}`}
        aria-label={t("settingsCategoryNavLabel")}
      >
        <OverviewEntry
          active={overviewActive && !searchActive}
          onClick={onOverview}
        />
        {watchesAttention ? (
          <AttentionRailList {...list} searchActive={searchActive} />
        ) : (
          <SettingsGroupList {...list} />
        )}
      </nav>
    </aside>
  );
}
