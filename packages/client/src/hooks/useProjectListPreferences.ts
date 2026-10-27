import type { LaunchSource } from "@vibeallday/shared";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { parseLaunchSourceParam } from "../lib/launchSource";
import { createLocalStorageValue } from "../lib/localStorageValue";
import { isProjectSort, type ProjectSort } from "../lib/projectListView";
import { UI_KEYS } from "../lib/storageKeys";

const sortStore = createLocalStorageValue<ProjectSort>(
  UI_KEYS.projectListSort,
  "recent",
  (raw) => (isProjectSort(raw) ? raw : undefined),
);
// Comma-separated, the same shape as All Sessions' `source=` parameter.
const sourcesStore = createLocalStorageValue<string>(
  UI_KEYS.projectListSources,
  "",
  (raw) => raw,
);

/** The project list's sort and source picks, remembered per device. */
export function useProjectListPreferences() {
  const sort = useSyncExternalStore(
    sortStore.subscribe,
    sortStore.read,
    sortStore.read,
  );
  const rawSources = useSyncExternalStore(
    sourcesStore.subscribe,
    sourcesStore.read,
    sourcesStore.read,
  );
  const sources = useMemo(
    () => parseLaunchSourceParam(rawSources),
    [rawSources],
  );
  const setSources = useCallback(
    (next: readonly LaunchSource[]) => sourcesStore.set(next.join(",")),
    [],
  );
  return { sort, setSort: sortStore.set, sources, setSources };
}
