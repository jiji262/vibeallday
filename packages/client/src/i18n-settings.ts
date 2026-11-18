import {
  GIT_SOURCE_REVIEW_SUBMISSIONS_CAPABILITY,
  SERVER_CAPABILITIES,
} from "@vibeallday/shared";
import type {
  OutputFixedFont,
  OutputProseFont,
} from "./hooks/useOutputAppearance";
import type { SidebarSpacing } from "./hooks/useSidebarSpacing";
import type { TabSize } from "./hooks/useTabSize";
import type { Theme } from "./hooks/useTheme";
import type { Locale, TranslationFn } from "./i18n";
import type { SettingsCategory } from "./pages/settings/types";

export function getThemeLabel(theme: Theme, t: TranslationFn): string {
  switch (theme) {
    case "auto":
      return t("settingsAppearanceThemeSystem");
    case "light":
      return t("settingsAppearanceThemeCeladon");
    case "dark":
      return t("settingsAppearanceThemeNight");
    case "verydark":
      return t("settingsAppearanceThemeNightOled");
  }
}

export function getSidebarSpacingLabel(
  spacing: SidebarSpacing,
  t: (key: string) => string,
): string {
  switch (spacing) {
    case "compact":
      return t("sidebarSpacingCompact");
    case "comfortable":
      return t("sidebarSpacingComfortable");
  }
}

export function getOutputProseFontLabel(
  font: OutputProseFont,
  t: (key: string) => string,
): string {
  switch (font) {
    case "geist":
      return t("outputProseFontGeist");
    case "system":
      return t("outputProseFontSystem");
    case "inter":
      return t("outputProseFontInter");
    case "alegreya-sans":
      return t("outputProseFontAlegreyaSans");
    case "source-serif-4":
      return t("outputProseFontSourceSerif4");
  }
}

export function getOutputFixedFontLabel(
  font: OutputFixedFont,
  t: (key: string) => string,
): string {
  switch (font) {
    case "jetbrains-mono":
      return t("outputFixedFontJetBrainsMono");
    case "system":
      return t("outputFixedFontSystem");
    case "iosevka":
      return t("outputFixedFontIosevka");
    case "ibm-plex-mono":
      return t("outputFixedFontIbmPlexMono");
    case "fira-mono":
      return t("outputFixedFontFiraMono");
  }
}

export function getTabSizeLabel(size: TabSize): string {
  return size;
}

export function getLocaleLabel(
  locale: Locale,
  t: (key: string) => string,
): string {
  switch (locale) {
    case "en":
      return t("localeNameEn");
    case "zh-CN":
      return t("localeNameZhCn");
  }
}

export function getSettingsCategories(
  t: (key: string) => string,
): SettingsCategory[] {
  return [
    {
      id: "providers",
      label: t("settingsProvidersTitle"),
      description: t("settingsProvidersDescription"),
    },
    {
      id: "model",
      label: t("settingsModelTitle"),
      description: t("settingsModelDescription"),
    },
    {
      id: "appearance",
      label: t("settingsAppearanceTitle"),
      description: t("settingsAppearanceDescription"),
    },
    {
      id: "speech",
      label: t("settingsSpeechCategoryTitle"),
      description: t("settingsSpeechDescription"),
    },
    {
      id: "local-access",
      label: t("settingsLocalAccessTitle"),
      description: t("settingsLocalAccessDescription"),
    },
    {
      id: "remote",
      label: t("settingsRemoteTitle"),
      description: t("settingsRemoteDescription"),
    },
    {
      id: "notifications",
      label: t("settingsNotificationsTitle"),
      description: t("settingsNotificationsDescription"),
    },
    {
      id: "users",
      label: t("settingsUsersTitle"),
      description: t("settingsUsersDescription"),
      requires: {
        anyCapability: [SERVER_CAPABILITIES.limitedUsers.name],
        unsupportedMessage: t("usersUnsupportedServer"),
      },
    },
    {
      id: "source-control",
      label: t("settingsSourceControlTitle"),
      description: t("settingsSourceControlDescription"),
      requires: {
        anyCapability: [GIT_SOURCE_REVIEW_SUBMISSIONS_CAPABILITY],
        unsupportedMessage: t("sourceControlUnsupportedServer"),
      },
    },
    {
      id: "apps",
      label: t("settingsAppsTitle"),
      description: t("settingsAppsDescription"),
    },
    {
      id: "storage",
      label: t("settingsStorageTitle"),
      description: t("settingsStorageDescription"),
    },
    {
      id: "about",
      label: t("settingsAboutTitle"),
      description: t("settingsAboutDescription"),
    },
  ];
}
