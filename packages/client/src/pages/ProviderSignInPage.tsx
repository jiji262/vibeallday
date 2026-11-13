import { Link, useParams } from "react-router-dom";
import { Card, CardBody, CardFooter } from "../components/garden/Card";
import { LoadingState } from "../components/garden/LoadingState";
import { Notice } from "../components/garden/Notice";
import { PageHeader } from "../components/PageHeader";
import { PageIntro } from "../components/shell/PageIntro";
import { pageWidthClass } from "../components/shell/pageWidth";
import { useProviderRow } from "../hooks/useProviders";
import { useRemoteBasePath } from "../hooks/useRemoteBasePath";
import { useI18n } from "../i18n";
import { MainContent, useNavigationLayout } from "../layouts";
import styles from "./ProviderSignInPage.module.css";
import { ProviderSignIn } from "./settings/ProviderSignIn";

type SupportedProvider = "claude" | "codex";

function SignInBody({
  provider,
  name,
}: {
  provider: SupportedProvider | null;
  name: string;
}) {
  const { t } = useI18n();
  const { row, loading, error, refresh, sourceKey } = useProviderRow(provider);
  if (!provider) {
    return (
      <Notice tone="danger" role="alert">
        {t("providerSignInUnsupported")}
      </Notice>
    );
  }
  if (loading) {
    return (
      <LoadingState variant="compact" label={t("providerSignInLoading")} />
    );
  }
  if (error) {
    return (
      <Notice tone="danger" role="alert">
        {error.message}
      </Notice>
    );
  }
  if (row?.authenticated) {
    return (
      <Notice tone="success" role="status">
        {t("providerSignInReady", { provider: name })}
      </Notice>
    );
  }
  if (!row?.supportsInAppLogin) {
    return (
      <Notice tone="warning" role="alert">
        {t("providerSignInUnavailable")}
      </Notice>
    );
  }
  return (
    <ProviderSignIn
      key={`${sourceKey}:${provider}`}
      provider={provider}
      displayName={name}
      supportsHostTerminal={row.supportsHostTerminalLogin === true}
      onSignedIn={() => void refresh()}
    />
  );
}

/** One focused owner flow for desktop, remote clients and the Android host. */
export function ProviderSignInPage() {
  const { provider: parameter } = useParams();
  const provider =
    parameter === "claude" || parameter === "codex" ? parameter : null;
  const { isWideScreen, openSidebar } = useNavigationLayout();
  const basePath = useRemoteBasePath();
  const { t } = useI18n();
  const name = provider === "claude" ? "Claude" : "Codex";
  const title = t("providersSignIn", { provider: name });
  return (
    <MainContent isWideScreen={isWideScreen}>
      <PageHeader
        title={title}
        intro="content"
        onOpenSidebar={openSidebar}
        isWideScreen={isWideScreen}
      />
      <main className="page-scroll-container">
        <div className={`page-content-inner ${pageWidthClass("form")}`}>
          <PageIntro title={title} lede={t("providerSignInHostHint")} />
          <Card as="section" aria-label={title}>
            <CardBody className={styles.body}>
              <SignInBody provider={provider} name={name} />
            </CardBody>
            <CardFooter>
              <Link
                className={styles.settingsLink}
                to={`${basePath}/settings/providers`}
              >
                {t("providerSignInSettings")}
              </Link>
            </CardFooter>
          </Card>
        </div>
      </main>
    </MainContent>
  );
}
