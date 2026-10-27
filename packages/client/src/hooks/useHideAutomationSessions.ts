import { useSyncExternalStore } from "react";
import { createLocalStorageBoolean } from "../lib/localStorageValue";
import { UI_KEYS } from "../lib/storageKeys";

/**
 * Codex `exec` runs and scheduled tasks are hidden from session lists by
 * default: a skill that shells out once per image would otherwise bury the
 * reader's own conversations. Per device, like the other list preferences.
 */
const store = createLocalStorageBoolean(UI_KEYS.hideAutomationSessions, true);

export function useHideAutomationSessions() {
  const hideAutomationSessions = useSyncExternalStore(
    store.subscribe,
    store.read,
    store.read,
  );
  return { hideAutomationSessions, setHideAutomationSessions: store.set };
}
