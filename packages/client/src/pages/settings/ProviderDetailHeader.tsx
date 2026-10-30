import type { ProviderName } from "@vibeallday/shared";
import {
  ExternalIcon,
  ProviderMark,
  Status,
  type StatusState,
} from "../../components/garden";
import { type TranslationFn, useI18n } from "../../i18n";
import styles from "./ProvidersSettings.module.css";
import headerStyles from "./ProviderDetailHeader.module.css";
import {
  type ProviderDisplayEntry,
  type ProviderReadiness,
  providerIsAuthenticated,
  providerReadiness,
} from "./ProvidersSettings.data";

const INLINE_ICON_SIZE = 12;

const READINESS_STATE: Record<ProviderReadiness, StatusState> = {
  missing: "idle",
  "needs-auth": "attn",
  ready: "ok",
};

const READINESS_LABEL = {
  missing: "providersRuntimeUnavailable",
  "needs-auth": "providersOverviewNeedsSignIn",
  ready: "providersOverviewConnected",
} as const;

/** Readiness as colour plus shape: ok, needs-you, or idle when missing. */
export function ProviderReadinessStatus({
  provider,
}: {
  provider: ProviderDisplayEntry;
}) {
  const { t } = useI18n();
  const readiness = providerReadiness(provider);
  return (
    <Status state={READINESS_STATE[readiness]}>
      {t(READINESS_LABEL[readiness])}
    </Status>
  );
}

/** "Runtime ready · Desktop application: … · Authentication: … · N models". */
export function providerMetaLine(
  provider: ProviderDisplayEntry,
  t: TranslationFn,
): string {
  const parts = [
    provider.installed
      ? t("providersRuntimeReady")
      : t("providersRuntimeUnavailable"),
  ];
  const hasDesktopApp = provider.id === "claude" || provider.id === "codex";
  if (hasDesktopApp && provider.applicationDetected !== undefined) {
    parts.push(
      t("providersDesktopApplicationStatus", {
        status: provider.applicationDetected
          ? t("providersDetected")
          : t("providersNotDetected"),
      }),
    );
  }
  if (provider.installed) {
    parts.push(
      t("providersAuthenticationStatus", {
        status: providerIsAuthenticated(provider)
          ? t("providersAuthenticated")
          : t("providersNotAuthenticated"),
      }),
    );
  }
  if (provider.modelCount > 0) {
    parts.push(
      t("providersOverviewModelCount", { count: provider.modelCount }),
    );
  }
  return parts.join(" · ");
}

/** Detail page heading: mark, name, readiness, account and website. */
export function ProviderDetailHeader({
  provider,
}: {
  provider: ProviderDisplayEntry;
}) {
  const { t } = useI18n();
  return (
    <header className={headerStyles.detailHeader}>
      <ProviderMark provider={provider.id as ProviderName} size="lg" />
      <div className={headerStyles.detailTitle}>
        <div className={styles.nameLine}>
          <h2 className={headerStyles.detailName}>{provider.displayName}</h2>
          <ProviderReadinessStatus provider={provider} />
        </div>
        {provider.userEmail && (
          <p className={styles.oneLiner}>{provider.userEmail}</p>
        )}
        <span className={styles.meta}>{providerMetaLine(provider, t)}</span>
      </div>
      {provider.metadata.website && (
        <a
          className={headerStyles.ghostLink}
          href={provider.metadata.website}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("providersWebsite")}
          <ExternalIcon size={INLINE_ICON_SIZE} />
        </a>
      )}
    </header>
  );
}
