import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { Tag } from "../components/garden/Badge";
import { EmptyState } from "../components/garden/EmptyState";
import { Eyebrow } from "../components/garden/Eyebrow";
import { VibeAllDayGlyph } from "../components/VibeAllDayLogo";
import { useI18n } from "../i18n";
import { loadSavedHosts, type SavedHost } from "../lib/hostStorage";
import { MultiHostMonitorController } from "../lib/multiHostMonitor";
import styles from "./MultiHostMonitorPage.module.css";
import { HostMonitorCard } from "./MultiHostMonitorCard";

const LOGO_SIZE = 32;

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
