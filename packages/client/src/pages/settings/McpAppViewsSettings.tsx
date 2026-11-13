import { SERVER_CAPABILITIES, serverHasCapability } from "@vibeallday/shared";
import { useServerSettings } from "../../hooks/useServerSettings";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import { ToggleSettingRow } from "./PerformanceSettings.controls";
import { SettingsSection } from "./SettingsSection";

/** Default-off MCP App hosting (topics/mcp-apps.md); absent on older servers. */
export function McpAppViewsSettings() {
  const { t } = useI18n();
  const { version } = useVersion();
  const { settings, updateSetting } = useServerSettings();
  if (
    !settings ||
    !serverHasCapability(version, SERVER_CAPABILITIES.mcpAppViews.name)
  )
    return null;
  return (
    <SettingsSection title={t("mcpAppViewsSettingTitle")} scope="server">
      <div className="settings-group">
        <ToggleSettingRow
          label={t("mcpAppViewsSettingTitle")}
          description={t("mcpAppViewsSettingDescription")}
          keywords={["MCP", "MCP Apps", "Codex"]}
          checked={settings.mcpAppViews === true}
          onChange={(enabled) => updateSetting("mcpAppViews", enabled)}
        />
      </div>
    </SettingsSection>
  );
}
