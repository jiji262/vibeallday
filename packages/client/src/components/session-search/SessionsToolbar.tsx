import { useI18n } from "../../i18n";
import { ListToolbar } from "../garden/ListToolbar";
import type { SearchField, SearchStatus } from "./model";
import { SearchHeader } from "./SearchControls";
import { SearchStatusLine } from "./SearchStatusLine";
import { FiltersButton, SearchChips, SelectModeButton } from "./SearchToolbar";

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
  onFields: (value: SearchField[]) => void;
  supported: boolean;
  supportKnown: boolean;
  statuses: SearchStatus[];
  onStatuses: (next: SearchStatus[]) => void;
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
 * The Sessions list toolbar: needle field, status chips, the mono scope
 * count, then Filters and Select. The needle owns its keystroke echo.
 */
export function SessionsToolbar(props: SessionsToolbarProps) {
  const { t } = useI18n();
  return (
    <ListToolbar
      label={t("sessionSearchToolbarLabel")}
      search={
        <SearchHeader
          query={props.query}
          onQuery={props.onQuery}
          onFields={props.onFields}
          supported={props.supported}
          supportKnown={props.supportKnown}
        />
      }
      filters={
        <SearchChips filters={props.statuses} onFilters={props.onStatuses} />
      }
      count={
        <SearchStatusLine
          sessionCount={props.sessionCount}
          scanning={props.scanning}
          acquiring={props.acquiring}
          status={props.status}
        />
      }
      actions={
        <>
          <FiltersButton
            count={props.activeFilterCount}
            onClick={props.onOpenFilters}
          />
          <SelectModeButton
            selecting={props.selecting}
            onSelecting={props.onSelecting}
          />
        </>
      }
    />
  );
}
