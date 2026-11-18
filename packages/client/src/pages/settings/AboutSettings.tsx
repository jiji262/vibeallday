import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { api, fetchJSON, type VersionInfo } from "../../api/client";
import { Button, ScopeTag, Status } from "../../components/garden";
import { RemoteCompatibilityNoticeCard } from "../../components/RemoteCompatibilityNotices";
import { useOptionalRemoteConnection } from "../../contexts/RemoteConnectionContext";
import { useCanAdministerHost } from "../../hooks/useActingPrincipal";
import { useOnboarding } from "../../hooks/useOnboarding";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { useRemoteCompatibilityNoticeDismissals } from "../../hooks/useRemoteCompatibilityNoticeDismissals";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import {
  activityBus,
  getInterruptibleSessionCount,
  type WorkerActivityEvent,
} from "../../lib/activityBus";
import { useClientSummarySourceKey } from "../../lib/clientSummaryStore";
import { getRemoteCompatibilityNotices } from "../../lib/remoteCompatibilityNotices";
import styles from "./AboutSettings.module.css";
import { AboutVersionCard } from "./AboutSettings.version";
import { DevelopmentSettings } from "./DevelopmentSettings";
import { EmbeddedSettingsPane } from "./EmbeddedSettingsPane";
import { EnvironmentSettings } from "./EnvironmentSettings";
import { PerformanceSettings } from "./PerformanceSettings";
import { SettingsItem } from "./SettingsItem";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import {
  HideInSettingsSearch,
  useSettingsJumpTarget,
  useSettingsSearchScope,
} from "./SettingsSearchContext";
import { SettingsSection } from "./SettingsSection";

export function AboutSettings() {
  const { t } = useI18n();
  const sourceKey = useClientSummarySourceKey();
  useSettingsPaneTitle(t("aboutTitle"));
  const canAdministerHost = useCanAdministerHost();
  const { canInstall, isInstalled, install } = usePwaInstall();
  const { version: versionInfo, error: versionError } = useVersion({
    freshOnMount: true,
  });
  const remoteConnection = useOptionalRemoteConnection();
  const { resetOnboarding } = useOnboarding();
  const searchScope = useSettingsSearchScope();
  const jumpTarget = useSettingsJumpTarget();
  const diagnosticsPanelId = useId();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  useEffect(() => {
    if (jumpTarget?.target) {
      setDiagnosticsOpen(true);
    }
  }, [jumpTarget?.target]);

  const showDiagnostics =
    diagnosticsOpen || searchScope !== null || jumpTarget?.target != null;

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

  // Fetch worker activity on mount (superuser only)
  useEffect(() => {
    if (!canAdministerHost) return;
    fetchJSON<WorkerActivityEvent>("/status/workers")
      .then((data) =>
        setInterruptibleSessionCount(getInterruptibleSessionCount(data)),
      )
      .catch(() => {});
    return activityBus.on("worker-activity-changed", (data) => {
      setInterruptibleSessionCount(getInterruptibleSessionCount(data));
    });
  }, [canAdministerHost]);

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
          versionInfo={versionInfo}
          versionError={!!versionError}
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
      {canAdministerHost && (
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
      )}
      <SettingsSection title={t("settingsGroupAdvanced")}>
        <HideInSettingsSearch>
          <div className="settings-group">
            <SettingsItem
              label={t("settingsGroupAdvanced")}
              description={t("settingsPerformanceDescription")}
            >
              <Button
                size="sm"
                aria-expanded={diagnosticsOpen}
                aria-controls={diagnosticsPanelId}
                onClick={() => setDiagnosticsOpen((open) => !open)}
              >
                {diagnosticsOpen
                  ? t("sidebarSectionCollapse")
                  : t("sidebarSectionExpand")}
              </Button>
            </SettingsItem>
          </div>
        </HideInSettingsSearch>
        {showDiagnostics && (
          <div id={diagnosticsPanelId}>
            <EmbeddedSettingsPane title={t("settingsPerformanceTitle")}>
              <PerformanceSettings />
            </EmbeddedSettingsPane>
            {canAdministerHost && (
              <>
                <EmbeddedSettingsPane title={t("settingsEnvironmentTitle")}>
                  <EnvironmentSettings />
                </EmbeddedSettingsPane>
                <EmbeddedSettingsPane title={t("settingsDevelopmentTitle")}>
                  <DevelopmentSettings />
                </EmbeddedSettingsPane>
              </>
            )}
          </div>
        )}
      </SettingsSection>
    </>
  );
}
