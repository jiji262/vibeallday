import { useI18n } from "../../i18n";
import type {
  ActivityFilter,
  QuickCounts,
  SearchField,
  SearchStatus,
} from "./model";
import { SearchHeader } from "./SearchControls";
import { SearchStatusLine } from "./SearchStatusLine";
import {
  FiltersButton,
  QuickChips,
  SearchScope,
  SelectModeButton,
} from "./SearchToolbar";
import styles from "./SearchToolbar.module.css";

type Translate = ReturnType<typeof useI18n>["t"];

interface ScanProgress {
  running: boolean;
  scanned: number;
  limited: number;
  /** Turn-searchable candidates the scan walks. */
  total: number;
  /** The catalog itself is still arriving. */
  catalogLoading: boolean;
}

/** The longer sentence behind the toolbar's "in N sessions" count. */
export function searchStatusText(scan: ScanProgress, t: Translate): string {
  if (scan.running)
    return t("sessionSearchProgress", {
      count: scan.scanned,
      total: scan.total,
    });
  if (scan.limited) return t("sessionSearchCapped", { count: scan.limited });
  if (scan.catalogLoading) return t("sessionSearchLoadingCatalog");
  return t("sessionSearchWatching");
}

interface SessionsToolbarProps {
  query: string;
  onQuery: (value: string) => void;
  fields: SearchField[];
  onFields: (value: SearchField[]) => void;
  supported: boolean;
  supportKnown: boolean;
  statuses: SearchStatus[];
  onStatuses: (next: SearchStatus[]) => void;
  activity: ActivityFilter[];
  onActivity: (next: ActivityFilter[]) => void;
  quickCounts: QuickCounts;
  sessionCount: number;
  scanning: boolean;
  acquiring: boolean;
  status: string;
  activeFilterCount: number;
  onOpenFilters: () => void;
  selecting: boolean;
  onSelecting: (next: boolean) => void;
}

/**
 * The Sessions list toolbar. First row: the needle field and the 标题 | 内容
 * scope. Second row: quick chips, Filters, then the mono scope count and
 * Select. The needle owns its keystroke echo and keeps its place in the tree.
 */
export function SessionsToolbar(props: SessionsToolbarProps) {
  const { t } = useI18n();
  return (
    <div
      className={styles.toolbar}
      role="search"
      aria-label={t("sessionSearchToolbarLabel")}
    >
      <div className={styles.searchRow}>
        <SearchHeader
          query={props.query}
          onQuery={props.onQuery}
          onFields={props.onFields}
          supported={props.supported}
          supportKnown={props.supportKnown}
        />
        <SearchScope
          fields={props.fields}
          supported={props.supported}
          onFields={props.onFields}
        />
      </div>
      <div className={styles.filterRow}>
        <QuickChips
          statuses={props.statuses}
          onStatuses={props.onStatuses}
          activity={props.activity}
          onActivity={props.onActivity}
          counts={props.quickCounts}
        />
        <span className={styles.divider} aria-hidden="true" />
        <FiltersButton
          count={props.activeFilterCount}
          onClick={props.onOpenFilters}
        />
        <div className={styles.end}>
          <SearchStatusLine
            sessionCount={props.sessionCount}
            scanning={props.scanning}
            acquiring={props.acquiring}
            status={props.status}
          />
          <SelectModeButton
            selecting={props.selecting}
            onSelecting={props.onSelecting}
          />
        </div>
      </div>
    </div>
  );
}
