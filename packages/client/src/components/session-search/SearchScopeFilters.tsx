import {
  ALL_PROVIDERS,
  type LaunchSource,
  type ProviderName,
} from "@vibeallday/shared";
import type { ReactNode } from "react";
import type { GlobalSessionItem } from "../../api/client";
import { useI18n } from "../../i18n";
import {
  LAUNCH_SOURCE_LABEL_KEYS,
  sortLaunchSources,
} from "../../lib/launchSource";
import type { ProjectFilterGroups } from "../../lib/projectFilterOptions";
import { FilterChip } from "../controls/FilterChip";
import { FilterDropdown } from "../FilterDropdown";
import styles from "./SearchFilterSheet.module.css";

/** URL parameters the dropdowns write. */
export type ScopeParam =
  | "project"
  | "provider"
  | "source"
  | "executor"
  | "created";

export interface ScopeFilterProps {
  sessions: readonly GlobalSessionItem[];
  projectGroups: ProjectFilterGroups;
  project: string;
  providers: ProviderName[];
  launchSources: LaunchSource[];
  executors: string[];
  created: string[];
  /** Session counts by machine; the picker appears with two or more. */
  executorCounts: Record<string, number>;
  sourceCounts: ReadonlyMap<LaunchSource, number>;
  automationCount: number;
  hideAutomation: boolean;
  onHideAutomation: (hide: boolean) => void;
  supported: boolean;
  turnSearchProviders: ReadonlySet<ProviderName>;
  creationProvenanceAvailable: boolean;
  onChange: (param: ScopeParam, value: string) => void;
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.field}${wide ? ` ${styles.wide}` : ""}`}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

/** The project dropdown; its sheet section names it. */
export function ProjectFilter(props: ScopeFilterProps) {
  const { t } = useI18n();
  const { projectGroups, onChange } = props;
  return (
    <FilterDropdown
      label={t("sessionSearchProjects")}
      placeholder={t("globalSessionsFilterProjectPlaceholder")}
      fullWidth
      triggerClassName={styles.trigger}
      options={[
        // An explicit first row, so returning to every project is a
        // visible choice rather than a re-click on the current one.
        {
          value: "",
          label: t("globalSessionsFilterProjectPlaceholder"),
          clearSelection: true,
        },
        ...projectGroups.current.map((p) => ({
          value: p.id,
          label: p.name,
        })),
        ...projectGroups.older.map((p, index) => ({
          value: p.id,
          label: p.name,
          groupLabelBefore:
            index === 0 && projectGroups.current.length > 0
              ? t("globalSessionsFilterProjectOlder")
              : undefined,
        })),
      ]}
      selected={props.project ? [props.project] : []}
      onChange={(value) => onChange("project", value[0] ?? "")}
      multiSelect={false}
    />
  );
}

/** Providers present in the catalog, each with its turn-search support. */
export function ProviderFilter(props: ScopeFilterProps) {
  const { t } = useI18n();
  return (
    <FilterDropdown
      label={t("sessionSearchProviders")}
      placeholder={t("globalSessionsProviderAll")}
      fullWidth
      triggerClassName={styles.trigger}
      options={ALL_PROVIDERS.filter((p) =>
        props.sessions.some((s) => s.provider === p),
      ).map((p) => ({
        value: p,
        label: p,
        description: t(
          !props.supported
            ? "sessionSearchProviderUpgrade"
            : props.turnSearchProviders.has(p)
              ? "sessionSearchProviderBounded"
              : "sessionSearchProviderTitleOnly",
        ),
      }))}
      selected={props.providers}
      onChange={(value) => props.onChange("provider", value.join(","))}
    />
  );
}

/** Launch source, creation surface, machine and the automation toggle. */
export function SourceFilters(props: ScopeFilterProps) {
  const { t } = useI18n();
  const { onChange } = props;
  return (
    <div className={styles.fields}>
      <Field label={t("sessionSearchSources")}>
        <FilterDropdown
          label={t("sessionSearchSources")}
          placeholder={t("sessionSearchSourcesAll")}
          fullWidth
          triggerClassName={styles.trigger}
          options={[
            {
              value: "",
              label: t("sessionSearchSourcesAll"),
              clearSelection: true,
            },
            ...sortLaunchSources(props.sourceCounts.keys()).map((source) => ({
              value: source,
              label: t(LAUNCH_SOURCE_LABEL_KEYS[source]),
              count: props.sourceCounts.get(source),
            })),
          ]}
          selected={props.launchSources}
          onChange={(value) => onChange("source", value.join(","))}
        />
      </Field>
      {props.creationProvenanceAvailable && (
        <Field label={t("sessionSearchCreatedFrom")}>
          <FilterDropdown
            label={t("sessionSearchCreatedFrom")}
            placeholder={t("sessionSearchCreatedFromPlaceholder")}
            fullWidth
            triggerClassName={styles.trigger}
            options={[
              { value: "web", label: t("sessionSearchCreatedWeb") },
              { value: "desktop", label: t("sessionSearchCreatedDesktop") },
              {
                value: "unspecified",
                label: t("sessionSearchCreatedUnspecified"),
              },
            ]}
            selected={props.created}
            onChange={(value) => onChange("created", value.join(","))}
          />
        </Field>
      )}
      {Object.keys(props.executorCounts).length > 1 && (
        <Field label={t("globalSessionsFilterExecutor")}>
          <FilterDropdown
            label={t("globalSessionsFilterExecutor")}
            placeholder={t("globalSessionsFilterMachinePlaceholder")}
            fullWidth
            triggerClassName={styles.trigger}
            options={Object.keys(props.executorCounts).map((value) => ({
              value,
              label: value,
            }))}
            selected={props.executors}
            onChange={(value) => onChange("executor", value.join(","))}
          />
        </Field>
      )}
      {!props.launchSources.length && props.automationCount > 0 && (
        <div className={`${styles.field} ${styles.wide}`}>
          <FilterChip
            pressed={props.hideAutomation}
            title={t("sessionSearchHideAutomationHelp")}
            onClick={() => props.onHideAutomation(!props.hideAutomation)}
          >
            {t("sessionSearchHideAutomation", {
              count: props.automationCount,
            })}
          </FilterChip>
        </div>
      )}
    </div>
  );
}
