import type { ReactNode } from "react";
import { type MessageKey, useI18n } from "../../i18n";
import { FilterChip } from "../controls/FilterChip";
import { SegmentedControl } from "../controls/SegmentedControl";
import { StatusDot } from "../garden/StatusDot";
import {
  type ActivityFilter,
  type SearchStatus,
  toggleActivity,
  toggleStatus,
} from "./model";
import styles from "./SearchFilterSheet.module.css";

/** Each pair is mutually exclusive but may be switched off together. */
const STATUS_PAIRS: readonly (readonly [SearchStatus, SearchStatus])[] = [
  ["archived", "unarchived"],
  ["starred", "unstarred"],
  ["unread", "read"],
];

/** One labelled group of the Filters sheet. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={styles.section}>
      <legend className={styles.sectionTitle}>{title}</legend>
      {children}
    </fieldset>
  );
}

interface StatusFiltersProps {
  statuses: SearchStatus[];
  onStatuses: (next: SearchStatus[]) => void;
  activity: ActivityFilter[];
  onActivity: (next: ActivityFilter[]) => void;
}

/** Chip labels of the live-state quick filters. */
export const ACTIVITY_LABELS = {
  attention: "sessionsChipNeedsYou",
  running: "sessionsChipRunning",
} as const satisfies Record<ActivityFilter, MessageKey>;

const ACTIVITY_CHIPS: readonly {
  filter: ActivityFilter;
  state: "attn" | "run";
}[] = [
  { filter: "attention", state: "attn" },
  { filter: "running", state: "run" },
];

/** Live-state chips, then the archived / starred / unread pairs. */
export function StatusFilters({
  statuses,
  onStatuses,
  activity,
  onActivity,
}: StatusFiltersProps) {
  const { t } = useI18n();
  return (
    <Section title={t("sessionsFilterStatus")}>
      <div className={styles.chipRow}>
        {ACTIVITY_CHIPS.map(({ filter, state }) => (
          <FilterChip
            key={filter}
            pressed={activity.includes(filter)}
            onClick={() => onActivity(toggleActivity(activity, filter))}
          >
            <StatusDot state={state} />
            {t(ACTIVITY_LABELS[filter])}
          </FilterChip>
        ))}
      </div>
      <div className={styles.statusList}>
        {STATUS_PAIRS.map((pair) => (
          <SegmentedControl<SearchStatus>
            key={pair[0]}
            label={pair.map((s) => t(`sessionSearchStatus_${s}`)).join(" / ")}
            value={pair.find((s) => statuses.includes(s)) ?? null}
            onChange={(status) => onStatuses(toggleStatus(statuses, status))}
            options={pair.map((status) => ({
              value: status,
              label: t(`sessionSearchStatus_${status}`),
              ariaLabel: t("sessionSearchStatusFilter", {
                status: t(`sessionSearchStatus_${status}`),
              }),
            }))}
          />
        ))}
      </div>
    </Section>
  );
}
