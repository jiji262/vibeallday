import { useMemo } from "react";
import { useOptionalRemoteConnection } from "../../contexts/RemoteConnectionContext";
import { getResolvedTheme, type Theme, useTheme } from "../../hooks/useTheme";
import { type TranslationFn, useI18n } from "../../i18n";
import { UI_KEYS } from "../../lib/storageKeys";
import { PlusIcon, SettingsIcon, SwitchHostIcon } from "../garden/icons";
import { switchHost } from "../sidebar/connectedHost";
import type { PaletteItem } from "./paletteData";

/** Celadon and Night are the toggle's two ends; OLED counts as Night. */
function toggledTheme(): Theme {
  return getResolvedTheme() === "light" ? "dark" : "light";
}

/**
 * The palette closes, and so unmounts its theme hook, before that hook's
 * effect could apply the change. Announcing it the way another tab would
 * lets the app-wide theme listener apply it and every mounted picker follow.
 */
function announceThemeChange() {
  window.dispatchEvent(new StorageEvent("storage", { key: UI_KEYS.theme }));
}

function useThemeAction(t: TranslationFn): PaletteItem {
  const { setTheme } = useTheme();
  return useMemo(
    () => ({
      id: "action:toggle-theme",
      group: "actions",
      label: t("paletteActionToggleTheme"),
      hint: t("paletteActionToggleThemeHint"),
      Icon: SettingsIcon,
      run: () => {
        setTheme(toggledTheme());
        announceThemeChange();
      },
    }),
    [setTheme, t],
  );
}

/** New session, skin toggle and, on a remote connection, host switching. */
export function usePaletteActions(): PaletteItem[] {
  const { t } = useI18n();
  const remote = useOptionalRemoteConnection();
  const themeAction = useThemeAction(t);
  return useMemo(() => {
    const items: PaletteItem[] = [
      {
        id: "action:new-session",
        group: "actions",
        label: t("sidebarNewSession"),
        to: "/new-session",
        Icon: PlusIcon,
      },
      themeAction,
    ];
    if (remote) {
      items.push({
        id: "action:switch-host",
        group: "actions",
        label: t("sidebarSwitchHost"),
        hint: t("moreSwitchHostHint"),
        Icon: SwitchHostIcon,
        run: () => switchHost(remote),
      });
    }
    return items;
  }, [remote, t, themeAction]);
}
