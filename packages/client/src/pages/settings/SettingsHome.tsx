import { type ReactNode, useId, useMemo } from "react";
import { ChevronRightIcon } from "../../components/garden/icons";
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
  type SettingsCategorySummary,
  useSettingsOverview,
} from "./useSettingsOverview";

function CategoryGlyph({ categoryId }: { categoryId: string }) {
  switch (categoryId) {
    case "appearance":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M3 12h2M19 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case "providers":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="6" rx="1.5" />
          <rect x="3" y="14" width="18" height="6" rx="1.5" />
          <path d="M7 7h.01M7 17h.01" />
        </svg>
      );
    case "model":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
          <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
        </svg>
      );
    case "remote":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 0 0 0 18M12 3a14.5 14.5 0 0 1 0 18" />
        </svg>
      );
    case "source-control":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="8" r="2.5" />
          <circle cx="6" cy="18" r="2.5" />
          <path d="M6 8.5v7M18 10.5c0 4-3.5 5.5-9.5 5.5" />
        </svg>
      );
    case "storage":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <ellipse cx="12" cy="6" rx="8" ry="3" />
          <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
          <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
        </svg>
      );
    case "about":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      );
    default:
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      );
  }
}

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

function DesktopCategoryGroups({
  groups,
  summaries,
  onSelect,
}: {
  groups: SettingsGroup[];
  summaries: Readonly<Record<string, SettingsCategorySummary>>;
  onSelect: (categoryId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.groupStack}>
      {groups.map((group) => {
        if (group.categories.length === 0) return null;
        return (
          <section key={group.id} className={styles.groupSection}>
            <div className={styles.groupHeader}>
              <h2 className={styles.groupHeading}>{t(group.titleKey)}</h2>
              <span className={styles.groupCount}>
                {group.categories.length}
              </span>
            </div>
            <div className={styles.categoryGrid}>
              {group.categories.map((category) => {
                const summary = summaries[category.id];
                const summaryText = summary
                  ? summary.attn
                    ? `${summary.text} · ${summary.attn}`
                    : summary.text
                  : null;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={styles.categoryCard}
                    onClick={() => onSelect(category.id)}
                  >
                    <span className={styles.categoryIconWell}>
                      <CategoryGlyph categoryId={category.id} />
                    </span>
                    <span className={styles.categoryContent}>
                      <span className={styles.categoryTopRow}>
                        <span className={styles.categoryLabel}>
                          {category.label}
                        </span>
                        {summaryText ? (
                          <span className={styles.statusPill}>
                            {summaryText}
                          </span>
                        ) : null}
                      </span>
                      {category.description ? (
                        <span className={styles.categoryDescription}>
                          {category.description}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRightIcon
                      size={15}
                      className={styles.categoryChevron}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
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
      {desktop ? (
        <DesktopCategoryGroups
          groups={groups}
          summaries={overview.summaries}
          onSelect={onSelect}
        />
      ) : (
        <SettingsGroupList
          groups={groups}
          variant="list"
          onSelect={onSelect}
          extras={extras}
          summaries={overview.summaries}
        />
      )}
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
  /**
   * False until the acting principal resolves: only search and host show,
   * so the overview hooks never send requests a limited user is refused.
   */
  overviewReady: boolean;
}

/** Phone settings home: search, host, quick controls, then grouped categories. */
export function SettingsHome({
  searchBar,
  searchResults,
  groups,
  onSelect,
  extras,
  overviewReady,
}: SettingsHomeProps) {
  const { t } = useI18n();
  return (
    <div className={`page-content-inner ${pageWidthClass("narrow")}`}>
      <PageIntro
        title={t("pageTitleSettings")}
        lede={t("settingsHomeLede")}
        filters={searchBar}
      />
      {searchResults ??
        (overviewReady ? (
          <OverviewBody
            groups={groups}
            onSelect={onSelect}
            extras={extras}
            desktop={false}
          />
        ) : (
          <div className={styles.home}>
            <SettingsHostCard />
          </div>
        ))}
    </div>
  );
}
