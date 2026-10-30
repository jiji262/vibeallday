import { useCallback, useEffect, useMemo, useState } from "react";
import { useSchemaValidationContext } from "../../contexts/SchemaValidationContext";
import { useOptionalRemoteConnection } from "../../contexts/RemoteConnectionContext";
import { useDeveloperMode } from "../../hooks/useDeveloperMode";
import { useReloadNotifications } from "../../hooks/useReloadNotifications";
import { useSchemaValidation } from "../../hooks/useSchemaValidation";
import { useServerSettings } from "../../hooks/useServerSettings";
import { useSessionPerformanceSettings } from "../../hooks/useSessionPerformanceSettings";
import { useI18n } from "../../i18n";
import { relayEndpoints } from "../../lib/connection/relayEndpoints";
import { getHostById, getHostByRelayUsername } from "../../lib/hostStorage";
import {
  SESSION_SCROLL_BEHAVIOR_MODES,
  type SessionScrollBehaviorMode,
} from "../../lib/sessionScrollBehavior";
import { Button, Card, Tag } from "../../components/garden";
import styles from "./DevelopmentSettings.module.css";
import {
  ScopedRowTitle,
  ToggleSettingRow,
} from "./PerformanceSettings.controls";
import { SettingsItem } from "./SettingsItem";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import { SettingsSection } from "./SettingsSection";
import { useSettingsUndoBaseline } from "./SettingsUndoContext";

type SessionScrollMemoryModeDescriptionKey =
  | "developmentSessionScrollMemoryModeLiveTailDescription"
  | "developmentSessionScrollMemoryModeRememberPlaceDescription"
  | "developmentSessionScrollMemoryModeNoMemoryDescription";

type SessionScrollMemoryModeLabelKey =
  | "developmentSessionScrollMemoryModeLiveTail"
  | "developmentSessionScrollMemoryModeRememberPlace"
  | "developmentSessionScrollMemoryModeNoMemory";

const sessionScrollMemoryModeDescriptionKeys: Record<
  SessionScrollBehaviorMode,
  SessionScrollMemoryModeDescriptionKey
> = {
  "live-tail": "developmentSessionScrollMemoryModeLiveTailDescription",
  "remember-place":
    "developmentSessionScrollMemoryModeRememberPlaceDescription",
  "no-memory": "developmentSessionScrollMemoryModeNoMemoryDescription",
};

const sessionScrollMemoryModeLabelKeys: Record<
  SessionScrollBehaviorMode,
  SessionScrollMemoryModeLabelKey
> = {
  "live-tail": "developmentSessionScrollMemoryModeLiveTail",
  "remember-place": "developmentSessionScrollMemoryModeRememberPlace",
  "no-memory": "developmentSessionScrollMemoryModeNoMemory",
};

export function DevelopmentSettings() {
  const { t } = useI18n();
  const remoteConnection = useOptionalRemoteConnection();
  const currentRelayHost = remoteConnection?.connection
    ? remoteConnection.currentRelayUsername
      ? getHostByRelayUsername(remoteConnection.currentRelayUsername)
      : remoteConnection.currentHostId
        ? getHostById(remoteConnection.currentHostId)
        : undefined
    : undefined;
  const currentRelayUrl =
    currentRelayHost?.mode === "relay" ? currentRelayHost.relayUrl : undefined;
  const relayMonitorUrl = currentRelayUrl
    ? relayEndpoints(currentRelayUrl)?.statsUrl
    : undefined;
  useSettingsPaneTitle(t("developmentSectionTitle"));
  const {
    isManualReloadMode,
    pendingReloads,
    connected,
    reloadBackend,
    unsafeToRestart,
    interruptibleSessionCount,
    queuedSessionMessageCount,
  } = useReloadNotifications();
  const { settings: validationSettings, setEnabled: setValidationEnabled } =
    useSchemaValidation();
  const {
    relayDebugEnabled,
    setRelayDebugEnabled,
    retainRejectedSrpSessions,
    setRetainRejectedSrpSessions,
    remoteLogCollectionEnabled,
    setRemoteLogCollectionEnabled,
  } = useDeveloperMode();
  const { sessionScrollBehaviorMode, setSessionScrollBehaviorMode } =
    useSessionPerformanceSettings();
  const { ignoredTools, clearIgnoredTools } = useSchemaValidationContext();
  const { settings: serverSettings, updateSetting: updateServerSetting } =
    useServerSettings();

  const undoState = useMemo(
    () =>
      serverSettings
        ? {
            validationEnabled: validationSettings.enabled,
            relayDebugEnabled,
            retainRejectedSrpSessions,
            remoteLogCollectionEnabled,
            sessionScrollBehaviorMode,
            serviceWorkerEnabled: serverSettings.serviceWorkerEnabled ?? true,
            workstreamsEnabled: serverSettings.workstreamsEnabled ?? false,
          }
        : null,
    [
      validationSettings.enabled,
      relayDebugEnabled,
      retainRejectedSrpSessions,
      remoteLogCollectionEnabled,
      serverSettings,
      sessionScrollBehaviorMode,
    ],
  );
  const restoreUndoState = useCallback(
    (snapshot: NonNullable<typeof undoState>) => {
      setValidationEnabled(snapshot.validationEnabled);
      setRelayDebugEnabled(snapshot.relayDebugEnabled);
      setRetainRejectedSrpSessions(snapshot.retainRejectedSrpSessions);
      setRemoteLogCollectionEnabled(snapshot.remoteLogCollectionEnabled);
      setSessionScrollBehaviorMode(snapshot.sessionScrollBehaviorMode);
      void updateServerSetting(
        "serviceWorkerEnabled",
        snapshot.serviceWorkerEnabled,
      );
      void updateServerSetting(
        "workstreamsEnabled",
        snapshot.workstreamsEnabled,
      );
    },
    [
      setValidationEnabled,
      setRelayDebugEnabled,
      setRetainRejectedSrpSessions,
      setRemoteLogCollectionEnabled,
      setSessionScrollBehaviorMode,
      updateServerSetting,
    ],
  );
  useSettingsUndoBaseline(undoState, restoreUndoState);

  const [restarting, setRestarting] = useState(false);
  // When SSE reconnects after restart, re-enable the button
  useEffect(() => {
    if (restarting && connected) {
      setRestarting(false);
    }
  }, [restarting, connected]);

  const handleRestartServer = async () => {
    setRestarting(true);
    await reloadBackend();
  };

  const restartWarning =
    interruptibleSessionCount > 0 && queuedSessionMessageCount > 0
      ? t("developmentInterruptedWarningActiveAndQueued", {
          activeCount: interruptibleSessionCount,
          activeSuffix: interruptibleSessionCount !== 1 ? "s" : "",
          queuedCount: queuedSessionMessageCount,
          queuedSuffix: queuedSessionMessageCount !== 1 ? "s" : "",
        })
      : queuedSessionMessageCount > 0
        ? t("developmentInterruptedWarningQueued", {
            count: queuedSessionMessageCount,
            suffix: queuedSessionMessageCount !== 1 ? "s" : "",
          })
        : t("developmentInterruptedWarning", {
            count: interruptibleSessionCount,
            suffix: interruptibleSessionCount !== 1 ? "s " : " ",
          });

  return (
    <>
      <SettingsSection
        title={t("developmentSectionDiagnostics")}
        description={t("developmentSectionDiagnosticsMeta")}
        scope="local"
      >
        <div className="settings-group">
          <ToggleSettingRow
            label={t("developmentSchemaTitle")}
            description={t("developmentSchemaDescription")}
            checked={validationSettings.enabled}
            onChange={setValidationEnabled}
          />
          {ignoredTools.length > 0 && (
            <SettingsItem
              label={t("developmentIgnoredToolsTitle")}
              description={t("developmentIgnoredToolsDescription")}
              valueText={ignoredTools.join(", ")}
              info={
                <>
                  <ScopedRowTitle
                    label={t("developmentIgnoredToolsTitle")}
                    scope="local"
                  />
                  <p>{t("developmentIgnoredToolsDescription")}</p>
                  <div className={styles.ignoredTools}>
                    {ignoredTools.map((tool) => (
                      <Tag key={tool}>{tool}</Tag>
                    ))}
                  </div>
                </>
              }
            >
              <Button variant="ghost" size="sm" onClick={clearIgnoredTools}>
                {t("developmentClearIgnored")}
              </Button>
            </SettingsItem>
          )}
          <ToggleSettingRow
            label={t("developmentRelayDebugTitle")}
            description={t("developmentRelayDebugDescription")}
            checked={relayDebugEnabled}
            onChange={setRelayDebugEnabled}
          />
          <ToggleSettingRow
            label={t("developmentDiagnosticsTitle")}
            description={t("developmentDiagnosticsDescription")}
            checked={remoteLogCollectionEnabled}
            onChange={setRemoteLogCollectionEnabled}
          />
          {relayMonitorUrl && (
            <SettingsItem
              label={t("developmentRelayMonitorTitle")}
              description={t("developmentRelayMonitorDescription")}
              scope={null}
            >
              <a
                className="settings-button settings-button-secondary"
                href={relayMonitorUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("developmentRelayMonitorOpen")}
              </a>
            </SettingsItem>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("developmentSectionExperimental")}
        scope="server"
      >
        <div className="settings-group">
          <ToggleSettingRow
            label={t("developmentWorkstreamsTitle")}
            description={t("developmentWorkstreamsDescription")}
            checked={serverSettings?.workstreamsEnabled ?? false}
            onChange={(enabled) =>
              updateServerSetting("workstreamsEnabled", enabled)
            }
            info={
              <>
                <ScopedRowTitle
                  label={t("developmentWorkstreamsTitle")}
                  scope="server"
                  tag={<Tag tone="attn">{t("developmentExperimentalTag")}</Tag>}
                />
                <p>{t("developmentWorkstreamsDescription")}</p>
              </>
            }
          />
          <ToggleSettingRow
            label={t("developmentServiceWorkerTitle")}
            description={t("developmentServiceWorkerDescription")}
            checked={serverSettings?.serviceWorkerEnabled ?? true}
            onChange={(enabled) =>
              updateServerSetting("serviceWorkerEnabled", enabled)
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection title={t("developmentSectionRecovery")} scope="local">
        <div className="settings-group">
          <ToggleSettingRow
            label={t("developmentRetainRejectedSrpTitle")}
            description={t("developmentRetainRejectedSrpDescription")}
            checked={retainRejectedSrpSessions}
            onChange={setRetainRejectedSrpSessions}
          />
          <SessionScrollMemoryRow
            mode={sessionScrollBehaviorMode}
            onChange={setSessionScrollBehaviorMode}
          />
        </div>
      </SettingsSection>

      {isManualReloadMode && (
        <SettingsSection title={t("settingsMaintenanceTitle")} scope="server">
          <Card tone="danger" flush className={styles.dangerCard}>
            <SettingsItem
              label={t("developmentRestartTitle")}
              description={t("developmentRestartDescription")}
              info={
                <>
                  <ScopedRowTitle
                    label={t("developmentRestartTitle")}
                    scope="server"
                    tag={<Tag>{t("developmentManualReloadTag")}</Tag>}
                  />
                  <p>
                    {t("developmentRestartDescription")}
                    {pendingReloads.backend && (
                      <span className="settings-pending">
                        {" "}
                        {t("developmentChangesPending")}
                      </span>
                    )}
                  </p>
                  {unsafeToRestart && (
                    <p className="settings-warning">{restartWarning}</p>
                  )}
                </>
              }
            >
              <Button
                variant="danger-soft"
                size="sm"
                onClick={handleRestartServer}
                disabled={restarting}
              >
                {restarting
                  ? t("developmentRestarting")
                  : unsafeToRestart
                    ? t("developmentRestartAnyway")
                    : t("developmentRestart")}
              </Button>
            </SettingsItem>
          </Card>
        </SettingsSection>
      )}
    </>
  );
}

/** Restore-mode select with each mode's explanation listed under the title. */
function SessionScrollMemoryRow({
  mode,
  onChange,
}: {
  mode: SessionScrollBehaviorMode;
  onChange: (mode: SessionScrollBehaviorMode) => void;
}) {
  const { t } = useI18n();
  return (
    <SettingsItem
      label={t("developmentSessionScrollMemoryTitle")}
      description={t("developmentSessionScrollMemoryDescription")}
      keywords={[
        t("developmentSessionScrollMemoryControlTitle"),
        t("developmentSessionScrollMemoryKeywords"),
        ...SESSION_SCROLL_BEHAVIOR_MODES.flatMap((option) => [
          t(sessionScrollMemoryModeLabelKeys[option]),
          t(sessionScrollMemoryModeDescriptionKeys[option]),
        ]),
      ]}
      valueText={t(sessionScrollMemoryModeLabelKeys[mode])}
      className="settings-item--wide-control"
      info={
        <>
          <ScopedRowTitle
            label={t("developmentSessionScrollMemoryTitle")}
            scope="local"
          />
          <p>{t("developmentSessionScrollMemoryDescription")}</p>
          <ul className="settings-option-description-list">
            {SESSION_SCROLL_BEHAVIOR_MODES.map((option) => (
              <li key={option}>
                <strong>{t(sessionScrollMemoryModeLabelKeys[option])}</strong>
                <span>{t(sessionScrollMemoryModeDescriptionKeys[option])}</span>
              </li>
            ))}
          </ul>
        </>
      }
    >
      <div className="settings-item-actions">
        <select
          className="settings-select"
          value={mode}
          onChange={(event) =>
            onChange(event.target.value as SessionScrollBehaviorMode)
          }
          aria-label={t("developmentSessionScrollMemoryControlTitle")}
        >
          {SESSION_SCROLL_BEHAVIOR_MODES.map((option) => (
            <option key={option} value={option}>
              {t(sessionScrollMemoryModeLabelKeys[option])}
            </option>
          ))}
        </select>
      </div>
    </SettingsItem>
  );
}
