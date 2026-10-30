import { useClientSummarySourceKey } from "../../lib/clientSummaryStore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fetchJSON, type VersionInfo } from "../../api/client";
import { RemoteCompatibilityNoticeCard } from "../../components/RemoteCompatibilityNotices";
import { useOptionalRemoteConnection } from "../../contexts/RemoteConnectionContext";
import { useRemoteCompatibilityNoticeDismissals } from "../../hooks/useRemoteCompatibilityNoticeDismissals";
import { useOnboarding } from "../../hooks/useOnboarding";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import {
  activityBus,
  getInterruptibleSessionCount,
  type WorkerActivityEvent,
} from "../../lib/activityBus";
import { SettingsItem } from "./SettingsItem";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import { HideInSettingsSearch } from "./SettingsSearchContext";
import { SettingsSection } from "./SettingsSection";
import { getRemoteCompatibilityNotices } from "../../lib/remoteCompatibilityNotices";
import { getDesktopRuntimeMetadata } from "../../lib/desktopRuntime";
import { Button, ScopeTag, Status } from "../../components/garden";
import {
  AboutVersionCard,
  type DesktopCheckStatus,
} from "./AboutSettings.version";
import styles from "./AboutSettings.module.css";

export function AboutSettings() {
  const { t } = useI18n();
  const sourceKey = useClientSummarySourceKey();
  useSettingsPaneTitle(t("aboutTitle"));
  const { canInstall, isInstalled, install } = usePwaInstall();
  const desktopRuntime = getDesktopRuntimeMetadata();
  const {
    version: versionInfo,
    loading: versionLoading,
    error: versionError,
  } = useVersion({ freshOnMount: !desktopRuntime });
  const remoteConnection = useOptionalRemoteConnection();
  const { resetOnboarding } = useOnboarding();
  const currentRelayUsername = remoteConnection?.currentRelayUsername ?? null;
  const getNoticesForVersion = useCallback(
    (candidate: VersionInfo | null) => {
      if (!candidate) return [];

      return getRemoteCompatibilityNotices({
        runtimeNotice: { runtime: candidate.serverRuntime, sourceKey, t },
        currentVersion: candidate?.current ?? null,
        installSource: candidate?.installSource,
        desktopRuntime: candidate?.desktopRuntime,
        resumeProtocolVersion: candidate?.resumeProtocolVersion,
        remoteCompatibilityLevel: candidate?.remoteCompatibilityLevel,
        capabilities: candidate?.capabilities,
        relayUsername: currentRelayUsername,
      });
    },
    [currentRelayUsername, sourceKey, t],
  );
  const remoteCompatibilityNotices = useMemo(
    () => getNoticesForVersion(versionInfo),
    [getNoticesForVersion, versionInfo],
  );
  const {
    dismissedNotices: dismissedRemoteCompatibilityNotices,
    restoreNotices: restoreRemoteCompatibilityNotices,
    visibleNotices: visibleRemoteCompatibilityNotices,
  } = useRemoteCompatibilityNoticeDismissals(remoteCompatibilityNotices);
  const inlineRemoteCompatibilityNotice =
    visibleRemoteCompatibilityNotices.length === 0
      ? dismissedRemoteCompatibilityNotices[0]
      : null;

  // Server restart state
  const [restarting, setRestarting] = useState(false);
  const [interruptibleSessionCount, setInterruptibleSessionCount] = useState(0);

  // Fetch worker activity on mount
  useEffect(() => {
    fetchJSON<WorkerActivityEvent>("/status/workers")
      .then((data) =>
        setInterruptibleSessionCount(getInterruptibleSessionCount(data)),
      )
      .catch(() => {});
    return activityBus.on("worker-activity-changed", (data) => {
      setInterruptibleSessionCount(getInterruptibleSessionCount(data));
    });
  }, []);

  // When activity bus reconnects after restart, clear restarting state
  useEffect(() => {
    if (!restarting) return;
    return activityBus.on("reconnect", () => {
      setRestarting(false);
    });
  }, [restarting]);

  const handleRestart = useCallback(async () => {
    setRestarting(true);
    try {
      await api.restartServer();
    } catch {
      // Expected - server drops connection during restart
    }
  }, []);

  const handleShowRemoteCompatibilityBanner = useCallback(() => {
    restoreRemoteCompatibilityNotices(remoteCompatibilityNotices);
  }, [remoteCompatibilityNotices, restoreRemoteCompatibilityNotices]);

  const [desktopCheckStatus, setDesktopCheckStatus] =
    useState<DesktopCheckStatus>(null);
  // Only the desktop app updates itself; the server has no update check.
  const handleCheckUpdates = useCallback(async () => {
    if (!desktopRuntime) return;
    if (!desktopRuntime.nativeUpdateCheck) {
      setDesktopCheckStatus("menu");
      return;
    }
    try {
      const response = await fetch("/desktop-bootstrap/check-updates", {
        method: "POST",
        headers: { "X-VibeAllDay": "true" },
        credentials: "same-origin",
      });
      setDesktopCheckStatus(response.ok ? "opened" : "failed");
    } catch {
      setDesktopCheckStatus("failed");
    }
  }, [desktopRuntime]);

  const restartWarning =
    interruptibleSessionCount > 0 && !restarting
      ? t("developmentInterruptedWarning", {
          count: interruptibleSessionCount,
          suffix: interruptibleSessionCount !== 1 ? "s " : " ",
        })
      : null;

  return (
    <>
      <HideInSettingsSearch>
        <AboutVersionCard
          desktopRuntime={desktopRuntime}
          versionInfo={versionInfo}
          versionLoading={versionLoading}
          versionError={!!versionError}
          desktopCheckStatus={desktopCheckStatus}
          onCheckUpdates={() => void handleCheckUpdates()}
          notice={
            inlineRemoteCompatibilityNotice && (
              <RemoteCompatibilityNoticeCard
                notice={inlineRemoteCompatibilityNotice}
                noticeCount={remoteCompatibilityNotices.length}
                placement="inline"
                onRestore={handleShowRemoteCompatibilityBanner}
              />
            )
          }
        />
      </HideInSettingsSearch>
      <SettingsSection title={t("aboutHelpTitle")}>
        <div className="settings-group">
          <SettingsItem
            label={t("aboutReportBugTitle")}
            description={t("aboutReportBugDescription")}
          >
            <a
              href="https://github.com/jiji262/vibeallday/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="settings-button"
            >
              {t("aboutReportBug")}
            </a>
          </SettingsItem>
          <SettingsItem
            label={t("aboutSetupWizardTitle")}
            description={t("aboutSetupWizardDescription")}
          >
            <Button size="sm" onClick={resetOnboarding}>
              {t("aboutLaunchWizard")}
            </Button>
          </SettingsItem>
        </div>
      </SettingsSection>
      {/* Only show Install option if install is possible or already installed */}
      {(canInstall || isInstalled) && (
        <SettingsSection title={t("aboutAppTitle")}>
          <div className="settings-group">
            <SettingsItem
              label={t("aboutInstallTitle")}
              description={
                isInstalled
                  ? t("aboutInstalledDescription")
                  : t("aboutInstallDescription")
              }
              valueText={isInstalled ? t("aboutInstalled") : undefined}
            >
              {isInstalled ? (
                <Status state="ok">{t("aboutInstalled")}</Status>
              ) : (
                <Button size="sm" onClick={install}>
                  {t("aboutInstall")}
                </Button>
              )}
            </SettingsItem>
          </div>
        </SettingsSection>
      )}
      <SettingsSection
        title={t("settingsMaintenanceTitle")}
        description={t("aboutMaintenanceMeta")}
      >
        <div className="settings-group">
          <SettingsItem
            label={t("developmentRestartTitle")}
            description={t("developmentRestartDescription")}
            scope="server"
            info={
              <>
                <strong>
                  <span>{t("developmentRestartTitle")}</span>
                  <span aria-hidden="true" className={styles.scopeTag}>
                    <ScopeTag scope="server" />
                  </span>
                </strong>
                <p>{t("developmentRestartDescription")}</p>
                {restartWarning && (
                  <p className="settings-warning">{restartWarning}</p>
                )}
              </>
            }
          >
            <Button
              variant="danger-soft"
              size="sm"
              onClick={handleRestart}
              disabled={restarting}
            >
              {restarting
                ? t("developmentRestarting")
                : interruptibleSessionCount > 0
                  ? t("developmentRestartAnyway")
                  : t("developmentRestart")}
            </Button>
          </SettingsItem>
        </div>
      </SettingsSection>
    </>
  );
}
