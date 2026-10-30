import type { ProviderName } from "@vibeallday/shared";
import { type ReactNode, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  ChevronRightIcon,
  Count,
  ProviderMark,
  RefreshIcon,
} from "../../components/garden";
import { useRemoteBasePath } from "../../hooks/useRemoteBasePath";
import { useI18n } from "../../i18n";
import {
  ProviderReadinessStatus,
  providerMetaLine,
} from "./ProviderDetailHeader";
import styles from "./ProvidersSettings.module.css";
import {
  type ProviderDisplayEntry,
  providerDetailForRow,
  providerReadiness,
} from "./ProvidersSettings.data";
import {
  MissingProviders,
  RoutingRows,
  SharedSettingsNotice,
  useProvidersPath,
} from "./ProvidersSettings.sections";
import { useSettingsJumpTarget } from "./SettingsSearchContext";

/** Only Claude and Codex have an in-app sign-in page. */
const IN_APP_SIGN_IN_PROVIDERS: ReadonlySet<string> = new Set([
  "claude",
  "codex",
]);

/**
 * A search jump that lands here for a row on a provider's detail page
 * continues there, carrying the same jump target.
 */
function useForwardJumpToDetail(providerIds: readonly string[]) {
  const jump = useSettingsJumpTarget();
  const navigate = useNavigate();
  const listPath = useProvidersPath();
  const target = jump?.target ?? null;
  const owner = target ? providerDetailForRow(target, providerIds) : null;
  useEffect(() => {
    if (!target || !owner) return;
    navigate(`${listPath}/${owner}`, {
      replace: true,
      state: { settingsJumpTarget: target },
    });
  }, [listPath, navigate, owner, target]);
}

function SignInAction({ provider }: { provider: ProviderDisplayEntry }) {
  const { t } = useI18n();
  const basePath = useRemoteBasePath();
  const canSignIn =
    providerReadiness(provider) === "needs-auth" &&
    provider.supportsInAppLogin &&
    IN_APP_SIGN_IN_PROVIDERS.has(provider.id);
  if (!canSignIn) return null;
  return (
    <Link
      className={styles.attnLink}
      to={`${basePath}/provider-sign-in/${provider.id}`}
    >
      {t("providersSignIn", { provider: provider.displayName })}
    </Link>
  );
}

function ProviderCard({ provider }: { provider: ProviderDisplayEntry }) {
  const { t } = useI18n();
  const detailPath = `${useProvidersPath()}/${provider.id}`;
  return (
    <article className={styles.card} data-provider-card={provider.id}>
      <ProviderMark provider={provider.id as ProviderName} size="lg" />
      <div className={styles.cardBody}>
        <div className={styles.nameLine}>
          <Link className={styles.name} to={detailPath}>
            {provider.displayName}
          </Link>
          <ProviderReadinessStatus provider={provider} />
        </div>
        <p className={styles.oneLiner}>
          {provider.userEmail ?? provider.metadata.description}
        </p>
        <span className={styles.meta}>{providerMetaLine(provider, t)}</span>
      </div>
      <div className={styles.cardActions}>
        <SignInAction provider={provider} />
        <Link
          className={styles.chevronLink}
          to={detailPath}
          aria-label={t("providersOverviewDetails", {
            provider: provider.displayName,
          })}
        >
          <ChevronRightIcon />
        </Link>
      </div>
    </article>
  );
}

function CardGroup({
  title,
  meta,
  count,
  attention = false,
  children,
}: {
  title: string;
  meta: string;
  count: number;
  attention?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={styles.group}>
      <div className={styles.groupHead}>
        <h2 className={styles.groupTitle}>
          {title}
          <Count tone={attention ? "attn" : "default"}>{count}</Count>
        </h2>
        <span className={styles.meta}>{meta}</span>
      </div>
      <div className={attention ? styles.listAttn : styles.list}>
        {children}
      </div>
    </section>
  );
}

export interface ProvidersOverviewProps {
  providers: readonly ProviderDisplayEntry[];
  loading: boolean;
  onRecheck: () => Promise<void>;
  showGatewayServices: boolean;
  showAuthRouter: boolean;
}

/**
 * Providers overview: who needs you, who is ready, routing services, and a
 * folded list of providers whose CLI is not installed. Each card opens the
 * provider's detail page.
 */
export function ProvidersOverview({
  providers,
  loading,
  onRecheck,
  showGatewayServices,
  showAuthRouter,
}: ProvidersOverviewProps) {
  const { t } = useI18n();
  useForwardJumpToDetail(providers.map((provider) => provider.id));
  const byReadiness = (wanted: string) =>
    providers.filter((provider) => providerReadiness(provider) === wanted);
  const needsAuth = byReadiness("needs-auth");
  const ready = byReadiness("ready");
  return (
    <div className={styles.overview}>
      <div className={styles.toolbar}>
        <Button
          size="sm"
          icon={<RefreshIcon />}
          loading={loading}
          onClick={() => void onRecheck()}
        >
          {t("providersOverviewRecheck")}
        </Button>
      </div>
      {needsAuth.length > 0 && (
        <CardGroup
          title={t("providersOverviewNeedsYou")}
          meta={t("providersOverviewNeedsYouMeta")}
          count={needsAuth.length}
          attention
        >
          {needsAuth.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </CardGroup>
      )}
      {ready.length > 0 && (
        <CardGroup
          title={t("providersOverviewReady")}
          meta={t("providersOverviewReadyMeta")}
          count={ready.length}
        >
          {ready.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </CardGroup>
      )}
      {needsAuth.length === 0 && ready.length === 0 && !loading && (
        <p className={styles.oneLiner}>{t("providersOverviewEmpty")}</p>
      )}
      <RoutingRows
        showGatewayServices={showGatewayServices}
        showAuthRouter={showAuthRouter}
      />
      <MissingProviders providers={byReadiness("missing")} />
      <SharedSettingsNotice />
    </div>
  );
}
