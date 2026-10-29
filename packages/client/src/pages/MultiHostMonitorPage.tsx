import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { Badge, type BadgeTone } from "../components/garden/Badge";
import { Button } from "../components/garden/Button";
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
} from "../components/garden/Card";
import { EmptyState } from "../components/garden/EmptyState";
import { Eyebrow } from "../components/garden/Eyebrow";
import { BigNumber, MetaField, MetaGrid } from "../components/garden/Meta";
import { VibeAllDayGlyph } from "../components/VibeAllDayLogo";
import { type MessageKey, useI18n } from "../i18n";
import { loadSavedHosts, type SavedHost } from "../lib/hostStorage";
import { getRelayBasePath } from "../lib/remoteRoutePaths";
import {
  MultiHostMonitorController,
  type MultiHostMonitorHostSnapshot,
  type MultiHostMonitorHostState,
} from "../lib/multiHostMonitor";
import styles from "./MultiHostMonitorPage.module.css";

const LOGO_SIZE = 32;

const STATUS_TONES: Record<MultiHostMonitorHostState, BadgeTone> = {
  connecting: "sand",
  connected: "mint",
  offline: "rose",
  "sign-in-required": "peach",
};

const STATUS_KEYS: Record<MultiHostMonitorHostState, MessageKey> = {
  connecting: "multiHostMonitorStateConnecting",
  connected: "multiHostMonitorStateConnected",
  offline: "multiHostMonitorStateOffline",
  "sign-in-required": "multiHostMonitorStateSignInRequired",
};

function relayLoginPath(host: MultiHostMonitorHostSnapshot): string {
  const params = new URLSearchParams();
  if (host.relayUsername) params.set("u", host.relayUsername);
  const query = params.toString();
  return `/login/relay${query ? `?${query}` : ""}`;
}

function signInPath(host: MultiHostMonitorHostSnapshot): string {
  return host.mode === "relay" ? relayLoginPath(host) : "/login/direct";
}

function sessionPath(
  host: MultiHostMonitorHostSnapshot,
  projectId: string,
  sessionId: string,
): string | null {
  if (!host.relayUsername) return null;
  return `${getRelayBasePath(host.relayUsername)}/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}`;
}

function HostSessions({ host }: { host: MultiHostMonitorHostSnapshot }) {
  const { t } = useI18n();
  const sessions = host.summary?.sessions ?? [];
  return (
    <div className={styles.sessions}>
      <h3 className={styles.sessionsTitle}>
        {t("multiHostMonitorRecentSessions")}
      </h3>
      {sessions.length > 0 ? (
        <ul className={styles.sessionList}>
          {sessions.map((session) => {
            const path = session.projectId
              ? sessionPath(host, session.projectId, session.id)
              : null;
            return (
              <li key={`${session.projectId ?? ""}:${session.id}`}>
                {path ? (
                  <Link to={path}>{session.title}</Link>
                ) : (
                  <span>{session.title}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.quiet}>{t("multiHostMonitorNoSessions")}</p>
      )}
    </div>
  );
}

function HostAction({
  controller,
  host,
}: {
  controller: MultiHostMonitorController;
  host: MultiHostMonitorHostSnapshot;
}) {
  const { t } = useI18n();
  if (host.state === "offline") {
    return (
      <Button size="sm" onClick={() => controller.retryHost(host.hostId)}>
        {t("multiHostMonitorRetry")}
      </Button>
    );
  }
  if (host.state === "sign-in-required") {
    return (
      <Link className={styles.linkButton} to={signInPath(host)}>
        {t("multiHostMonitorSignIn")}
      </Link>
    );
  }
  return null;
}

function HostMonitorCard({
  controller,
  host,
}: {
  controller: MultiHostMonitorController;
  host: MultiHostMonitorHostSnapshot;
}) {
  const { t } = useI18n();
  const summary = host.state === "connected" ? host.summary : undefined;
  return (
    <Card
      as="article"
      // `multi-host-card` and the data attributes are e2e hooks.
      className={`multi-host-card ${styles.card}`}
      data-host-name={host.displayName}
      data-host-state={host.state}
    >
      <CardHeader
        title={host.displayName}
        titleAs="h2"
        description={host.relayUsername}
        actions={
          <Badge
            tone={STATUS_TONES[host.state]}
            dot={host.state === "connecting" ? "pulse" : true}
          >
            {t(STATUS_KEYS[host.state])}
          </Badge>
        }
      />
      {summary ? (
        <CardBody className={styles.body}>
          <MetaGrid columns={2}>
            <MetaField
              label={t("multiHostMonitorActiveAgents")}
              value={
                <BigNumber tone="mint">{summary.activeAgentCount}</BigNumber>
              }
            />
            <MetaField
              label={t("multiHostMonitorNeedsAttention")}
              value={
                <BigNumber tone="rose">{summary.needsAttentionCount}</BigNumber>
              }
            />
          </MetaGrid>
          <HostSessions host={host} />
        </CardBody>
      ) : (
        <CardFooter className={styles.action}>
          <HostAction controller={controller} host={host} />
        </CardFooter>
      )}
    </Card>
  );
}

function MonitorHeader() {
  const { t } = useI18n();
  return (
    <header className={styles.header}>
      <Link className={styles.brand} to="/login" aria-label="VibeAllDay">
        <VibeAllDayGlyph size={LOGO_SIZE} />
      </Link>
      <div className={styles.heading}>
        <Eyebrow parts={[t("multiHostMonitorExperimental")]} />
        <h1 className={styles.title}>{t("multiHostMonitorTitle")}</h1>
        <p className={styles.lede}>{t("multiHostMonitorDescription")}</p>
      </div>
      <Link className={styles.linkButton} to="/login">
        {t("multiHostMonitorBack")}
      </Link>
    </header>
  );
}

export function MultiHostMonitorPage() {
  const { t } = useI18n();
  const hosts = useMemo<SavedHost[]>(() => loadSavedHosts().hosts, []);
  const controller = useMemo(
    () => new MultiHostMonitorController(hosts),
    [hosts],
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => {
    controller.start();
    return () => controller.dispose();
  }, [controller]);

  return (
    <main className={styles.page} data-testid="multi-host-monitor">
      <div className={styles.shell}>
        <MonitorHeader />
        {snapshot.selectedCount > 0 ? (
          <>
            <p
              className={styles.count}
              data-testid="multi-host-connected-count"
            >
              {t("multiHostMonitorConnectedCount", {
                connected: snapshot.connectedCount,
                total: snapshot.selectedCount,
              })}
            </p>
            <section
              className={styles.grid}
              aria-label={t("multiHostMonitorTitle")}
            >
              {snapshot.hosts.map((host) => (
                <HostMonitorCard
                  key={host.hostId}
                  controller={controller}
                  host={host}
                />
              ))}
            </section>
          </>
        ) : (
          <EmptyState
            title={t("multiHostMonitorEmptyTitle")}
            hint={t("multiHostMonitorEmptyDescription")}
            action={
              <Link className={styles.linkButton} to="/login">
                {t("multiHostMonitorAddHost")}
              </Link>
            }
          />
        )}
      </div>
    </main>
  );
}
