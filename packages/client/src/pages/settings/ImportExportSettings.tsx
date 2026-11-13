import {
  BROWSER_SETTINGS_BACKUP_CAPABILITY,
  serverHasCapability,
} from "@vibeallday/shared";
import { useState } from "react";
import { Tabs } from "../../components/garden";
import { useVersion } from "../../hooks/useVersion";
import { useI18n } from "../../i18n";
import styles from "./ImportExportSettings.module.css";
import { SettingsBackupActions } from "./SettingsBackupActions";
import { SettingsClipboardTransfer } from "./SettingsClipboardTransfer";
import { useSettingsPaneTitle } from "./SettingsPaneTitleContext";
import {
  HideInSettingsSearch,
  useSettingsSearchScope,
} from "./SettingsSearchContext";
import { SettingsSection } from "./SettingsSection";

type TransferWay = "slot" | "text";

/**
 * Both ways to carry this browser's portable preferences elsewhere: the
 * server slot (needs the backup capability) and clipboard text. Settings
 * withholds this category from limited users, who keep the rail copies.
 */
export function ImportExportSettings() {
  const { t } = useI18n();
  useSettingsPaneTitle(t("settingsImportExportTitle"));
  const { version } = useVersion();
  const searchScope = useSettingsSearchScope();
  const hasSlot = serverHasCapability(
    version,
    BROWSER_SETTINGS_BACKUP_CAPABILITY,
  );
  const [way, setWay] = useState<TransferWay>("slot");

  // Search shows each way as its own section, so a title match surfaces it.
  if (searchScope) {
    return (
      <>
        {hasSlot && (
          <SettingsSection title={t("settingsImportExportTabSlot")}>
            <SettingsBackupActions />
          </SettingsSection>
        )}
        <SettingsSection title={t("settingsImportExportTabText")}>
          <SettingsClipboardTransfer />
        </SettingsSection>
      </>
    );
  }

  return (
    <>
      <HideInSettingsSearch>
        <p className={styles.lede}>{t("settingsImportExportLede")}</p>
      </HideInSettingsSearch>
      <SettingsSection title={t("settingsImportExportWays")}>
        <p className={styles.meta}>{t("settingsImportExportWaysMeta")}</p>
        {hasSlot && (
          <Tabs<TransferWay>
            label={t("settingsImportExportWays")}
            items={[
              { value: "slot", label: t("settingsImportExportTabSlot") },
              { value: "text", label: t("settingsImportExportTabText") },
            ]}
            value={way}
            onChange={setWay}
            className={styles.tabs}
          />
        )}
        {hasSlot ? (
          <div
            role="tabpanel"
            aria-label={t(
              way === "slot"
                ? "settingsImportExportTabSlot"
                : "settingsImportExportTabText",
            )}
            className={styles.panel}
          >
            {way === "slot" ? (
              <SettingsBackupActions />
            ) : (
              <SettingsClipboardTransfer />
            )}
          </div>
        ) : (
          <div className={styles.panel}>
            <SettingsClipboardTransfer />
          </div>
        )}
      </SettingsSection>
    </>
  );
}
