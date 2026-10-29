import type { ReactNode } from "react";
import { PageIntro } from "../../components/shell/PageIntro";
import { pageWidthClass } from "../../components/shell/pageWidth";
import { useI18n } from "../../i18n";
import { SettingsGroupList } from "./SettingsGroupList";
import { SettingsHostCard } from "./SettingsHostCard";
import styles from "./SettingsHome.module.css";
import { SettingsQuickControls } from "./SettingsQuickControls";
import type { SettingsGroup } from "./settingsGroups";

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
      <div className={styles.home}>
        {searchResults ?? (
          <>
            <SettingsHostCard />
            <SettingsQuickControls />
            <SettingsGroupList
              groups={groups}
              onSelect={onSelect}
              extras={extras}
            />
          </>
        )}
      </div>
    </div>
  );
}
