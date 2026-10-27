import type { ReactNode } from "react";
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
  return (
    <div className={`page-content-inner ${styles.home}`}>
      {searchBar}
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
  );
}
