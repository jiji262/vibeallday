import type { ProviderInfo } from "@vibeallday/shared";
import { useMemo } from "react";
import { useProviders } from "../../hooks/useProviders";
import type { Theme } from "../../hooks/useTheme";
import { useI18n } from "../../i18n";
import { getThemeLabel } from "../../i18n-settings";

/** One status fact for a category row; `attn` marks the needs-you part. */
export interface SettingsCategorySummary {
  text: string;
  attn?: string;
}

/** A real problem the overview lists in its "Needs attention" card. */
export interface SettingsAttentionItem {
  id: string;
  categoryId: string;
  title: string;
  detail: string;
  action: string;
}

export interface SettingsOverview {
  /** Status line per category id; categories without data are absent. */
  summaries: Readonly<Record<string, SettingsCategorySummary>>;
  attention: readonly SettingsAttentionItem[];
}

/** Installed providers split by whether a session can start with them. */
function providerReadiness(providers: readonly ProviderInfo[]): {
  ready: ProviderInfo[];
  signIn: ProviderInfo[];
} {
  const installed = providers.filter((provider) => provider.installed);
  return {
    ready: installed.filter((p) => p.authenticated || p.enabled),
    signIn: installed.filter((p) => !p.authenticated && !p.enabled),
  };
}

function useProviderOverview(visible: ReadonlySet<string>): {
  summary: SettingsCategorySummary | null;
  attention: SettingsAttentionItem | null;
} {
  const { t } = useI18n();
  const { providers, loading } = useProviders();
  return useMemo(() => {
    if (!visible.has("providers") || (loading && providers.length === 0)) {
      return { summary: null, attention: null };
    }
    const { ready, signIn } = providerReadiness(providers);
    const text = t("settingsSummaryProvidersReady", { count: ready.length });
    if (signIn.length === 0) return { summary: { text }, attention: null };
    const count = signIn.length;
    return {
      summary: { text, attn: t("settingsSummaryProvidersSignIn", { count }) },
      attention: {
        id: "providers-sign-in",
        categoryId: "providers",
        title: t("settingsAttentionProvidersSignIn", { count }),
        detail: t("settingsAttentionProvidersSignInDetail", {
          providers: signIn.map((p) => p.displayName).join(", "),
        }),
        action: t("settingsAttentionSignInAction"),
      },
    };
  }, [visible, providers, loading, t]);
}

export interface SettingsOverviewOptions {
  visibleCategoryIds: readonly string[];
  /**
   * The overview's own theme and text-size state. Browser-local preference
   * hooks do not sync across mounts, so the caller owns one instance and
   * shares it with the quick controls that change it.
   */
  theme: Theme;
  fontSizePercent: number;
}

/**
 * Status summaries for the Settings overview, from hooks the app already
 * has. Mount it only where the overview renders: never in search results,
 * so typing a query does not subscribe to provider or preference state.
 */
export function useSettingsOverview({
  visibleCategoryIds,
  theme,
  fontSizePercent,
}: SettingsOverviewOptions): SettingsOverview {
  const { t } = useI18n();
  const visibleKey = visibleCategoryIds.join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the joined key is the identity of the id list.
  const visible = useMemo(() => new Set(visibleCategoryIds), [visibleKey]);
  const provider = useProviderOverview(visible);

  return useMemo(() => {
    const summaries: Record<string, SettingsCategorySummary> = {};
    if (visible.has("appearance")) {
      const skin = getThemeLabel(theme, (key) => t(key as never));
      summaries.appearance = { text: `${skin} · ${fontSizePercent}%` };
    }
    if (provider.summary) summaries.providers = provider.summary;
    return {
      summaries,
      attention: provider.attention ? [provider.attention] : [],
    };
  }, [visible, theme, fontSizePercent, provider, t]);
}
