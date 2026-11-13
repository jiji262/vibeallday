import { type ReactNode, useEffect, useId, useState } from "react";
import { ChevronRightIcon } from "../../components/garden/icons";
import { StatusDot } from "../../components/garden/StatusDot";
import { useI18n } from "../../i18n";
import { SettingsCategoryIcon } from "./SettingsCategoryIcons";
import { SettingsCategoryItem } from "./SettingsCategoryItem";
import styles from "./SettingsGroupList.module.css";
import type { SettingsGroup } from "./settingsGroups";
import { useSettingsRailGroups } from "./useSettingsRailGroups";
import type { SettingsCategorySummary } from "./useSettingsOverview";

const ADVANCED_GROUP_ID = "advanced";
const CHEVRON_SIZE = 16;

/** The card that holds a run of category rows. */
export function SettingsRowCard({ children }: { children: ReactNode }) {
  return <div className={styles.card}>{children}</div>;
}

interface SettingsGroupListProps {
  groups: SettingsGroup[];
  activeId?: string;
  /**
   * `rail`: desktop settings rail, collapsible groups. `list`: phone home,
   * Advanced folded into one row. `grid`: desktop overview cards.
   */
  variant?: "rail" | "list" | "grid";
  onSelect: (categoryId: string) => void;
  /** Rendered between the ordinary groups and "advanced": backup, transfer. */
  extras?: ReactNode;
  /** Overview status lines per category id. */
  summaries?: Readonly<Record<string, SettingsCategorySummary>>;
  /** Category ids that need attention (rail dots). */
  attentionIds?: ReadonlySet<string>;
  /** Rail: show every group open (while a search query is active). */
  expandAll?: boolean;
}

type RowsProps = Pick<
  SettingsGroupListProps,
  "activeId" | "onSelect" | "summaries" | "attentionIds"
> & { group: SettingsGroup; rail?: boolean };

function GroupRows({
  group,
  activeId,
  onSelect,
  summaries,
  attentionIds,
  rail = false,
}: RowsProps) {
  return group.categories.map((category) => (
    <SettingsCategoryItem
      key={category.id}
      category={category}
      isActive={activeId === category.id}
      rail={rail}
      summary={summaries?.[category.id]}
      attention={attentionIds?.has(category.id)}
      onClick={() => onSelect(category.id)}
    />
  ));
}

/** Phone and overview: an eyebrow heading over a card of rows. */
function GroupCard(props: RowsProps) {
  const { t } = useI18n();
  const title = t(props.group.titleKey);
  return (
    <section className={styles.group} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      <SettingsRowCard>
        <GroupRows {...props} />
      </SettingsRowCard>
    </section>
  );
}

/** Phone: "Advanced & debug" folds into one entry row until opened. */
function FoldedGroup(props: RowsProps) {
  const { t } = useI18n();
  const listId = useId();
  const holdsActive = props.group.categories.some(
    (category) => category.id === props.activeId,
  );
  const [open, setOpen] = useState(holdsActive);
  const hint = props.group.categories.map((c) => c.label).join(" · ");
  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.foldToggle}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <SettingsCategoryIcon id="development" className={styles.foldIcon} />
        <span className={styles.foldText}>
          <span className={styles.foldName}>{t(props.group.titleKey)}</span>
          <span className={styles.foldHint}>{hint}</span>
        </span>
        <ChevronRightIcon size={CHEVRON_SIZE} className={styles.foldChevron} />
      </button>
      <div id={listId} className={styles.foldList} hidden={!open}>
        <GroupRows {...props} />
      </div>
    </div>
  );
}

interface RailGroupProps extends RowsProps {
  open: boolean;
  onToggle: () => void;
}

/** Rail: a disclosure header (label, attention dot, count) over its rows. */
function RailGroup({ open, onToggle, ...rows }: RailGroupProps) {
  const { t } = useI18n();
  const listId = useId();
  const title = t(rows.group.titleKey);
  const count = rows.group.categories.length;
  const needsAttention = rows.group.categories.some((c) =>
    rows.attentionIds?.has(c.id),
  );
  return (
    <section className={styles.railGroup} aria-label={title}>
      <button
        type="button"
        className={styles.railToggle}
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
      >
        <span className={styles.railLabel}>{title}</span>
        {needsAttention ? (
          <StatusDot state="attn" label={t("settingsRailNeedsAttention")} />
        ) : null}
        <span className={styles.railCount} aria-hidden="true">
          {count}
        </span>
      </button>
      <div id={listId} className={styles.railRows} hidden={!open}>
        <GroupRows {...rows} rail />
      </div>
    </section>
  );
}

function RailGroups({
  groups,
  expandAll = false,
  extras,
  ...rows
}: SettingsGroupListProps) {
  const { collapsed, toggle, expand } = useSettingsRailGroups();
  const activeGroup = groups.find((group) =>
    group.categories.some((category) => category.id === rows.activeId),
  )?.id;
  // Opening a category inside a collapsed group opens that group, so the
  // open category is always in view.
  useEffect(() => {
    if (activeGroup) expand(activeGroup);
  }, [activeGroup, expand]);
  const render = (group: SettingsGroup) => (
    <RailGroup
      key={group.id}
      {...rows}
      group={group}
      open={expandAll || !collapsed.has(group.id)}
      onToggle={() => toggle(group.id)}
    />
  );
  return (
    <div className={`${styles.list} ${styles.rail}`}>
      {groups.filter((g) => g.id !== ADVANCED_GROUP_ID).map(render)}
      {extras}
      {groups.filter((g) => g.id === ADVANCED_GROUP_ID).map(render)}
    </div>
  );
}

/**
 * Categories under their group headings. "Advanced & debug" is always last,
 * so the transfer tools (`extras`) sit between the ordinary groups and it.
 */
export function SettingsGroupList(props: SettingsGroupListProps) {
  const { groups, variant = "list", extras, ...rows } = props;
  if (variant === "rail") return <RailGroups {...props} />;
  const ordinary = groups.filter((group) => group.id !== ADVANCED_GROUP_ID);
  const advanced = groups.filter((group) => group.id === ADVANCED_GROUP_ID);
  if (variant === "grid") {
    return (
      <div className={styles.grid}>
        {groups.map((group) => (
          <GroupCard key={group.id} {...rows} group={group} />
        ))}
      </div>
    );
  }
  return (
    <div className={styles.list}>
      {ordinary.map((group) => (
        <GroupCard key={group.id} {...rows} group={group} />
      ))}
      {extras}
      {advanced.map((group) => (
        <FoldedGroup key={group.id} {...rows} group={group} />
      ))}
    </div>
  );
}
