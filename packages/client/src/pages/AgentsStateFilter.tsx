import { FilterChip } from "../components/controls/FilterChip";
import { Count } from "../components/garden/Count";
import { StatusDot, type StatusState } from "../components/garden/StatusDot";
import { type MessageKey, useI18n } from "../i18n";
import styles from "./AgentsStateFilter.module.css";

export type ProcessSectionKey = "active" | "external" | "idle" | "stopped";
export type ProcessStateFilter = "all" | ProcessSectionKey;

const CHIPS: Array<{
  value: ProcessSectionKey;
  label: MessageKey;
  state: StatusState;
}> = [
  { value: "active", label: "agentsSectionActive", state: "run" },
  { value: "idle", label: "agentsSectionIdle", state: "idle" },
  { value: "stopped", label: "agentsSectionStopped", state: "queued" },
  { value: "external", label: "agentsSectionExternal", state: "attn" },
];

/** Whether a section shows under the chosen chip. */
export function showsSection(
  filter: ProcessStateFilter,
  section: ProcessSectionKey,
): boolean {
  return filter === "all" || filter === section;
}

/** The chosen chip, or all once its section is gone (host observation off). */
export function effectiveStateFilter(
  filter: ProcessStateFilter,
  external: boolean,
): ProcessStateFilter {
  return filter === "external" && !external ? "all" : filter;
}

/** Each section's row count. */
export function sectionCounts(
  groups: Record<ProcessSectionKey, readonly unknown[]>,
): Record<ProcessSectionKey, number> {
  return {
    active: groups.active.length,
    external: groups.external.length,
    idle: groups.idle.length,
    stopped: groups.stopped.length,
  };
}

/** Rows the chosen chip leaves on screen. */
export function countShown(
  filter: ProcessStateFilter,
  counts: Record<ProcessSectionKey, number>,
): number {
  return CHIPS.filter((chip) => showsSection(filter, chip.value)).reduce(
    (sum, chip) => sum + counts[chip.value],
    0,
  );
}

/**
 * Design 进程 state chips: all, then one per section with its count. A
 * second press on a chip returns to all.
 */
export function AgentsStateFilter({
  value,
  onChange,
  counts,
  external,
}: {
  value: ProcessStateFilter;
  onChange: (value: ProcessStateFilter) => void;
  counts: Record<ProcessSectionKey, number>;
  /** Host observation is on, so the external section exists. */
  external: boolean;
}) {
  const { t } = useI18n();
  const chips = CHIPS.filter((chip) => external || chip.value !== "external");
  const total = chips.reduce((sum, chip) => sum + counts[chip.value], 0);
  return (
    <div
      role="group"
      aria-label={t("agentsStateFilterLabel")}
      className={styles.chips}
    >
      <FilterChip pressed={value === "all"} onClick={() => onChange("all")}>
        {t("agentsStateAll")}
        <Count>{total}</Count>
      </FilterChip>
      {chips.map((chip) => (
        <FilterChip
          key={chip.value}
          pressed={value === chip.value}
          onClick={() => onChange(value === chip.value ? "all" : chip.value)}
        >
          <StatusDot state={chip.state} />
          {t(chip.label)}
          <Count>{counts[chip.value]}</Count>
        </FilterChip>
      ))}
    </div>
  );
}
