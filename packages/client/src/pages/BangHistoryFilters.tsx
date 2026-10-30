import { useDeferredValue, useMemo, useState } from "react";
import { FilterChip } from "../components/controls/FilterChip";
import { SearchField } from "../components/garden/Field";
import { ListToolbar } from "../components/garden/ListToolbar";
import { StatusDot } from "../components/garden/StatusDot";
import { useI18n } from "../i18n";
import { type BangHistoryEntry, isFailedRun } from "./BangCommandsPage.days";

/** Command, working directory, then the saved output previews. */
function matchesQuery(entry: BangHistoryEntry, needle: string): boolean {
  const { command, cwd, stdoutPreview, stderrPreview } = entry.object;
  return [command, cwd, stdoutPreview, stderrPreview].some((text) =>
    text?.toLowerCase().includes(needle),
  );
}

/**
 * Search and failed-only state. The field echoes `query` at once; the list
 * follows a deferred copy so typing never waits for the timeline.
 */
export function useBangHistoryFilter(entries: BangHistoryEntry[] | null) {
  const [query, setQuery] = useState("");
  const [failedOnly, setFailedOnly] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const failedCount = useMemo(
    () => entries?.filter((entry) => isFailedRun(entry.object)).length ?? 0,
    [entries],
  );
  const shown = useMemo(() => {
    if (!entries) return null;
    const needle = deferredQuery.trim().toLowerCase();
    return entries.filter(
      (entry) =>
        (!failedOnly || isFailedRun(entry.object)) &&
        (needle === "" || matchesQuery(entry, needle)),
    );
  }, [entries, deferredQuery, failedOnly]);
  const filtered = deferredQuery.trim() !== "" || failedOnly;
  return {
    query,
    setQuery,
    failedOnly,
    setFailedOnly,
    failedCount,
    shown,
    filtered,
  };
}

type BangHistoryFilter = ReturnType<typeof useBangHistoryFilter>;

/** Design 命令历史 filter row: search, failed only, then the count. */
export function BangHistoryFilters({
  filter,
  total,
}: {
  filter: BangHistoryFilter;
  total: number;
}) {
  const { t } = useI18n();
  return (
    <ListToolbar
      label={t("bangHistoryFilterLabel")}
      search={
        <SearchField
          label={t("bangHistorySearchLabel")}
          placeholder={t("bangHistorySearchPlaceholder")}
          value={filter.query}
          onChange={(event) => filter.setQuery(event.target.value)}
        />
      }
      filters={
        <FilterChip
          pressed={filter.failedOnly}
          disabled={filter.failedCount === 0 && !filter.failedOnly}
          onClick={() => filter.setFailedOnly(!filter.failedOnly)}
        >
          <StatusDot state="err" />
          {t("bangHistoryFailedOnly", { count: filter.failedCount })}
        </FilterChip>
      }
      count={t("bangHistoryShown", {
        shown: filter.shown?.length ?? 0,
        total,
      })}
    />
  );
}
