import type {
  ContextUsage,
  ProviderChildSessionSummary,
} from "@vibeallday/shared";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Message } from "../../types";
import { useLatestPlan } from "./inspectorPlan";
import { type InspectorTab, useInspectorPreferences } from "./inspectorState";
import type { SessionInspectorData } from "./SessionInspector";

export interface SessionInspectorInput {
  projectId: string;
  sessionId: string;
  basePath: string;
  sourceControlAvailable: boolean;
  contextUsage?: ContextUsage;
  providerChildren?: ProviderChildSessionSummary[];
  running: boolean;
  messages: readonly Message[];
  /** A docked column fits: wide layout with no app/file pane docked. */
  dockAvailable: boolean;
}

/** Keep the previous value while `keyOf` says nothing visible changed. */
function useStableBy<T>(value: T, keyOf: (value: T) => string): T {
  const stable = useRef(value);
  const key = useRef(keyOf(value));
  const nextKey = keyOf(value);
  if (nextKey !== key.current) {
    key.current = nextKey;
    stable.current = value;
  }
  return stable.current;
}

function usageKey(usage: ContextUsage | undefined): string {
  return usage
    ? `${usage.inputTokens}:${usage.contextWindow ?? ""}:${usage.percentage}`
    : "";
}

function childrenKey(children: ProviderChildSessionSummary[] | undefined) {
  return children
    ? children
        .map((child) => `${child.id}@${child.updatedAt}:${child.title ?? ""}`)
        .join("|")
    : "";
}

/**
 * Inspector state for one session page. Every field handed to the memoized
 * dock is stabilized here, so stream ticks that only append transcript text
 * do not re-render it; the plan is scanned only while its tab is visible.
 */
export function useSessionInspector(input: SessionInspectorInput) {
  const prefs = useInspectorPreferences();
  const [sheetTab, setSheetTab] = useState<InspectorTab | null>(null);
  const dockVisible = input.dockAvailable && prefs.open;
  const planActive =
    (dockVisible && prefs.tab === "plan") || sheetTab === "plan";
  const plan = useLatestPlan(input.messages, planActive);
  const contextUsage = useStableBy(input.contextUsage, usageKey);
  const providerChildren = useStableBy(input.providerChildren, childrenKey);
  const { projectId, sessionId, basePath, sourceControlAvailable, running } =
    input;
  const data = useMemo<SessionInspectorData>(
    () => ({
      projectId,
      sessionId,
      basePath,
      sourceControlAvailable,
      contextUsage,
      providerChildren,
      running,
      plan,
    }),
    [
      projectId,
      sessionId,
      basePath,
      sourceControlAvailable,
      contextUsage,
      providerChildren,
      running,
      plan,
    ],
  );
  const { dockAvailable } = input;
  const { open, tab, setOpen } = prefs;
  const toggle = useCallback(() => {
    if (dockAvailable) setOpen(!open);
    else setSheetTab(tab);
  }, [dockAvailable, open, setOpen, tab]);
  const closeSheet = useCallback(() => setSheetTab(null), []);
  return {
    data,
    dockVisible,
    dockAvailable,
    tab,
    setTab: prefs.setTab,
    sheetTab,
    openSheet: setSheetTab,
    closeSheet,
    toggle,
  };
}

export type SessionInspectorController = ReturnType<typeof useSessionInspector>;
