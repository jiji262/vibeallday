import type { ProjectAppInfo } from "@vibeallday/shared";
import type { MessageKey, TranslationFn } from "../i18n";

const STATE_LABEL_KEYS: Record<ProjectAppInfo["state"], MessageKey> = {
  none: "projectAppStateNone",
  ready: "projectAppStateReady",
  missing: "projectAppStateMissing",
  stopped: "projectAppStateStopped",
  starting: "projectAppStateStarting",
  running: "projectAppStateRunning",
  stopping: "projectAppStateStopping",
  failed: "projectAppStateFailed",
  unavailable: "projectAppStateUnavailable",
};

/** "App: running" in the viewer's language; a state newer than this client stays verbatim. */
export function projectAppStatusText(t: TranslationFn, state: string): string {
  const key = Object.hasOwn(STATE_LABEL_KEYS, state)
    ? STATE_LABEL_KEYS[state as ProjectAppInfo["state"]]
    : undefined;
  return t("projectAppState", { state: key ? t(key) : state });
}
