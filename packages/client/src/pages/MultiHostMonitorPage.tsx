import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { Tag } from "../components/garden/Badge";
import { Button } from "../components/garden/Button";
import { Card } from "../components/garden/Card";
import { EmptyState } from "../components/garden/EmptyState";
import { Eyebrow } from "../components/garden/Eyebrow";
import {
  GlobeIcon,
  RefreshIcon,
  TerminalIcon,
} from "../components/garden/icons";
import { Status, type StatusState } from "../components/garden/StatusDot";
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

const STATUS_STATES: Record<MultiHostMonitorHostState, StatusState> = {
  connecting: "run",
  connected: "ok",
  offline: "err",
  "sign-in-required": "attn",
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
      <Button
        size="sm"
        block
        icon={<RefreshIcon />}
        onClick={() => controller.retryHost(host.hostId)}
      >
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

/** Needs-attention and active-agent counts in one inset band. */
function HostCounts({
  needsAttention,
  active,
}: {
  needsAttention: number;
  active: number;
}) {
  const { t } = useI18n();
  return (
    <dl className={styles.counts}>
      <div className={styles.count}>
        <dt>{t("multiHostMonitorNeedsAttention")}</dt>
        <dd className={needsAttention > 0 ? styles.attnNum : styles.quietNum}>
          {needsAttention}
        </dd>
      </div>
      <div className={styles.count}>
        <dt>{t("multiHostMonitorActiveAgents")}</dt>
        <dd className={active > 0 ? styles.runNum : styles.quietNum}>
          {active}
        </dd>
      </div>
    </dl>
  );
}

function HostCardHead({ host }: { host: MultiHostMonitorHostSnapshot }) {
  const { t } = useI18n();
  const kind = t(
    host.mode === "relay"
      ? "multiHostMonitorKindRelay"
      : "multiHostMonitorKindDirect",
  );
  const meta = host.relayUsername ? `${kind} · ${host.relayUsername}` : kind;
  return (
    <div className={styles.cardHead}>
      <span className={styles.hostIcon} aria-hidden="true">
        {host.mode === "relay" ? <GlobeIcon /> : <TerminalIcon />}
      </span>
      <div className={styles.hostText}>
        <h2 className={styles.hostName}>{host.displayName}</h2>
        <span className={styles.hostMeta}>{meta}</span>
      </div>
      <Status state={STATUS_STATES[host.state]}>
        {t(STATUS_KEYS[host.state])}
      </Status>
    </div>
  );
}

function HostMonitorCard({
  controller,
  host,
}: {
  controller: MultiHostMonitorController;
  host: MultiHostMonitorHostSnapshot;
}) {
  const summary = host.state === "connected" ? host.summary : undefined;
  const needsYou = (summary?.needsAttentionCount ?? 0) > 0;
  const classes = [
    "multi-host-card",
    styles.card,
    needsYou && styles.attnCard,
    !summary && styles.offCard,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Card
      as="article"
      // `multi-host-card` and the data attributes are e2e hooks.
      className={classes}
      data-host-name={host.displayName}
      data-host-state={host.state}
    >
      <HostCardHead host={host} />
      {summary ? (
        <>
          <HostCounts
            needsAttention={summary.needsAttentionCount}
            active={summary.activeAgentCount}
          />
          <HostSessions host={host} />
        </>
      ) : (
        <div className={styles.action}>
          <HostAction controller={controller} host={host} />
        </div>
      )}
    </Card>
  );
}

function MonitorHeader({ count }: { count?: string }) {
  const { t } = useI18n();
  return (
    <header className={styles.header}>
      <Link className={styles.brand} to="/login" aria-label="VibeAllDay">
        <VibeAllDayGlyph size={LOGO_SIZE} />
      </Link>
      <div className={styles.heading}>
        <Eyebrow parts={[t("multiHostMonitorExperimental")]} />
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{t("multiHostMonitorTitle")}</h1>
          {count ? (
            <span data-testid="multi-host-connected-count">
              <Tag>{count}</Tag>
            </span>
          ) : null}
        </div>
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
        <MonitorHeader
          count={
            snapshot.selectedCount > 0
              ? t("multiHostMonitorConnectedCount", {
                  connected: snapshot.connectedCount,
                  total: snapshot.selectedCount,
                })
              : undefined
          }
        />
        {snapshot.selectedCount > 0 ? (
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
