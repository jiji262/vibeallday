import { Link } from "react-router-dom";
import { Notice } from "../../components/garden";
import { useI18n } from "../../i18n";
import { useVersion } from "../../hooks/useVersion";
import { ArtifactSettings } from "./ArtifactSettings";
import { McpAppViewsSettings } from "./McpAppViewsSettings";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import styles from "./AppsSettings.module.css";
import { SettingsSection } from "./SettingsSection";

export function AppsSettings() {
  const { t } = useI18n();
  const { version } = useVersion();
  useSettingsPaneTitle(t("settingsAppsTitle"));
  return (
    <SettingsSection description={t("settingsAppsDescription")}>
      {version?.artifactViewer ? (
        <ArtifactSettings />
      ) : (
        <p>{t("settingsAppsUnavailable")}</p>
      )}
      <McpAppViewsSettings />
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
