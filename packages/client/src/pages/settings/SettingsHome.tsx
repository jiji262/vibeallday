import { type ReactNode, useId, useMemo } from "react";
import { Count } from "../../components/garden/Count";
import { StatusDot } from "../../components/garden/StatusDot";
import { PageIntro } from "../../components/shell/PageIntro";
import { pageWidthClass } from "../../components/shell/pageWidth";
import { useFontSize } from "../../hooks/useFontSize";
import { useTheme } from "../../hooks/useTheme";
import { useI18n } from "../../i18n";
import { SettingsGroupList } from "./SettingsGroupList";
import { SettingsHostCard } from "./SettingsHostCard";
import styles from "./SettingsHome.module.css";
import { SettingsQuickControls } from "./SettingsQuickControls";
import type { SettingsGroup } from "./settingsGroups";
import {
  type SettingsAttentionItem,
  useSettingsOverview,
} from "./useSettingsOverview";

/** Real problems only; the card is absent when there are none. */
function AttentionCard({
  items,
  onSelect,
}: {
  items: readonly SettingsAttentionItem[];
  onSelect: (categoryId: string) => void;
}) {
  const { t } = useI18n();
  const titleId = useId();
  if (items.length === 0) return null;
  return (
    <section className={styles.attention} aria-labelledby={titleId}>
      <div className={styles.attentionHead}>
        <h2 className={styles.cardTitle} id={titleId}>
          {t("settingsAttentionTitle")}
        </h2>
        <Count tone="attn">{items.length}</Count>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={styles.attentionRow}
          onClick={() => onSelect(item.categoryId)}
        >
          <StatusDot state="attn" className={styles.attentionDot} />
          <span className={styles.attentionText}>
            <span className={styles.attentionTitle}>{item.title}</span>
            <span className={styles.attentionDetail}>{item.detail}</span>
          </span>
          <span className={styles.attentionAction}>{item.action}</span>
        </button>
      ))}
    </section>
  );
}

interface OverviewBodyProps {
  groups: SettingsGroup[];
  onSelect: (categoryId: string) => void;
  /** Phone only: transfer tools between the groups and Advanced. */
  extras?: ReactNode;
  desktop: boolean;
}

/**
 * Host, quick controls, attention and the categories with their status
 * lines. The only place the overview hooks run: search results replace this
 * component, so a query never subscribes to provider or preference state.
 */
function OverviewBody({
  groups,
  onSelect,
  extras,
  desktop,
}: OverviewBodyProps) {
  // One instance of each browser-local preference, shared by the quick
  // controls and the summaries (these hooks do not sync across mounts).
  const { theme, setTheme } = useTheme();
  const { fontSizePercent, setFontSizePercent } = useFontSize();
  const visibleCategoryIds = useMemo(
    () => groups.flatMap((group) => group.categories.map((c) => c.id)),
    [groups],
  );
  const overview = useSettingsOverview({
    visibleCategoryIds,
    theme,
    fontSizePercent,
  });
  const quick = (
    <SettingsQuickControls
      theme={theme}
      onThemeChange={setTheme}
      fontSizePercent={fontSizePercent}
      onFontSizeChange={setFontSizePercent}
      desktop={desktop}
    />
  );
  const attention = (
    <AttentionCard items={overview.attention} onSelect={onSelect} />
  );
  return (
    <div className={styles.home}>
      <SettingsHostCard />
      {desktop ? (
        <div className={styles.pair}>
          {quick}
          {attention}
        </div>
      ) : (
        <>
          {quick}
          {attention}
        </>
      )}
      <SettingsGroupList
        groups={groups}
        variant={desktop ? "grid" : "list"}
        onSelect={onSelect}
        extras={extras}
        summaries={overview.summaries}
      />
    </div>
  );
}

/** Desktop settings index: the overview in the right panel. */
export function SettingsOverview({
  groups,
  onSelect,
}: {
  groups: SettingsGroup[];
  onSelect: (categoryId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <PageIntro
        title={t("pageTitleSettings")}
        lede={`${t("settingsHomeLede")} ${t("settingsOverviewScopeLede")}`}
      />
      <OverviewBody groups={groups} onSelect={onSelect} desktop />
    </>
  );
}

interface SettingsHomeProps {
  searchBar: ReactNode;
  /** Present while a query is active; replaces everything under the search. */
  searchResults: ReactNode | null;
  groups: SettingsGroup[];
  onSelect: (categoryId: string) => void;
  extras: ReactNode;
}

/** Phone settings home: search, host, quick controls, then grouped categories. */
export function SettingsHome({
  searchBar,
  searchResults,
  groups,
  onSelect,
  extras,
}: SettingsHomeProps) {
  const { t } = useI18n();
  return (
    <div className={`page-content-inner ${pageWidthClass("narrow")}`}>
      <PageIntro
        title={t("pageTitleSettings")}
        lede={t("settingsHomeLede")}
        filters={searchBar}
      />
      {searchResults ?? (
        <OverviewBody
          groups={groups}
          onSelect={onSelect}
          extras={extras}
          desktop={false}
        />
      )}
    </div>
  );
}
