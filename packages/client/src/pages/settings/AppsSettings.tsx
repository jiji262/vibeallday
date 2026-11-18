import { SERVER_CAPABILITIES, serverHasCapability } from "@vibeallday/shared";
import { Link } from "react-router-dom";
import { Notice } from "../../components/garden";
import { useServerSettings } from "../../hooks/useServerSettings";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import styles from "./AppsSettings.module.css";
import { ArtifactSettings } from "./ArtifactSettings";
import { ToggleSettingRow } from "./PerformanceSettings.controls";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import { SettingsSection } from "./SettingsSection";

export function AppsSettings() {
  const { t } = useI18n();
  const { version } = useVersion();
  const { settings, updateSetting } = useServerSettings();
  useSettingsPaneTitle(t("settingsAppsTitle"));
  const showMcpAppViews =
    Boolean(settings) &&
    serverHasCapability(version, SERVER_CAPABILITIES.mcpAppViews.name);

  return (
    <SettingsSection description={t("settingsAppsDescription")}>
      {version?.artifactViewer ? (
        <ArtifactSettings />
      ) : (
        <Notice tone="neutral" className={styles.movedNotice}>
          {t("settingsAppsUnavailable")}
        </Notice>
      )}
      {showMcpAppViews && (
        <SettingsSection title={t("mcpAppViewsSettingTitle")} scope="server">
          <div className="settings-group">
            <ToggleSettingRow
              label={t("mcpAppViewsSettingTitle")}
              description={t("mcpAppViewsSettingDescription")}
              keywords={["MCP", "MCP Apps", "Codex"]}
              checked={settings?.mcpAppViews === true}
              onChange={(enabled) => updateSetting("mcpAppViews", enabled)}
            />
          </div>
        </SettingsSection>
      )}
    </SettingsSection>
  );
}

export function AppsSettingsLink() {
  const { t } = useI18n();
  // Absolute: the settings category routes are siblings, so "../apps" resolved to "/apps".
  return (
    <Notice tone="info" className={styles.movedNotice}>
      <Link className={styles.movedLink} to="/settings/apps">
        {t("settingsAppsLink")}
      </Link>
    </Notice>
  );
}
