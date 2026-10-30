import { useCallback, useMemo, useState } from "react";
import { ErrorState } from "../../components/garden/ErrorState";
import { EmptyState } from "../../components/garden/EmptyState";
import { Notice } from "../../components/garden/Notice";
import { useEmulatorSettings } from "../../hooks/useEmulatorSettings";
import { useEmulators } from "../../hooks/useEmulators";
import { useServerSettings } from "../../hooks/useServerSettings";
import { useI18n } from "../../i18n";
import { SettingsItem } from "./SettingsItem";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import { HideInSettingsSearch } from "./SettingsSearchContext";
import { SettingsSection } from "./SettingsSection";
import { useSettingsUndoBaseline } from "./SettingsUndoContext";
import {
  EmulatorDeviceCards,
  EmulatorStreamQuality,
} from "./EmulatorSettings.sections";
import styles from "./EmulatorSettings.module.css";

/**
 * Settings section for the device bridge.
 * Shows discovered devices, stream settings, and ChromeOS host aliases.
 */
export function EmulatorSettings() {
  const { t } = useI18n();
  useSettingsPaneTitle(t("emulatorSectionTitle"));
  const { emulators, loading, error, startEmulator, stopEmulator, refresh } =
    useEmulators();
  const {
    maxFps,
    setMaxFps,
    maxWidth,
    setMaxWidth,
    quality,
    setQuality,
    adaptiveFps,
    setAdaptiveFps,
  } = useEmulatorSettings();
  const {
    settings,
    isLoading: settingsLoading,
    error: settingsError,
    updateSetting,
  } = useServerSettings();
  const [hostInput, setHostInput] = useState("");
  const [chromeOsHostError, setChromeOsHostError] = useState<string | null>(
    null,
  );

  const chromeOsHosts = settings?.chromeOsHosts ?? [];

  // Header undo: stream settings (client-scoped) + server-side device bridge
  // toggle and ChromeOS host list. Device start/stop are actions, not state.
  const undoState = useMemo(
    () =>
      settings
        ? {
            maxFps,
            maxWidth,
            quality,
            adaptiveFps,
            deviceBridgeEnabled: settings.deviceBridgeEnabled ?? false,
            chromeOsHosts: settings.chromeOsHosts ?? [],
          }
        : null,
    [settings, maxFps, maxWidth, quality, adaptiveFps],
  );
  const restoreUndoState = useCallback(
    (snapshot: NonNullable<typeof undoState>) => {
      setMaxFps(snapshot.maxFps);
      setMaxWidth(snapshot.maxWidth);
      setQuality(snapshot.quality);
      setAdaptiveFps(snapshot.adaptiveFps);
      void updateSetting("deviceBridgeEnabled", snapshot.deviceBridgeEnabled);
      void updateSetting("chromeOsHosts", snapshot.chromeOsHosts);
      setChromeOsHostError(null);
    },
    [setMaxFps, setMaxWidth, setQuality, setAdaptiveFps, updateSetting],
  );
  useSettingsUndoBaseline(undoState, restoreUndoState);

  const addHost = async () => {
    const value = hostInput.trim();
    if (!value) {
      setChromeOsHostError(t("emulatorHostAliasRequired"));
      return;
    }
    if (/\s/.test(value)) {
      setChromeOsHostError(t("emulatorHostAliasNoSpaces"));
      return;
    }

    const deduped = Array.from(new Set([...chromeOsHosts, value]));
    try {
      await updateSetting("chromeOsHosts", deduped);
      setHostInput("");
      setChromeOsHostError(null);
      await refresh();
    } catch (err) {
      setChromeOsHostError(
        err instanceof Error ? err.message : t("emulatorHostAliasSaveFailed"),
      );
    }
  };

  const removeHost = async (host: string) => {
    const next = chromeOsHosts.filter(
      (item) => item.toLowerCase() !== host.toLowerCase(),
    );
    try {
      await updateSetting("chromeOsHosts", next);
      setChromeOsHostError(null);
      await refresh();
    } catch (err) {
      setChromeOsHostError(
        err instanceof Error ? err.message : t("emulatorHostAliasRemoveFailed"),
      );
    }
  };

  const deviceBridgeEnabled = settings?.deviceBridgeEnabled ?? false;

  return (
    <>
      <SettingsSection description={t("emulatorSectionDescription")}>
        <Notice
          tone="warning"
          tag={t("emulatorExperimentalTag")}
          className={styles.notice}
        >
          {t("emulatorExperimentalNotice")}
        </Notice>
        <div className="settings-group">
          <SettingsItem
            label={t("emulatorEnableTitle")}
            description={t("emulatorEnableDescription")}
            scope="server"
            valueText={t(deviceBridgeEnabled ? "commonOn" : "commonOff")}
          >
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={deviceBridgeEnabled}
                onChange={(e) => {
                  void updateSetting("deviceBridgeEnabled", e.target.checked);
                }}
                disabled={settingsLoading}
              />
              <span className="toggle-slider" />
            </label>
          </SettingsItem>
        </div>
      </SettingsSection>

      {deviceBridgeEnabled && (
        <>
          <EmulatorDeviceCards
            devices={emulators}
            loading={loading}
            error={error}
            onStart={startEmulator}
            onStop={stopEmulator}
          />
          <EmulatorStreamQuality
            maxFps={maxFps}
            setMaxFps={setMaxFps}
            maxWidth={maxWidth}
            setMaxWidth={setMaxWidth}
            quality={quality}
            setQuality={setQuality}
            adaptiveFps={adaptiveFps}
            setAdaptiveFps={setAdaptiveFps}
          />
          <SettingsSection
            title={t("emulatorChromeOsHostsTitle")}
            description={`${t("emulatorChromeOsHostsDescription")} chromeroot${t(
              "emulatorChromeOsHostsDescriptionSuffix",
            )}`}
            scope="server"
          >
            <div className="settings-group">
              <SettingsItem
                label={t("emulatorAddHostAliasTitle")}
                description={t("emulatorAddHostAliasDescription")}
                valueText={chromeOsHosts.join(", ")}
              >
                <form
                  className="settings-item-actions"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void addHost();
                  }}
                >
                  <input
                    type="text"
                    name="chromeosHost"
                    placeholder={t("emulatorHostAliasPlaceholder")}
                    className="settings-select"
                    autoComplete="off"
                    value={hostInput}
                    onChange={(event) => setHostInput(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="settings-button settings-button-primary"
                    disabled={settingsLoading}
                  >
                    {t("projectsAddConfirm")}
                  </button>
                </form>
              </SettingsItem>

              <HideInSettingsSearch>
                {chromeOsHostError && (
                  <ErrorState inline message={chromeOsHostError} />
                )}
                {settingsError && <ErrorState inline message={settingsError} />}

                {chromeOsHosts.length === 0 ? (
                  <EmptyState compact title={t("emulatorNoChromeOsHosts")} />
                ) : (
                  chromeOsHosts.map((host) => (
                    <div key={host} className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-label">{host}</span>
                        <span className="settings-item-description">
                          {t("emulatorChromeOsDeviceId", {
                            id: `chromeos:${host}`,
                          })}
                        </span>
                      </div>
                      <div className="settings-item-action">
                        <button
                          type="button"
                          className="settings-button"
                          onClick={() => {
                            void removeHost(host);
                          }}
                          disabled={settingsLoading}
                        >
                          {t("emulatorRemove")}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </HideInSettingsSearch>
            </div>
          </SettingsSection>
        </>
      )}
    </>
  );
}
