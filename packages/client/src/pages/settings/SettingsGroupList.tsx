import type { ReactNode } from "react";
import { useI18n } from "../../i18n";
import { SettingsCategoryItem } from "./SettingsCategoryItem";
import styles from "./SettingsGroupList.module.css";
import type { SettingsGroup } from "./settingsGroups";

/** The card that holds a run of category rows. */
export function SettingsRowCard({ children }: { children: ReactNode }) {
  return <div className={styles.card}>{children}</div>;
}

interface SettingsGroupListProps {
  groups: SettingsGroup[];
  activeId?: string;
  /** Desktop side rail instead of the phone home. */
  rail?: boolean;
  onSelect: (categoryId: string) => void;
  /** Rendered between the ordinary groups and "advanced": backup, transfer. */
  extras?: ReactNode;
}

/**
 * Categories under their group headings. "Advanced & debug" is always last,
 * so the transfer tools (`extras`) sit between the ordinary groups and it.
 */
export function SettingsGroupList({
  groups,
  activeId,
  rail = false,
  onSelect,
  extras,
}: SettingsGroupListProps) {
  const { t } = useI18n();
  const ordinary = groups.filter((group) => group.id !== "advanced");
  const advanced = groups.filter((group) => group.id === "advanced");
  const renderGroup = (group: SettingsGroup) => (
    <section
      key={group.id}
      className={styles.group}
      aria-label={t(group.titleKey)}
    >
      <h2 className={styles.title}>{t(group.titleKey)}</h2>
      <SettingsRowCard>
        {group.categories.map((category) => (
          <SettingsCategoryItem
            key={category.id}
            category={category}
            isActive={activeId === category.id}
            rail={rail}
            onClick={() => onSelect(category.id)}
          />
        ))}
      </SettingsRowCard>
    </section>
  );
  return (
    <div className={rail ? `${styles.list} ${styles.rail}` : styles.list}>
      {ordinary.map(renderGroup)}
      {extras}
      {advanced.map(renderGroup)}
    </div>
  );
}
