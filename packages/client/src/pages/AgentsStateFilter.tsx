import { type MessageKey, useI18n } from "../i18n";
import styles from "./AgentsStateFilter.module.css";

export type ProcessSectionKey = "active" | "external" | "idle" | "stopped";
export type ProcessStateFilter = "all" | ProcessSectionKey;

const CHIPS: Array<{
  value: ProcessSectionKey;
  label: MessageKey;
}> = [
  { value: "active", label: "agentsSectionActive" },
  { value: "idle", label: "agentsSectionIdle" },
  { value: "stopped", label: "agentsSectionStopped" },
  { value: "external", label: "agentsSectionExternal" },
];

function dotClassFor(section: ProcessSectionKey, count: number) {
  switch (section) {
    case "active":
      return count > 0 ? styles.dotRunLive : styles.dotRun;
    case "idle":
      return styles.dotIdle;
    case "stopped":
      return styles.dotStopped;
    case "external":
      return styles.dotAttn;
  }
}

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
 * Studio segmented state pills: all, then one per section with its count.
 * A second press on an active section pill returns to all.
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
  const allPressed = value === "all";
  return (
    <div
      role="group"
      aria-label={t("agentsStateFilterLabel")}
      className={styles.segmented}
    >
      <button
        type="button"
        aria-pressed={allPressed}
        className={`${styles.pill} ${allPressed ? styles.pillActive : ""}`}
        onClick={() => onChange("all")}
      >
        <span className={styles.pillLabel}>{t("agentsStateAll")}</span>{" "}
        <span
          className={`${styles.pillCount} ${allPressed ? styles.pillCountActive : ""}`}
        >
          {total}
        </span>
      </button>
      {chips.map((chip) => {
        const pressed = value === chip.value;
        const count = counts[chip.value];
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={pressed}
            className={`${styles.pill} ${pressed ? styles.pillActive : ""}`}
            onClick={() => onChange(pressed ? "all" : chip.value)}
          >
            <span
              className={`${styles.dot} ${dotClassFor(chip.value, count)}`}
              aria-hidden="true"
            />
            <span className={styles.pillLabel}>{t(chip.label)}</span>{" "}
            <span
              className={`${styles.pillCount} ${pressed ? styles.pillCountActive : ""}`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
