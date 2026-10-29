import type { LaunchSource } from "@vibeallday/shared";
import { FilterDropdown } from "../components/FilterDropdown";
import { SearchField, selectClassName } from "../components/garden/Field";
import { ChevronDownIcon } from "../components/garden/icons";
import { ListToolbar } from "../components/garden/ListToolbar";
import { useI18n } from "../i18n";
import {
  LAUNCH_SOURCE_LABEL_KEYS,
  sortLaunchSources,
} from "../lib/launchSource";
import {
  isProjectSort,
  PROJECT_SORTS,
  type ProjectSort,
} from "../lib/projectListView";
import styles from "./ProjectsPage.module.css";

/** Matches the FilterDropdown trigger chevron beside the sort control. */
const SORT_CHEVRON_SIZE = 12;

interface ProjectsToolbarProps {
  /** The field's own value: set on every keystroke, never deferred. */
  query: string;
  onQueryChange: (query: string) => void;
  sources: readonly LaunchSource[];
  onSourcesChange: (sources: readonly LaunchSource[]) => void;
  /** Projects holding each source, for the source picker's counts. */
  projectCountsBySource: ReadonlyMap<LaunchSource, number>;
  hideAutomationSessions: boolean;
  sort: ProjectSort;
  onSortChange: (sort: ProjectSort) => void;
  shown: number;
  total: number;
}

function SourceFilter({
  sources,
  onSourcesChange,
  projectCountsBySource,
  hideAutomationSessions,
}: Pick<
  ProjectsToolbarProps,
  | "sources"
  | "onSourcesChange"
  | "projectCountsBySource"
  | "hideAutomationSessions"
>) {
  const { t } = useI18n();
  return (
    <FilterDropdown
      label={t("sessionSearchSources")}
      className={styles.pill}
      placeholder={
        hideAutomationSessions
          ? t("sessionSearchSourcesNoAutomation")
          : t("sessionSearchSources")
      }
      options={[
        {
          value: "",
          label: t("sessionSearchSourcesAll"),
          clearSelection: true,
        },
        ...sortLaunchSources(projectCountsBySource.keys()).map((source) => ({
          value: source,
          label: t(LAUNCH_SOURCE_LABEL_KEYS[source]),
          count: projectCountsBySource.get(source),
        })),
      ]}
      selected={[...sources]}
      onChange={(next) => onSourcesChange(next as LaunchSource[])}
    />
  );
}

/**
 * Search, source filter and sort over the loaded project list, with the
 * mono "shown / total" count. Filtering happens in the page behind a
 * deferred value, so the search field echoes each keystroke at once.
 */
export function ProjectsToolbar(props: ProjectsToolbarProps) {
  const { t } = useI18n();
  const { query, onQueryChange, sort, onSortChange, shown, total } = props;
  return (
    <ListToolbar
      label={t("projectsToolbarLabel")}
      className={styles.toolbar}
      search={
        <SearchField
          label={t("projectsSearchLabel")}
          placeholder={t("projectsSearchPlaceholder")}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      }
      filters={
        <>
          <SourceFilter {...props} />
          <span className={styles.sortField}>
            <select
              aria-label={t("projectsSort")}
              className={selectClassName(styles.sort)}
              value={sort}
              onChange={(event) => {
                if (isProjectSort(event.target.value))
                  onSortChange(event.target.value);
              }}
            >
              {PROJECT_SORTS.map((value) => (
                <option key={value} value={value}>
                  {t(`projectsSort_${value}`)}
                </option>
              ))}
            </select>
            <ChevronDownIcon
              size={SORT_CHEVRON_SIZE}
              className={styles.sortChevron}
            />
          </span>
        </>
      }
      count={t("projectsShownCount", { shown, total })}
    />
  );
}
