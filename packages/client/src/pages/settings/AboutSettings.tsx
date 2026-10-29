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
import {
  formatRemoteServerVersion,
  getRemoteCompatibilityNotices,
  parseSemver,
} from "../../lib/remoteCompatibilityNotices";
import {
  formatDesktopBuildVersion,
  getDesktopRuntimeMetadata,
} from "../../lib/desktopRuntime";

/** A commit or file time in the reader's locale, to the minute. */
function formatRevisionTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type Translate = ReturnType<typeof useI18n>["t"];

/** Server version for display, with the "unknown" fallbacks localized. */
function serverVersionLabel(info: VersionInfo, t: Translate): string {
  if (parseSemver(info.current)) {
    return formatRemoteServerVersion(info.current, info.installSource);
  }
  return t(
    info.installSource === "source"
      ? "aboutServerVersionSourceUnknown"
      : "aboutServerVersionUnknown",
  );
}

/** Release builds read "v1.2.3"; a source build's version is a commit id. */
function clientVersionLabel(version: string): string {
  return parseSemver(version) ? `v${version.replace(/^v/, "")}` : version;
}

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

  const [desktopCheckStatus, setDesktopCheckStatus] = useState<
    "opened" | "failed" | "menu" | null
  >(null);
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

  return (
    <SettingsSection>
      <div className="settings-group">
        {/* Only show Install option if install is possible or already installed */}
        {(canInstall || isInstalled) && (
          <SettingsItem
            label={t("aboutInstallTitle")}
            description={
              isInstalled
                ? t("aboutInstalledDescription")
                : t("aboutInstallDescription")
            }
          >
            {isInstalled ? (
              <span className="settings-status-badge">
                {t("aboutInstalled")}
              </span>
            ) : (
              <button
                type="button"
                className="settings-button"
                onClick={install}
              >
                {t("aboutInstall")}
              </button>
            )}
          </SettingsItem>
        )}
        <HideInSettingsSearch>
          <div className="settings-item settings-version-item">
            <div className="settings-version-item__row">
              <div className="settings-item-info">
                <strong>{t("aboutVersionTitle")}</strong>
                {desktopRuntime ? (
                  <>
                    <p>
                      {t("aboutDesktopVersion")}{" "}
                      {formatDesktopBuildVersion(desktopRuntime.desktopVersion)}
                    </p>
                    <p>
                      {t("aboutBundledVibeAllDayVersion")}{" "}
                      {formatDesktopBuildVersion(
                        desktopRuntime.bundledVibeAllDayVersion ??
                          __APP_VERSION__,
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      {t("aboutServerVersion")}{" "}
                      {versionInfo
                        ? serverVersionLabel(versionInfo, t)
                        : t("loginLoading")}
                    </p>
                    {versionInfo?.sourceRevision && (
                      <p>
                        {t("aboutServerCommit")}{" "}
                        <code title={versionInfo.sourceRevision.commit}>
                          {versionInfo.sourceRevision.commit.slice(0, 12)}
                        </code>{" "}
                        {formatRevisionTime(
                          versionInfo.sourceRevision.committedAt,
                        )}
                        {versionInfo.sourceRevision.modified && (
                          <span className="settings-update-available">
                            {" "}
                            {versionInfo.sourceRevision.modifiedAt
                              ? t("aboutServerModifiedAt", {
                                  time: formatRevisionTime(
                                    versionInfo.sourceRevision.modifiedAt,
                                  ),
                                })
                              : t("aboutServerModified")}
                          </span>
                        )}
                      </p>
                    )}
                    <p>
                      {t("aboutClientVersion")}{" "}
                      {clientVersionLabel(__APP_VERSION__)}
                    </p>
                  </>
                )}
                {desktopCheckStatus && (
                  <p role="status">
                    {t(
                      desktopCheckStatus === "opened"
                        ? "aboutDesktopUpdateOpened"
                        : desktopCheckStatus === "menu"
                          ? "aboutDesktopUpdateMenu"
                          : "aboutDesktopUpdateFailed",
                    )}
                  </p>
                )}
                {versionError && (
                  <p className="settings-warning">{t("aboutUnableRefresh")}</p>
                )}
              </div>
              {desktopRuntime && (
                <div className="settings-item-actions">
                  <button
                    type="button"
                    className="settings-button"
                    onClick={() => void handleCheckUpdates()}
                    disabled={versionLoading}
                  >
                    {versionLoading
                      ? t("aboutChecking")
                      : t("aboutCheckUpdates")}
                  </button>
                </div>
              )}
            </div>
            {inlineRemoteCompatibilityNotice && (
              <RemoteCompatibilityNoticeCard
                notice={inlineRemoteCompatibilityNotice}
                noticeCount={remoteCompatibilityNotices.length}
                placement="inline"
                onRestore={handleShowRemoteCompatibilityBanner}
              />
            )}
          </div>
        </HideInSettingsSearch>
        <SettingsItem
          label={t("developmentRestartTitle")}
          description={t("developmentRestartDescription")}
          info={
            <>
              <strong>{t("developmentRestartTitle")}</strong>
              <p>{t("developmentRestartDescription")}</p>
              {interruptibleSessionCount > 0 && !restarting && (
                <p className="settings-warning">
                  {t("developmentInterruptedWarning", {
                    count: interruptibleSessionCount,
                    suffix: interruptibleSessionCount !== 1 ? "s " : " ",
                  })}
                </p>
              )}
            </>
          }
        >
          <button
            type="button"
            className={`settings-button ${interruptibleSessionCount > 0 ? "settings-button-danger" : ""}`}
            onClick={handleRestart}
            disabled={restarting}
          >
            {restarting
              ? t("developmentRestarting")
              : interruptibleSessionCount > 0
                ? t("developmentRestartAnyway")
                : t("developmentRestart")}
          </button>
        </SettingsItem>
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
          <button
            type="button"
            className="settings-button"
            onClick={resetOnboarding}
          >
            {t("aboutLaunchWizard")}
          </button>
        </SettingsItem>
      </div>
    </SettingsSection>
  );
}
