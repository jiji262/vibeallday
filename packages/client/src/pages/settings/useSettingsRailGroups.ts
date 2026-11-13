import { useCallback, useState } from "react";
import { UI_KEYS } from "../../lib/storageKeys";

/** Browser-local list of settings rail groups the user collapsed. */
const SETTINGS_RAIL_COLLAPSED_GROUPS_KEY = UI_KEYS.settingsRailCollapsedGroups;

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(SETTINGS_RAIL_COLLAPSED_GROUPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function saveCollapsed(collapsed: ReadonlySet<string>): void {
  try {
    localStorage.setItem(
      SETTINGS_RAIL_COLLAPSED_GROUPS_KEY,
      JSON.stringify([...collapsed]),
    );
  } catch {
    // Storage full or blocked: the rail still toggles for this visit.
  }
}

/**
 * Which settings rail groups are collapsed; every group starts open and the
 * choice persists in this browser. `expand` is a no-op for an open group.
 */
export function useSettingsRailGroups(): {
  collapsed: ReadonlySet<string>;
  toggle: (groupId: string) => void;
  expand: (groupId: string) => void;
} {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const update = useCallback(
    (groupId: string, collapse: (wasCollapsed: boolean) => boolean) => {
      setCollapsed((current) => {
        const wasCollapsed = current.has(groupId);
        if (collapse(wasCollapsed) === wasCollapsed) return current;
        const next = new Set(current);
        if (wasCollapsed) next.delete(groupId);
        else next.add(groupId);
        saveCollapsed(next);
        return next;
      });
    },
    [],
  );
  const toggle = useCallback(
    (groupId: string) => update(groupId, (was) => !was),
    [update],
  );
  const expand = useCallback(
    (groupId: string) => update(groupId, () => false),
    [update],
  );
  return { collapsed, toggle, expand };
}
