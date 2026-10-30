import { useCallback, useSyncExternalStore } from "react";
import { createLocalStorageValue } from "../../lib/localStorageValue";
import { UI_KEYS } from "../../lib/storageKeys";

export const INSPECTOR_TABS = [
  "changes",
  "plan",
  "context",
  "children",
] as const;
export type InspectorTab = (typeof INSPECTOR_TABS)[number];

/** Browser-local inspector preferences; they never reach the server. */
const OPEN_KEY = UI_KEYS.sessionInspectorOpen;
const TAB_KEY = UI_KEYS.sessionInspectorTab;

/** Docked open on wide screens until the reader closes it (design board). */
const OPEN_BY_DEFAULT = true;

const openStore = createLocalStorageValue<boolean>(
  OPEN_KEY,
  OPEN_BY_DEFAULT,
  (raw) => (raw === "true" ? true : raw === "false" ? false : undefined),
);

const tabStore = createLocalStorageValue<string>(TAB_KEY, "changes", (raw) =>
  (INSPECTOR_TABS as readonly string[]).includes(raw) ? raw : undefined,
);

function asTab(value: string): InspectorTab {
  return (INSPECTOR_TABS as readonly string[]).includes(value)
    ? (value as InspectorTab)
    : "changes";
}

/** Docked-inspector open state and last tab, shared by every session page. */
export function useInspectorPreferences() {
  const open = useSyncExternalStore(openStore.subscribe, openStore.read);
  const tab = asTab(useSyncExternalStore(tabStore.subscribe, tabStore.read));
  const setOpen = useCallback((next: boolean) => openStore.set(next), []);
  const setTab = useCallback((next: InspectorTab) => tabStore.set(next), []);
  return { open, tab, setOpen, setTab };
}
