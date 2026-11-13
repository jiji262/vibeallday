import type { ProviderName } from "@vibeallday/shared";
import { Link } from "react-router-dom";
import {
  ChevronRightIcon,
  Count,
  Notice,
  ProviderMark,
  ScopeTag,
} from "../../components/garden";
import { useRemoteBasePath } from "../../hooks/useRemoteBasePath";
import { useI18n } from "../../i18n";
import styles from "./ProvidersSettings.module.css";
import {
  AUTH_ROUTER_ITEM_ID,
  GATEWAY_SERVICES_ITEM_ID,
  type ProviderDisplayEntry,
} from "./ProvidersSettings.data";

/** The providers category route, under the relay base path when relayed. */
export function useProvidersPath(): string {
  return `${useRemoteBasePath()}/settings/providers`;
}

function RouteRow({
  to,
  title,
  description,
}: {
  to: string;
  title: string;
  description: string;
}) {
  return (
    <Link className={styles.routeRow} to={to}>
      <span className={styles.routeText}>
        <span className={styles.routeTitle}>
          {title}
          <ScopeTag scope="server" />
        </span>
        <span className={styles.oneLiner}>{description}</span>
      </span>
      <ChevronRightIcon />
    </Link>
  );
}

export function RoutingRows({
  showGatewayServices,
  showAuthRouter,
}: {
  showGatewayServices: boolean;
  showAuthRouter: boolean;
}) {
  const { t } = useI18n();
  const listPath = useProvidersPath();
  if (!showGatewayServices && !showAuthRouter) return null;
  return (
    <section className={styles.group}>
      <div className={styles.groupHead}>
        <h2 className={styles.groupTitle}>{t("providersOverviewRoutes")}</h2>
      </div>
      <div className={styles.list}>
        {showGatewayServices && (
          <RouteRow
            to={`${listPath}/${GATEWAY_SERVICES_ITEM_ID}`}
            title={t("providersGatewayServicesTitle")}
            description={t("providersOverviewGatewayServicesDescription")}
          />
        )}
        {showAuthRouter && (
          <RouteRow
            to={`${listPath}/${AUTH_ROUTER_ITEM_ID}`}
            title={t("routerTitle")}
            description={t("providersOverviewAuthRouterDescription")}
          />
        )}
      </div>
    </section>
  );
}

export function MissingProviders({
  providers,
}: {
  providers: readonly ProviderDisplayEntry[];
}) {
  const { t } = useI18n();
  const listPath = useProvidersPath();
  if (providers.length === 0) return null;
  return (
    <details className={styles.fold}>
      <summary>
        <ChevronRightIcon className={styles.foldChevron} />
        <span className={styles.foldTitle}>
          {t("providersOverviewNotInstalled")}
        </span>
        <Count>{providers.length}</Count>
        <span className={styles.meta}>
          {t("providersOverviewNotInstalledHint")}
        </span>
      </summary>
      <div className={styles.foldList}>
        {providers.map((provider) => (
          <div key={provider.id} className={styles.missingRow}>
            <ProviderMark provider={provider.id as ProviderName} size="lg" />
            <div className={styles.cardBody}>
              <Link className={styles.name} to={`${listPath}/${provider.id}`}>
                {provider.displayName}
              </Link>
              <span className={styles.meta}>
                {t("providersRuntimeUnavailable")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export function SharedSettingsNotice() {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  return (
    <Notice tone="neutral">
      {t("providersOverviewSharedNotice")}{" "}
      <Link to={`${basePath}/settings/agent-behavior`}>
        {t("providersOverviewSharedNoticeLink")}
      </Link>
    </Notice>
  );
}
